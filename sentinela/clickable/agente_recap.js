// agente_recap.js — VERSÃO COMPLETA COM ANÁLISE CONTEXTUAL

async function gerarRespostaIA_Recap(idPergunta, wrapperElement, idRespostaIA) {
  const perguntaEl = document.getElementById(idPergunta);
  const respostaEl = document.getElementById(idRespostaIA);
  const todosOsParagrafos = document.querySelectorAll('.paragrafo');

  if (!perguntaEl || !respostaEl || todosOsParagrafos.length === 0) {
    console.warn(`Elementos essenciais não encontrados para a recapitulação: ${idPergunta}`);
    return;
  }

  const recapIndex = idPergunta.match(/rcp-(\d+)/)?.[1] || '0';
  const classeUnica = `ia-underline-recap-${recapIndex}`;

  // limpa marcações anteriores dessa instância
  todosOsParagrafos.forEach(p => {
    p.querySelectorAll(`mark.${classeUnica}`).forEach(mark => {
      const parent = mark.parentNode;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
    });
    p.normalize();
  });
  wrapperElement.querySelector('.ia-btn-paragrafo')?.remove();

  wrapperElement.classList.add('ia-loading');
  respostaEl.innerHTML = '<span style="color:#9ca3af;">Analisando contexto e gerando resposta...</span>';

  // ====== NOVA LÓGICA: ANÁLISE CONTEXTUAL ======
  const contextoCompleto = analisarContextoRecapitulacao(perguntaEl);
  console.log('Contexto analisado:', contextoCompleto); // Debug
  
  const textoArtigoLimpo = extrairTextoLimpoCompleto(Array.from(todosOsParagrafos));
  const isMultiPart = contextoCompleto.perguntaCompleta.includes('(a)') && contextoCompleto.perguntaCompleta.includes('(b)');

  const GEMINI_MODEL = 'gemini-2.5-flash';
  const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const API_KEY = 'AIzaSyBELDlAvSQxRCJ63aYZcyeO8IgaJZoRMKs';

  // ====== PROMPT CONTEXTUAL INTELIGENTE ======
  const sistemaInstrucao = `
Você é um especialista em análise textual bíblica focado em extrair LIÇÕES ESPECÍFICAS.

**CONTEXTO DA ANÁLISE:**
${contextoCompleto.explicacao}

**TAREFA ESPECÍFICA:**
${contextoCompleto.instrucaoFocada}

**MÉTODO DE ANÁLISE:**
1) Identifique seções do artigo que falam sobre "${contextoCompleto.foco}"
2) Extraia as lições/princípios mencionados sobre essa pessoa/tema
3) Foque em frases que contêm:
   - "Lições para nós"
   - "Precisamos"
   - "Devemos" 
   - "Isso nos ensina"
   - "Podemos aprender"

**REGRAS para frase literal:**
1) Extraia TRECHOS LITERAIS completos do texto
2) CORTE antes de referências bíblicas como "(Luc. 21:20)"
3) RETOME depois da referência se necessário
4) Mantenha a sequência original das palavras

**SAÍDA JSON OBRIGATÓRIA:**
{
  "resposta_natural": "resposta específica sobre as lições (2-3 frases)",
  "frase_literal_principal": "trecho literal do texto que contém a lição principal"
}`;

  try {
    let respostaNatural = '';
    let fraseLiteral = null;
    
    if (isMultiPart) {
      const [perguntaA, perguntaB] = contextoCompleto.perguntaCompleta.split('(b)');
      const perguntaLimpaA = perguntaA.replace('(a)', '').trim();
      const perguntaLimpaB = `(b) ${perguntaB.trim()}`;
      
      const bodyA = {
        contents: [{ parts: [{ text: `${sistemaInstrucao}\n\nARTIGO COMPLETO:\n${textoArtigoLimpo}\n\nPERGUNTA:\n${perguntaLimpaA}` }] }],
        generationConfig: { response_mime_type: 'application/json' }
      };
      
      const bodyB = {
        contents: [{ parts: [{ text: `${sistemaInstrucao}\n\nARTIGO COMPLETO:\n${textoArtigoLimpo}\n\nPERGUNTA:\n${perguntaLimpaB}` }] }],
        generationConfig: { response_mime_type: 'application/json' }
      };
      
      const [responseA, responseB] = await Promise.all([
        fetch(GEMINI_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-goog-api-key': API_KEY },
          body: JSON.stringify(bodyA)
        }),
        fetch(GEMINI_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-goog-api-key': API_KEY },
          body: JSON.stringify(bodyB)
        })
      ]);
      
      const resultadoA = JSON.parse((await responseA.json())?.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
      const resultadoB = JSON.parse((await responseB.json())?.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
      
      const respostaA = (resultadoA.resposta_natural || '').substring(0, 150);
      const respostaB = (resultadoB.resposta_natural || '').substring(0, 150);
      
      respostaNatural = `(a) ${respostaA}\n\n(b) ${respostaB}`.trim();
      fraseLiteral = resultadoA.frase_literal_principal || resultadoB.frase_literal_principal;
      
    } else {
      const body = {
        contents: [{ parts: [{ text: `${sistemaInstrucao}\n\nARTIGO COMPLETO:\n${textoArtigoLimpo}\n\nPERGUNTA:\n${contextoCompleto.perguntaCompleta}` }] }],
        generationConfig: { response_mime_type: 'application/json' }
      };

      const response = await fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': API_KEY },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        let msg = `Erro ${response.status}`;
        try { msg = (await response.json())?.error?.message || msg; } catch {}
        throw new Error(msg);
      }

      const raw = await response.json();
      const txt = raw?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const resultado = JSON.parse(txt);

      respostaNatural = resultado.resposta_natural || '❌ Resposta não gerada.';
      fraseLiteral = resultado.frase_literal_principal;
    }

    fraseLiteral = validarFraseRecap(fraseLiteral, textoArtigoLimpo, contextoCompleto.perguntaCompleta);
    respostaEl.textContent = respostaNatural;

    let paragrafoRealEncontrado = null;
    
    if (fraseLiteral && fraseLiteral.length > 20) {
      const fraseParaBusca = fraseLiteral
        .replace(/[""'']/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
      
      for (const p of todosOsParagrafos) {
        // 1) tenta marcar a frase completa (com exclusões se cruzar parênteses)
        let marcado = highlightLiteralMultiNode_Recap(p, fraseParaBusca, `ia-underline-recap ${classeUnica}`);
        
        // 2) fallback: sem aspas especiais
        if (!marcado && fraseParaBusca.includes('"')) {
          const fraseSemAspas = fraseParaBusca.replace(/"/g, '');
          marcado = highlightLiteralMultiNode_Recap(p, fraseSemAspas, `ia-underline-recap ${classeUnica}`);
        }
        
        // 3) fallback: pedaço inicial
        if (!marcado && fraseParaBusca.length > 50) {
          const inicio = fraseParaBusca.substring(0, 45);
          marcado = highlightLiteralMultiNode_Recap(p, inicio, `ia-underline-recap ${classeUnica}`);
        }
        
        if (marcado) {
          const spanNumero = p.querySelector('span');
          if (spanNumero) {
            paragrafoRealEncontrado = spanNumero.textContent.trim();
          }
          break;
        }
      }
    }
    
    if (paragrafoRealEncontrado) {
      const btnParagrafo = document.createElement('button');
      btnParagrafo.className = 'ia-btn-paragrafo';
      btnParagrafo.textContent = `§${paragrafoRealEncontrado}`;
      btnParagrafo.title = 'Ir para o parágrafo';
      btnParagrafo.style.cssText = `
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
      
      btnParagrafo.onmouseover = () => {
        btnParagrafo.style.opacity = '1';
        btnParagrafo.style.color = '#6b7280';
      };
      
      btnParagrafo.onmouseout = () => {
        btnParagrafo.style.opacity = '0.7';
        btnParagrafo.style.color = '#9ca3af';
      };
      
      btnParagrafo.onclick = (e) => {
        e.stopPropagation();
        navegarParaParagrafo(paragrafoRealEncontrado);
      };
      
      wrapperElement.appendChild(btnParagrafo);
    }

    if (window.CacheAnotacao) {
      window.CacheAnotacao.salvar(idRespostaIA, respostaEl.textContent);
      todosOsParagrafos.forEach(p => {
        if (p.id) window.CacheAnotacao.salvar(p.id, p.innerHTML);
      });
    }

  } catch (erro) {
    console.error("Erro no agente de recapitulação:", erro);
    respostaEl.textContent = `❌ Erro: ${erro.message}`;
  } finally {
    wrapperElement.classList.remove('ia-loading');
  }
}

// ====== NOVA FUNÇÃO: ANÁLISE CONTEXTUAL ======
function analisarContextoRecapitulacao(perguntaEl) {
  const perguntaIndividual = perguntaEl.innerText.split('\n')[0].trim();
  
  // Procura pela seção de recapitulação
  const secaoRecap = perguntaEl.closest('.secao-recapitulacao');
  let tituloCompleto = '';
  
  if (secaoRecap) {
    const tituloRecap = secaoRecap.querySelector('.titulo-recapitulacao');
    if (tituloRecap) {
      tituloCompleto = tituloRecap.textContent.trim();
    }
  }
  
  // ANÁLISE INTELIGENTE DO PADRÃO
  const contexto = {
    foco: perguntaIndividual.replace('?', ''),
    perguntaCompleta: '',
    instrucaoFocada: '',
    explicacao: ''
  };
  
  // Detecta padrões comuns
  if (tituloCompleto.includes('LIÇÕES') && tituloCompleto.includes('PALAVRAS DE JACÓ')) {
    contexto.perguntaCompleta = `Que lições você aprendeu com as palavras de Jacó para ${contexto.foco}?`;
    contexto.instrucaoFocada = `Extraia as lições específicas que o artigo ensina baseadas no que Jacó disse sobre ${contexto.foco}.`;
    contexto.explicacao = `Esta é uma pergunta de recapitulação sobre lições bíblicas. O foco é extrair ensinamentos práticos baseados nas palavras proféticas de Jacó sobre ${contexto.foco}.`;
  }
  else if (tituloCompleto.includes('LIÇÕES')) {
    contexto.perguntaCompleta = `Que lições você aprendeu sobre ${contexto.foco}?`;
    contexto.instrucaoFocada = `Extraia as lições práticas que o artigo ensina sobre ${contexto.foco}.`;
    contexto.explicacao = `Esta é uma pergunta de recapitulação sobre lições. O foco é identificar princípios práticos relacionados a ${contexto.foco}.`;
  }
  else if (tituloCompleto.includes('COMO')) {
    contexto.perguntaCompleta = `Como ${perguntaIndividual}`;
    contexto.instrucaoFocada = `Explique os métodos ou maneiras práticas relacionadas a: ${perguntaIndividual}`;
    contexto.explicacao = `Esta é uma pergunta sobre métodos práticos.`;
  }
  else if (tituloCompleto.includes('POR QUE')) {
    contexto.perguntaCompleta = `Por que ${perguntaIndividual}`;
    contexto.instrucaoFocada = `Explique as razões ou motivos relacionados a: ${perguntaIndividual}`;
    contexto.explicacao = `Esta é uma pergunta sobre razões e motivos.`;
  }
  else {
    // Fallback - tentativa de concatenação simples
    const tituloLimpo = tituloCompleto.replace(/\.\.\.$/, '').trim();
    contexto.perguntaCompleta = `${tituloLimpo} ${perguntaIndividual}`;
    contexto.instrucaoFocada = `Responda a pergunta: ${contexto.perguntaCompleta}`;
    contexto.explicacao = `Pergunta de recapitulação geral.`;
  }
  
  return contexto;
}

function validarFraseRecap(frase, rawText, pergunta) {
  if (!frase) return null;
  let fraseLimpa = frase.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const textoNormalizado = rawText.toLowerCase().replace(/\s+/g, ' ');
  const fraseNormalizada = fraseLimpa.toLowerCase().replace(/\s+/g, ' ');
  if (textoNormalizado.includes(fraseNormalizada)) return fraseLimpa;

  const padroesPorTipo = {
    'por que': [
      /durante\s+a\s+grande\s+tribula[çc][aã]o[^.]*\./gi,
      /talvez\s+seja\s+preciso[^.]*\./gi,
      /precisamos\s+[^.]*\./gi,
      /devemos\s+[^.]*\./gi,
      /vamos\s+ter\s+que[^.]*\./gi,
      /[eé]\s+importante[^.]*\./gi,
      /isso\s+(nos\s+)?ajud[^.]*\./gi,
      /jeov[aá]\s+[^.]*nos\s+[^.]*\./gi
    ],
    'como': [
      /podemos\s+[^.]*\./gi,
      /precisamos\s+[^.]*\./gi,
      /devemos\s+[^.]*\./gi,
      /[eé]\s+importante[^.]*\./gi,
      /quando\s+[^.]*fazemos[^.]*\./gi,
      /ao\s+[^.]*mostramos[^.]*\./gi
    ]
  };
  const tipoPergunta = pergunta.toLowerCase().includes('por que') ? 'por que' : 
                       pergunta.toLowerCase().includes('como') ? 'como' : 'por que';
  const padroes = padroesPorTipo[tipoPergunta];

  for (const regex of padroes) {
    const matches = rawText.match(regex);
    if (matches && matches.length > 0) {
      const frasesLimpas = matches.map(m => 
        m.replace(/\s*\([^)]*\)\s*/g, ' ')
         .replace(/\s+/g, ' ')
         .trim()
      ).filter(m => m.length > 30);
      if (frasesLimpas.length > 0) return frasesLimpas[0];
    }
  }
  return fraseLimpa.length > 20 ? fraseLimpa : null;
}

function extrairTextoLimpoCompleto(paragrafos) {
  let textoCompleto = '';
  paragrafos.forEach(paragrafo => {
    const clone = paragrafo.cloneNode(true);
    const referencias = clone.querySelectorAll('a.bbl');
    referencias.forEach(ref => {
      const textoRef = ref.textContent.trim();
      ref.outerHTML = ` __REF_${textoRef}__ `;
    });
    let texto = clone.textContent;
    texto = texto.replace(/__REF_[^_]*__/g, '');
    texto = texto.replace(/\s+/g, ' ').trim();
    if (texto) textoCompleto += texto + '\n\n';
  });
  return textoCompleto.trim();
}

function navegarParaParagrafo(numeroParagrafo) {
  const paragrafos = document.querySelectorAll('.paragrafo');
  for (const p of paragrafos) {
    const span = p.querySelector('span');
    if (span && span.textContent.trim() === numeroParagrafo) {
      p.classList.remove('paragrafo-destaque-sutil');
      void p.offsetWidth;
      const offset = p.getBoundingClientRect().top + window.pageYOffset - 100;
      window.scrollTo({ top: offset, behavior: 'smooth' });
      p.classList.add('paragrafo-destaque-sutil');
      setTimeout(() => p.classList.remove('paragrafo-destaque-sutil'), 2000);
      break;
    }
  }
}

function _normChar(ch) {
  const code = ch.charCodeAt(0);
  if (ch === '\u00A0' || /\s/.test(ch)) return ' ';
  if (ch === '"' || ch === '\u201C' || ch === '\u201D') return '"';
  if (ch === "'" || ch === '\u2018' || ch === '\u2019') return "'";
  return ch;
}

function _normalizedRun(raw) {
  const out = [];
  let i = 0, n = raw.length;
  while (i < n) {
    let ch = _normChar(raw[i]);
    if (ch === ' ') {
      const start = i;
      do { i++; } while (i < n && _normChar(raw[i]) === ' ');
      out.push({ ch: ' ', rawStart: start, rawEnd: i });
    } else {
      out.push({ ch, rawStart: i, rawEnd: i + 1 });
      i++;
    }
  }
  return out;
}

function _findNormalized(haystackRaw, needleRaw) {
  const H = _normalizedRun(haystackRaw);
  const N = _normalizedRun(needleRaw);
  const hay = H.map(x => x.ch).join('');
  const nee = N.map(x => x.ch).join('');
  const pos = hay.indexOf(nee);
  if (pos === -1) return null;
  const rawStart = H[pos].rawStart;
  const rawEnd   = H[pos + N.length - 1].rawEnd;
  return [rawStart, rawEnd];
}

function _buildTextIndex(scopeEl) {
  const walker = document.createTreeWalker(scopeEl, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeValue && n.nodeValue.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT)
  });
  const nodes = [], starts = [], lens = [];
  let full = '', pos = 0;
  while (walker.nextNode()) {
    const n = walker.currentNode, val = n.nodeValue;
    nodes.push(n); starts.push(pos); lens.push(val.length);
    full += val; pos += val.length;
  }
  return { nodes, starts, lens, fullText: full };
}

function _wrapGlobalRange_Recap(scopeEl, gStart, gEnd, className) {
  const { nodes, starts, lens } = _buildTextIndex(scopeEl);
  if (!nodes.length || gStart >= gEnd) return false;

  let created = false;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const nodeStart = starts[i];
    const nodeEnd = nodeStart + lens[i];

    const interStart = Math.max(gStart, nodeStart);
    const interEnd   = Math.min(gEnd, nodeEnd);
    if (interStart >= interEnd) continue;

    let localStart = interStart - nodeStart;
    let localEnd   = interEnd   - nodeStart;

    const slice = node.nodeValue.slice(localStart, localEnd);
    if (!slice.replace(/\s+/g, '').length) continue;

    if (node.parentNode && node.parentNode.tagName?.toLowerCase() === 'mark') {
      const classes = className.split(' ');
      classes.forEach(cls => {
        if (!node.parentNode.classList.contains(cls)) {
          node.parentNode.classList.add(cls);
        }
      });
      created = true;
      continue;
    }

    let mid = node;
    if (localStart > 0) { mid = mid.splitText(localStart); localEnd -= localStart; }
    if (localEnd < mid.nodeValue.length) mid.splitText(localEnd);

    const mark = document.createElement('mark');
    mark.className = className;
    mid.parentNode.replaceChild(mark, mid);
    mark.appendChild(mid);
    created = true;

    const prev = mark.previousSibling;
    if (prev && prev.nodeType === 1 && prev.tagName.toLowerCase() === 'mark') {
      const classes = className.split(' ');
      classes.forEach(cls => {
        if (!prev.classList.contains(cls)) {
          prev.classList.add(cls);
        }
      });
      while (mark.firstChild) prev.appendChild(mark.firstChild);
      mark.remove();
    }
  }

  scopeEl.normalize();
  return created;
}

function _findParenExclusions_FullText(fullText) {
  const ranges = [];
  const stack = [];
  const len = fullText.length;

  for (let i = 0; i < len; i++) {
    const ch = fullText[i];
    if (ch === '(') stack.push(i);
    else if (ch === ')') {
      if (!stack.length) continue;
      const start = stack.pop();
      // inclui espaços colados à esquerda do '(' e à direita do ')'
      let left = start;
      while (left > 0 && /\s/.test(fullText[left - 1])) left--;
      let right = i + 1;
      while (right < len && /\s/.test(fullText[right])) right++;
      ranges.push([left, right]);
    }
  }
  if (!ranges.length) return ranges;
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const p = merged[merged.length - 1], c = ranges[i];
    if (c[0] <= p[1]) p[1] = Math.max(p[1], c[1]); else merged.push(c);
  }
  return merged;
}

function _subtractExclusionsFromRange(start, end, exclusions) {
  // retorna subfaixas [s,e] resultantes de [start,end] - exclusions
  let segments = [[start, end]];
  for (const [exS, exE] of exclusions) {
    const next = [];
    for (const [s, e] of segments) {
      if (exE <= s || exS >= e) { next.push([s, e]); continue; }
      if (exS > s) next.push([s, exS]);
      if (exE < e) next.push([exE, e]);
    }
    segments = next;
    if (!segments.length) break;
  }
  // filtra vazios
  return segments.filter(([s, e]) => e - s > 0);
}

function _applyRangeWithExclusions_Recap(scopeEl, rawStart, rawEnd, className) {
  const { fullText } = _buildTextIndex(scopeEl);
  const exclusions = _findParenExclusions_FullText(fullText);
  const segments = _subtractExclusionsFromRange(rawStart, rawEnd, exclusions);
  if (!segments.length) return false;
  let any = false;
  for (const [s, e] of segments) {
    const ok = _wrapGlobalRange_Recap(scopeEl, s, e, className);
    any = any || ok;
  }
  return any;
}

function highlightLiteralMultiNode_Recap(scopeEl, textToHighlight, className) {
  if (!textToHighlight || !scopeEl) return false;

  // 1) tentativa rápida no mesmo nó (sem mexer)
  if (_highlightSingleNode_Recap(scopeEl, textToHighlight, className)) return true;

  // 2) busca faixa global normalizada
  const { fullText } = _buildTextIndex(scopeEl);
  const rangeRaw = _findNormalized(fullText, textToHighlight);
  if (!rangeRaw) return false;

  const [rawStart, rawEnd] = rangeRaw;

  // 3) APLICAÇÃO COM EXCLUSÕES DE PARÊNTESES (igual filosofia do mark.js)
  return _applyRangeWithExclusions_Recap(scopeEl, rawStart, rawEnd, className);
}

function _highlightSingleNode_Recap(node, textToHighlight, highlightClass) {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null, false);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  for (let i = 0; i < textNodes.length; i++) {
    const currentNode = textNodes[i];
    const txt = currentNode.nodeValue || "";
    const index = txt.indexOf(textToHighlight);
    if (index === -1) continue;

    if (currentNode.parentElement && currentNode.parentElement.tagName === 'MARK') {
      const classes = highlightClass.split(' ');
      classes.forEach(cls => {
        if (!currentNode.parentElement.classList.contains(cls)) {
          currentNode.parentElement.classList.add(cls);
        }
      });
      return true;
    }

    const range = document.createRange();
    range.setStart(currentNode, index);
    range.setEnd(currentNode, index + textToHighlight.length);

    const mark = document.createElement('mark');
    mark.className = highlightClass;
    try {
      range.surroundContents(mark);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

if (!document.getElementById('css-animacao-sutil')) {
  const cssAnimacaoSutil = document.createElement('style');
  cssAnimacaoSutil.id = 'css-animacao-sutil';
  cssAnimacaoSutil.textContent = `
    .paragrafo-destaque-sutil {
      animation: paragrafo-pulse-sutil 0.8s ease-in-out;
      background: rgba(0, 0, 0, 0.04);
      border-radius: 6px;
      padding: 8px;
      margin: -8px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.08);
    }

    @keyframes paragrafo-pulse-sutil {
      0% {
        background: transparent;
        box-shadow: none;
        transform: scale(1);
      }
      50% {
        background: rgba(0, 0, 0, 0.06);
        box-shadow: 0 0 15px rgba(0, 0, 0, 0.1);
        transform: scale(1.01);
      }
      100% {
        background: rgba(0, 0, 0, 0.04);
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.08);
        transform: scale(1);
      }
    }
  `;
  document.head.appendChild(cssAnimacaoSutil);
}