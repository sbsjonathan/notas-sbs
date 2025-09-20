// agente-obj.js — Agente para análise de objetivos do artigo (VERSÃO CORRIGIDA)

async function gerarRespostaIA_Objetivo(idObjetivo, wrapperElement, idRespostaIA) {
  const objetivoEl = document.querySelector('.objetivo');
  const respostaEl = document.getElementById(idRespostaIA);
  const todosOsParagrafos = document.querySelectorAll('.paragrafo');

  if (!objetivoEl || !respostaEl || todosOsParagrafos.length === 0) {
    console.warn(`Elementos essenciais não encontrados para análise do objetivo`);
    return;
  }

  // Limpa marcações anteriores se houver
  wrapperElement.querySelector('.ia-btn-objetivo')?.remove();

  wrapperElement.classList.add('ia-loading');
  respostaEl.innerHTML = '<span style="color:#9ca3af;">Analisando artigo completo e preparando visão geral...</span>';

  // Extrai informações do artigo
  const infoArtigo = extrairInformacoesArtigo();
  const textoArtigoCompleto = extrairTextoCompletoArtigo(Array.from(todosOsParagrafos));
  const objetivoTexto = extrairObjetivoArtigo(objetivoEl);

  console.log('Informações extraídas:', { infoArtigo, objetivoTexto, textoLength: textoArtigoCompleto.length });

  const GEMINI_MODEL = 'gemini-2.0-flash-exp';
  const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const API_KEY = 'AIzaSyANZlDe64BqLPM8ByCNyaz9KecnTgRwEPc';

  // Prompt corrigido para resumo respeitoso (não discurso)
  const sistemaInstrucao = `Você é uma pessoa que estuda profundamente as publicações da Torre de Vigia e faz resumos respeitosos e completos dos artigos de estudo.

**SUA TAREFA:**
Forneça um resumo completo e respeitoso deste artigo de estudo, escrito do ponto de vista de alguém que tem respeito pela Palavra de Deus.

**INFORMAÇÕES DO ARTIGO:**
- Título: ${infoArtigo.titulo}
- Objetivo declarado: ${objetivoTexto}
- Texto bíblico principal: ${infoArtigo.textoBase}

**ARTIGO COMPLETO PARA ANÁLISE:**
${textoArtigoCompleto}

**RESPONDA DIRETAMENTE COM:**

**VISÃO GERAL COMPLETA (4-5 parágrafos):**
- Contexto bíblico e cenário do artigo
- Principais personagens e eventos mencionados
- Lições e princípios fundamentais apresentados
- Como os exemplos bíblicos se aplicam hoje
- Pontos importantes que o artigo destaca

**OBJETIVO E UTILIDADE PRÁTICA (3-4 parágrafos):**
- O que este estudo pretende nos ensinar
- Como pode fortalecer nossa fé e vida cristã
- Aplicações práticas para nossa vida diária
- Como usar essas lições em situações reais
- De que maneira este estudo nos beneficia

**ESTILO DE ESCRITA:**
- Use expressões como: "Neste artigo veremos como...", "Jeová nos ensina que...", "Aprendemos que...", "Este estudo nos ajuda a..."
- Seja respeitoso e reverente com temas bíblicos
- Escreva de forma clara e objetiva
- Não use linguagem de discurso ou pregação
- Foque no conteúdo educativo e prático
- Mantenha tom informativo mas respeitoso

IMPORTANTE: Comece sua resposta DIRETAMENTE com a visão geral, sem introdução ou cumprimentos. O nome do artigo é "A Sentinela" (se quiser referir ao nome use o A sempre), e se quiser se referir a esse artigo prefira usar "nesse estudo".

Escreva um resumo completo que ajude alguém a entender profundamente o artigo antes de estudá-lo.`;

  try {
    const body = {
      contents: [{ 
        parts: [{ text: sistemaInstrucao }] 
      }],
      generationConfig: { 
        temperature: 0.7,
        maxOutputTokens: 2048,  // Muito mais tokens para resposta completa
        topK: 40,
        topP: 0.95
      }
    };

    console.log('Enviando requisição para a API...');

    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'X-goog-api-key': API_KEY 
      },
      body: JSON.stringify(body)
    });

    console.log('Status da resposta:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('Erro da API:', errorData);
      throw new Error(`Erro HTTP ${response.status}: ${errorData?.error?.message || 'Erro desconhecido'}`);
    }

    const raw = await response.json();
    console.log('Resposta bruta da API:', raw);

    // TRATAMENTO ROBUSTO DA RESPOSTA
    let respostaNatural = '';
    
    if (raw?.candidates && raw.candidates.length > 0) {
      const candidate = raw.candidates[0];
      if (candidate?.content?.parts && candidate.content.parts.length > 0) {
        respostaNatural = candidate.content.parts[0].text || '';
      }
    }

    // Se ainda estiver vazio, tenta outras estruturas
    if (!respostaNatural) {
      respostaNatural = raw?.text || raw?.response || '';
    }

    console.log('Resposta extraída:', respostaNatural);

    if (!respostaNatural || respostaNatural.trim().length === 0) {
      throw new Error('A API retornou uma resposta vazia. Estrutura da resposta: ' + JSON.stringify(raw));
    }

    // Formata a resposta
    const respostaFormatada = respostaNatural
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    respostaEl.innerHTML = `<p>${respostaFormatada}</p>`;

    // Adiciona botão de informações
    const btnInfo = document.createElement('button');
    btnInfo.className = 'ia-btn-objetivo';
    btnInfo.textContent = 'ℹ️';
    btnInfo.title = 'Análise baseada no artigo completo';
    btnInfo.style.cssText = `
      position: absolute;
      bottom: 8px;
      right: 8px;
      background: transparent;
      color: #9ca3af;
      border: 1px solid #e5e7eb;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.65rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      opacity: 0.7;
    `;
    
    btnInfo.onmouseover = () => {
      btnInfo.style.opacity = '1';
      btnInfo.style.color = '#6b7280';
    };
    
    btnInfo.onmouseout = () => {
      btnInfo.style.opacity = '0.7';
      btnInfo.style.color = '#9ca3af';
    };
    
    btnInfo.onclick = (e) => {
      e.stopPropagation();
      alert('Esta análise foi preparada com base na leitura completa do artigo, considerando o contexto bíblico e as aplicações práticas mencionadas.');
    };
    
    wrapperElement.appendChild(btnInfo);

    // Cache opcional
    if (window.CacheAnotacao) {
      window.CacheAnotacao.salvar(idRespostaIA, respostaEl.innerHTML);
    }

  } catch (erro) {
    console.error("Erro detalhado no agente de objetivo:", erro);
    respostaEl.innerHTML = `
      <div style="color: #dc2626; background: #fef2f2; padding: 12px; border-radius: 6px; font-size: 0.9rem;">
        <strong>❌ Erro:</strong> ${erro.message}
        <br><br>
        <small>Verifique o console do navegador (F12) para mais detalhes.</small>
      </div>
    `;
  } finally {
    wrapperElement.classList.remove('ia-loading');
  }
}

