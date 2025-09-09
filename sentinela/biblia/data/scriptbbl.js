// scriptbbl.js - Versão CORRIGIDA com DOMContentLoaded + suporte a conteúdo dinâmico
// Baseada no código que funciona + correções para iPhone

document.addEventListener('DOMContentLoaded', () => {
  console.log('🟢 DOM carregado. Iniciando script da Bíblia...');

  // --- O "ROBÔ" QUE AMARRA OS LINKS (VERSÃO 2.0) ---
  function wrapBblLinks() {
    console.log('   -> Robô 2.0 iniciando: procurando links para amarrar...');
    
    if (!document.querySelector('#style-no-wrap')) {
      const style = document.createElement('style');
      style.id = 'style-no-wrap';
      style.textContent = '.no-wrap { white-space: nowrap; }';
      document.head.appendChild(style);
    }

    const processedParents = new Set(); 

    document.querySelectorAll('a.bbl').forEach(linkEl => {
      const parent = linkEl.parentNode;
      if (!parent || processedParents.has(parent)) {
        return; 
      }
      
      const regex = /\(\s*(<a class="bbl"[^>]*>.*?<\/a>)\s*\)/g;
      const originalHTML = parent.innerHTML;
      const newHTML = originalHTML.replace(regex, '<span class="no-wrap">($1)</span>');
      
      if (originalHTML !== newHTML) {
        parent.innerHTML = newHTML;
      }

      processedParents.add(parent);
    });
    console.log('   -> Robô 2.0 terminou o trabalho de amarração.');
  }
  // --- FIM DO ROBÔ ---

  if (typeof ABREVIACOES === 'undefined') {
    console.error("ERRO: O arquivo abrev.js não foi carregado. Verifique o caminho no HTML.");
    return;
  }
  
  let isModalOpen = false;

  function blockTextSelection() {
    document.body.classList.add('no-select-global');
  }

  function unblockTextSelection() {
    document.body.classList.remove('no-select-global');
  }

  // FUNÇÃO PARA ATIVAR LINKS EM CONTAINER ESPECÍFICO 
  function ativarLinksEmContainer(container) {
    console.log('🔗 Ativando links bíblicos no container:', container);
    
    container.querySelectorAll('.bbl').forEach(el => {
      // Evita ativar links já processados
      if (el.hasAttribute('data-bbl-ativo')) return;
      
      el.style.cursor = 'pointer';
      el.setAttribute('data-bbl-ativo', 'true');
      
      let pressTimer = null, moveTooMuch = false, startX = 0, startY = 0;

      el.addEventListener('touchstart', function(e) {
        if (e.touches.length > 1) return;
        moveTooMuch = false;
        blockTextSelection();
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        el.classList.add('pressionando');
        pressTimer = setTimeout(() => {
          if (!moveTooMuch) {
            el.classList.remove('pressionando');
            el.classList.add('ref-aberta');
            setTimeout(() => {
              abrirModalSeForRef(el);
              el.classList.remove('ref-aberta');
            }, 200);
          }
        }, 300);
      });

      el.addEventListener('touchmove', function(e) {
        const touch = e.touches[0];
        if (Math.abs(touch.clientX - startX) > 10 || Math.abs(touch.clientY - startY) > 10) {
          moveTooMuch = true;
          clearTimeout(pressTimer);
          el.classList.remove('pressionando');
        }
      });

      function resetAppearance() {
        clearTimeout(pressTimer);
        el.classList.remove('pressionando');
        el.classList.remove('ref-aberta');
        if (!isModalOpen) {
          setTimeout(() => { unblockTextSelection(); }, 50);
        }
      }

      el.addEventListener('touchend', resetAppearance);
      el.addEventListener('touchcancel', resetAppearance);
      el.addEventListener('contextmenu', e => e.preventDefault());
    });
  }

  // Aplica robô primeiro, depois ativa os links iniciais
  wrapBblLinks();
  ativarLinksEmContainer(document);

  const modal = document.getElementById('modal-biblia');
  const modalCorpo = document.getElementById('modal-biblia-corpo');
  const botaoFechar = document.getElementById('modal-biblia-fechar');
  const modalContent = document.querySelector('.modal-biblia-content');

  async function abrirModalBibl(referencia) {
    isModalOpen = true;
    blockTextSelection();
    modal.style.display = 'flex';
    document.body.style.overflow = "hidden";
    modalCorpo.innerHTML = '<h3>Carregando...</h3>';
    const resultado = await buscarVersiculo(referencia);
    modalCorpo.innerHTML = `<h3>${resultado.titulo}</h3><div>${resultado.texto}</div>`;
  }

  function abrirModalSeForRef(el) {
    const ref = el.textContent.trim();
    
    if (ref.includes(';')) {
      console.log('🎯 Detectadas múltiplas referências:', ref);
      abrirModalBibl(ref);
      return;
    }
    
    if (/^[1-3]?\s?[A-Za-zêÊãÃíÍóÓâÂéÉôÔúÚçÇ.]+\s\d+:[\d,\s-–—]+$/.test(ref) || /^[1-3]?\s?[A-Za-zêÊãÃíÍóÓâÂéÉôÔúÚçÇ.]+\s\d+:\d+\s*[\u2013\u2014-]\s*\d+:\d+$/.test(ref)) {
      abrirModalBibl(ref);
    }
  }

  function fecharModal() {
    modal.style.display = 'none';
    document.body.style.overflow = "";
    isModalOpen = false;
    setTimeout(() => { unblockTextSelection(); }, 100);
  }

  botaoFechar.addEventListener('click', fecharModal);
  modal.addEventListener('click', fecharModal);
  modalContent.addEventListener('click', e => e.stopPropagation());
  modalContent.addEventListener('touchstart', e => e.stopPropagation());
  window.addEventListener('keydown', e => { if (e.key === 'Escape') fecharModal(); });

  // FUNÇÃO PRINCIPAL - MELHORADA para ranges multi-capítulos
  async function buscarVersiculo(refString) {
    if (refString.includes(';')) {
      return await processarMultiplasReferencias(refString);
    }
    
    let multiCapMatch = refString.match(/^([1-3]?\s?[A-Za-zêÊãÃíÍóÓâÂéÉôÔúÚçÇ.]+)\s?(\d{1,3}):(\d{1,3})\s*[-–—]\s*(\d{1,3}):(\d{1,3})$/);
    let singleCapMatch = refString.match(/^([1-3]?\s?[A-Za-zêÊãÃíÍóÓâÂéÉôÔúÚçÇ.]+)\s?(\d{1,3}):([\d,\s-–—]+)/);

    if (!multiCapMatch && !singleCapMatch) {
      return { titulo: "Referência Inválida", texto: "Formato não reconhecido." };
    }
    
    const isMultiCap = !!multiCapMatch;
    const match = isMultiCap ? multiCapMatch : singleCapMatch;
    
    let nomeAbreviado = match[1].replace('.', '').trim();
    const nomeLivro = ABREVIACOES[nomeAbreviado] || nomeAbreviado.toLowerCase().replace(/\s/g, '');

    let dados;
    try {
      const resp = await fetch(`biblia/data/${nomeLivro}.json`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      dados = await resp.json();
    } catch (e) {
      console.error(`Erro ao buscar biblia/data/${nomeLivro}.json:`, e);
      return { titulo: "Livro não encontrado", texto: `O livro "${nomeLivro}" não foi encontrado.` };
    }

    let textoHtml = "";
    let versosColetados = [];

    if (isMultiCap) {
      // MELHORADO: Tratamento de ranges entre capítulos
      let capIni = parseInt(match[2]);
      let versIni = parseInt(match[3]);
      let capFim = parseInt(match[4]);
      let versFim = parseInt(match[5]);

      for (let c = capIni; c <= capFim; c++) {
        const capObj = dados.capitulos.find(chap => chap.capitulo === c);
        if (!capObj) continue;

        let versiculosParaBuscar = [];
        if (c === capIni && c === capFim) {
          // Mesmo capítulo: apenas versículos entre versIni e versFim
          versiculosParaBuscar = capObj.versiculos.filter(v => v.verso >= versIni && v.verso <= versFim);
        } else if (c === capIni) {
          // Primeiro capítulo: do versIni até o final
          versiculosParaBuscar = capObj.versiculos.filter(v => v.verso >= versIni);
        } else if (c === capFim) {
          // Último capítulo: do início até versFim
          versiculosParaBuscar = capObj.versiculos.filter(v => v.verso <= versFim);
        } else {
          // Capítulos intermediários: todos os versículos
          versiculosParaBuscar = capObj.versiculos;
        }
        
        versosColetados.push(...versiculosParaBuscar.map(v => ({...v, capitulo: c}) ));
      }
    } else {
      // Tratamento para capítulo único (mantido original)
      const capituloNum = parseInt(match[2]);
      const capObj = dados.capitulos.find(c => c.capitulo === capituloNum);
      if (!capObj) return { titulo: "Não Encontrado", texto: `Capítulo ${capituloNum} não encontrado.` };
      
      const listaVersiculosStr = match[3].split(',').map(v => v.trim());

      listaVersiculosStr.forEach(item => {
        if (item.includes('-')) {
          const [ini, fim] = item.split('-').map(Number);
          versosColetados.push(...capObj.versiculos.filter(v => v.verso >= ini && v.verso <= fim));
        } else {
          const versoNum = Number(item);
          const verso = capObj.versiculos.find(v => v.verso === versoNum);
          if (verso) versosColetados.push(verso);
        }
      });
    }

    if (versosColetados.length > 0) {
      const capitulosPresentes = new Set();
      versosColetados.forEach(verso => {
        if (verso.capitulo) {
          capitulosPresentes.add(verso.capitulo);
        }
      });
      
      const temMultiplosCapitulos = capitulosPresentes.size > 1;
      
      if (temMultiplosCapitulos) {
        // MELHORADO: Formatação para múltiplos capítulos
        textoHtml = "";
        let capituloAtual = null;
        let paragrafoAtual = "";
        
        versosColetados.forEach((verso, index) => {
          const numeroCapitulo = verso.capitulo;
          const numeroVerso = verso.verso;
          
          // Nova seção de capítulo
          if (numeroCapitulo !== capituloAtual) {
            // Finaliza parágrafo anterior se existir
            if (paragrafoAtual) {
              textoHtml += `<p>${paragrafoAtual}</p>`;
              paragrafoAtual = "";
            }
            
            // Adiciona separador entre capítulos (exceto no primeiro)
            if (capituloAtual !== null) {
              textoHtml += '<div style="margin: 20px 0 15px 0; border-top: 2px solid #ddd; padding-top: 15px;"></div>';
            }
            
            // Cabeçalho do capítulo
            textoHtml += `<div style="margin-bottom: 12px;"><strong style="font-style: italic; color: #666; font-size: 1.1em;">Capítulo ${numeroCapitulo}</strong></div>`;
            capituloAtual = numeroCapitulo;
          }
          
          // Lógica de parágrafo respeitando novo_paragrafo
          if (verso.novo_paragrafo && paragrafoAtual) {
            // Finaliza parágrafo atual e inicia novo
            textoHtml += `<p>${paragrafoAtual}</p>`;
            paragrafoAtual = `<strong>${numeroVerso}</strong> ${verso.texto}`;
          } else {
            // Continua no parágrafo atual
            if (paragrafoAtual) {
              paragrafoAtual += ` <strong>${numeroVerso}</strong> ${verso.texto}`;
            } else {
              paragrafoAtual = `<strong>${numeroVerso}</strong> ${verso.texto}`;
            }
          }
        });
        
        // Finaliza último parágrafo
        if (paragrafoAtual) {
          textoHtml += `<p>${paragrafoAtual}</p>`;
        }
      } else {
        // Capítulo único (mantém lógica original)
        let paragrafoAtual = "";
        
        versosColetados.forEach((verso, index) => {
          const numeroVerso = verso.verso;

          if (index > 0 && verso.novo_paragrafo) {
            textoHtml += `<p>${paragrafoAtual}</p>`;
            paragrafoAtual = `<strong>${numeroVerso}</strong> ${verso.texto}`;
          } else {
            if (paragrafoAtual) {
              paragrafoAtual += ` <strong>${numeroVerso}</strong> ${verso.texto}`;
            } else {
              paragrafoAtual = `<strong>${numeroVerso}</strong> ${verso.texto}`;
            }
          }
        });
        
        if (paragrafoAtual) {
          textoHtml += `<p>${paragrafoAtual}</p>`;
        }
      }
    }

    const nomeLivroFormatado = dados.nome_do_livro || nomeLivro.charAt(0).toUpperCase() + nomeLivro.slice(1);
    const tituloRef = isMultiCap ? `${nomeLivroFormatado} ${multiCapMatch[2]}:${multiCapMatch[3]}-${multiCapMatch[4]}:${multiCapMatch[5]}` : `${nomeLivroFormatado} ${singleCapMatch[2]}:${singleCapMatch[3]}`;
    
    return {
      titulo: tituloRef,
      texto: textoHtml || "Versículo(s) não encontrado(s)."
    };
  }

  async function processarMultiplasReferencias(refString) {
    const referenciasExpandidas = expandirReferenciasComplexas(refString);
    const referencias = referenciasExpandidas.split(';').map(ref => ref.trim()).filter(ref => ref.length > 0);
    
    if (referencias.length === 0) {
      return { titulo: "Referência Inválida", texto: "Nenhuma referência válida encontrada." };
    }

    let resultadosCompletos = [];
    let nomeLivroBase = '';
    let titulosParaMostrar = [];

    for (let i = 0; i < referencias.length; i++) {
      let refAtual = referencias[i].trim();
      
      if (i > 0 && /^\d+:[\d,\s-–—]+$/.test(refAtual)) {
        const primeiraRef = referencias[0];
        const matchPrimeiraRef = primeiraRef.match(/^([1-3]?\s?[A-Za-zêÊãÃíÍóÓâÂéÉôÔúÚçÇ.]+)\s/);
        if (matchPrimeiraRef) {
          refAtual = matchPrimeiraRef[1] + ' ' + refAtual;
        }
      }

      const resultado = await buscarVersiculo(refAtual);
      
      if (resultado.titulo !== "Referência Inválida" && resultado.titulo !== "Não Encontrado" && resultado.titulo !== "Livro não encontrado") {
        resultadosCompletos.push({
          titulo: resultado.titulo,
          texto: resultado.texto
        });
        
        const tituloMatch = resultado.titulo.match(/(\d+:[\d,\s-–—]+)/);
        if (tituloMatch) {
          titulosParaMostrar.push(tituloMatch[1]);
        } else {
          titulosParaMostrar.push(resultado.titulo);
        }

        if (nomeLivroBase === '') {
          const livroMatch = resultado.titulo.match(/^([^0-9]+)/);
          if (livroMatch) {
            nomeLivroBase = livroMatch[1].trim();
          }
        }
      }
    }

    if (resultadosCompletos.length === 0) {
      return { titulo: "Referências Inválidas", texto: "Nenhuma das referências pôde ser encontrada." };
    }

    const capitulosUnicos = new Set();
    resultadosCompletos.forEach(resultado => {
      const matchCap = resultado.titulo.match(/(\d+):/);
      if (matchCap) {
        capitulosUnicos.add(parseInt(matchCap[1]));
      }
    });
    
    const temMultiplosCapitulos = capitulosUnicos.size > 1;

    const tituloFinal = nomeLivroBase + ' ' + titulosParaMostrar.join('; ');
    
    let textoFinal = '';
    let capituloAtual = null;
    let capitulosJaMostrados = new Set();
    
    resultadosCompletos.forEach((resultado, index) => {
      const matchCap = resultado.titulo.match(/(\d+):/);
      const numeroCapitulo = matchCap ? parseInt(matchCap[1]) : null;
      
      if (temMultiplosCapitulos && numeroCapitulo !== capituloAtual && !capitulosJaMostrados.has(numeroCapitulo)) {
        if (index > 0) {
          textoFinal += '<div style="margin: 20px 0 15px 0; border-top: 2px solid #ddd; padding-top: 15px;"></div>';
        }
        textoFinal += `<div style="margin-bottom: 12px;"><strong style="font-style: italic; color: #666; font-size: 1.1em;">Capítulo ${numeroCapitulo}</strong></div>`;
        capitulosJaMostrados.add(numeroCapitulo);
        capituloAtual = numeroCapitulo;
      } else if (!temMultiplosCapitulos && index > 0) {
        textoFinal += '<div style="margin-top: 15px; border-top: 1px solid #ddd; padding-top: 10px;"></div>';
      } else if (temMultiplosCapitulos && index > 0 && numeroCapitulo !== capituloAtual) {
        textoFinal += '<div style="margin: 15px 0 10px 0;"></div>';
      }
      
      textoFinal += resultado.texto;
    });

    return {
      titulo: tituloFinal,
      texto: textoFinal
    };
  }

  function expandirReferenciasComplexas(refString) {
    const partes = refString.split(';');
    let partesExpandidas = [];
    
    partes.forEach(parte => {
      parte = parte.trim();
      
      if (parte.includes(',')) {
        const livroMatch = parte.match(/^([1-3]?\s?[A-Za-zêÊãÃíÍóÓâÂéÉôÔúÚçÇ.]+)\s/);
        const nomelivro = livroMatch ? livroMatch[1] : '';
        
        const segmentos = parte.split(',').map(s => s.trim());
        
        segmentos.forEach(segmento => {
          if (/^\d+/.test(segmento) && nomelivro) {
            partesExpandidas.push(nomelivro + ' ' + segmento);
          } else {
            partesExpandidas.push(segmento);
          }
        });
      } else {
        partesExpandidas.push(parte);
      }
    });
    
    return partesExpandidas.join('; ');
  }

  // EXPÕE A FUNÇÃO GLOBALMENTE PARA USO EM CONTEÚDO DINÂMICO
  window.ativarLinksBiblicos = ativarLinksEmContainer;
  
  console.log('✅ scriptbbl.js inicializado com sucesso!');
});