// Função para extrair informações básicas do artigo
function extrairInformacoesArtigo() {
  const titulo = document.querySelector('.estudo-titulo')?.textContent?.trim() || '';
  const citacao = document.querySelector('.citacao')?.textContent?.trim() || '';
  const textoBase = citacao.match(/— (.+)/)?.[1] || '';
  
  return {
    titulo,
    textoBase,
    citacao
  };
}

// Função para extrair o texto do objetivo
function extrairObjetivoArtigo(objetivoEl) {
  const objetivoTextoEl = objetivoEl?.querySelector('.objetivo-texto');
  return objetivoTextoEl?.textContent?.trim() || '';
}

// Função para extrair texto completo do artigo (VERSÃO COMPLETA para Gemini 2.0)
function extrairTextoCompletoArtigo(paragrafos) {
  let textoCompleto = '';
  
  // Adiciona título
  const titulo = document.querySelector('.estudo-titulo')?.textContent?.trim();
  if (titulo) textoCompleto += `TÍTULO DO ESTUDO: ${titulo}\n\n`;
  
  // Adiciona objetivo declarado
  const objetivo = document.querySelector('.objetivo-texto')?.textContent?.trim();
  if (objetivo) textoCompleto += `OBJETIVO DECLARADO: ${objetivo}\n\n`;
  
  // Adiciona texto base da citação
  const citacao = document.querySelector('.citacao')?.textContent?.trim();
  if (citacao) textoCompleto += `TEXTO BÍBLICO BASE: ${citacao}\n\n`;
  
  // Adiciona cântico inicial se existir
  const cantico = document.querySelector('.cantico')?.textContent?.trim();
  const canticoTitulo = document.querySelector('.cantico-titulo')?.textContent?.trim();
  if (cantico && canticoTitulo) {
    textoCompleto += `CÂNTICO: ${cantico} - ${canticoTitulo}\n\n`;
  }
  
  // Adiciona todos os parágrafos do artigo
  paragrafos.forEach((paragrafo, index) => {
    const clone = paragrafo.cloneNode(true);
    
    // Preserva números dos parágrafos
    const spanNumero = clone.querySelector('span');
    let numeroParagrafo = '';
    if (spanNumero) {
      numeroParagrafo = `PARÁGRAFO ${spanNumero.textContent.trim()}: `;
    }
    
    // Remove referências bíblicas temporariamente para facilitar leitura
    const referencias = clone.querySelectorAll('a.bbl');
    referencias.forEach(ref => {
      const textoRef = ref.textContent.trim();
      ref.outerHTML = ` [${textoRef}] `;
    });
    
    let texto = clone.textContent;
    texto = texto.replace(/\s+/g, ' ').trim();
    
    if (texto && texto.length > 20) {
      textoCompleto += `${numeroParagrafo}${texto}\n\n`;
    }
  });
  
  // Adiciona todos os subtítulos
  const subtitulos = document.querySelectorAll('.subtitulo');
  subtitulos.forEach((sub, index) => {
    const textoSub = sub.textContent.trim();
    if (textoSub) textoCompleto += `\n=== SUBTÍTULO ${index + 1}: ${textoSub} ===\n\n`;
  });
  
  // Adiciona seção de recapitulação se existir
  const tituloRecap = document.querySelector('.titulo-recapitulacao')?.textContent?.trim();
  if (tituloRecap) {
    textoCompleto += `\n=== SEÇÃO DE RECAPITULAÇÃO ===\n${tituloRecap}\n`;
    
    const listaRecap = document.querySelectorAll('.lista-recapitulacao li');
    listaRecap.forEach((item, index) => {
      const textoItem = item.textContent.split('\n')[0].trim(); // Só o texto da pergunta
      if (textoItem) textoCompleto += `${index + 1}. ${textoItem}\n`;
    });
  }
  
  // Adiciona cântico final se existir
  const ultimaSecaoCantico = document.querySelectorAll('.secao-cantico');
  if (ultimaSecaoCantico.length > 1) {
    const canticoFinal = ultimaSecaoCantico[ultimaSecaoCantico.length - 1];
    const canticoFinalTexto = canticoFinal.textContent.trim();
    if (canticoFinalTexto) {
      textoCompleto += `\nCÂNTICO FINAL: ${canticoFinalTexto}\n`;
    }
  }
  
  return textoCompleto.trim();
}