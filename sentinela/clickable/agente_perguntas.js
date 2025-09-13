/* agente_perguntas.js — v3.1-multipart-otimizado */

async function gerarRespostaIA(idPergunta, wrapperElement, idRespostaIA) {
  const perguntaEl = document.getElementById(idPergunta);
  const paragrafosAssociados = document.querySelectorAll(`[data-question-id="${idPergunta}"]`);
  const respostaEl = document.getElementById(idRespostaIA);

  if (!perguntaEl || paragrafosAssociados.length === 0 || !respostaEl) {
    return;
  }

  paragrafosAssociados.forEach(p => {
    p.querySelectorAll('mark.ia-highlight, mark.ia-highlight-b').forEach(mark => {
      const parent = mark.parentNode;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
    });
    p.normalize();
  });

  wrapperElement.classList.add('ia-loading');
  respostaEl.innerHTML = '<span style="color:#9ca3af;">Analisando e gerando resposta...</span>';

  const perguntaCompleta = perguntaEl.textContent.trim();
  const textoLimpo = extrairTextoLimpo(paragrafosAssociados);
  const partesDetectadas = detectarPartesMultiplas(perguntaCompleta);
  const isMultiPart = partesDetectadas.length > 1;

  const GEMINI_MODEL = 'gemini-2.5-flash';
  const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const API_KEY = "AIzaSyBnBn9u3GX6KqJSU6QvZiP0Gor3Vb7UMN4";

  const sistemaInstrucaoMultiParte = `
Você é um especialista em análise textual bíblica. Sua tarefa é responder ESPECIFICAMENTE à pergunta fornecida.

**REGRAS CRÍTICAS PARA PERGUNTAS MULTI-PARTE:**
1) Responda APENAS à pergunta específica fornecida - não inclua informações de outras partes
2) Se a pergunta é sobre "Por que alguns estudantes...", foque APENAS nos motivos/razões
3) Se a pergunta é sobre "O que vamos ver...", foque APENAS no que será abordado/estudado
4) NÃO misture conteúdos de diferentes partes da pergunta

**Para "frases_para_marcar"**: 
- Extraia APENAS trechos que respondem DIRETAMENTE à pergunta específica
- CORTE antes de referências bíblicas como "(Mat. 13:20)"
- RETOME depois da referência se necessário
- Uma frase = uma oração completa que responde à pergunta

**SAÍDA JSON OBRIGATÓRIA:**
{
  "resposta_para_caixa": "resposta natural e específica",
  "frases_para_marcar": ["trecho literal que responde especificamente à pergunta"]
}
`;

  const sistemaInstrucaoSimples = `
Você é um especialista em análise textual bíblica. Sua tarefa é extrair TODAS as informações relevantes do parágrafo para responder à pergunta.

**REGRAS CRÍTICAS:**
1) A pergunta pode ter múltiplas partes implícitas. Por exemplo: "O que Jesus disse?" pode incluir VÁRIAS declarações de Jesus no mesmo parágrafo.

2) IDENTIFIQUE CONECTORES que indicam informações adicionais:
   - "também disse/falou"
   - "além disso" 
   - "depois/em seguida"
   - "então"
   - "por isso"
   - "e" (quando conecta ações similares)

3) Para "frases_para_marcar": extraia TRECHOS LITERAIS completos, mas:
   - CORTE antes de referências bíblicas como "(Luc. 21:20)"
   - RETOME depois da referência
   - Mantenha a sequência original
   - Uma frase = uma oração completa

4) Para "resposta_para_caixa": seja natural e orgânico, mas COMPLETE. Não corte informações importantes.

**SAÍDA JSON OBRIGATÓRIA:**
{
  "resposta_para_caixa": "resposta natural e completa",
  "frases_para_marcar": ["trecho literal 1", "trecho literal 2"]
}
`;

  async function fetchIaResponse(subPerguntaFoco, isMultiPartMode = false) {
    const sistemaInstrucao = isMultiPartMode ? sistemaInstrucaoMultiParte : sistemaInstrucaoSimples;
    
    const body = {
      contents: [{ parts: [{ text: `${sistemaInstrucao}\n\nPARÁGRAFO COMPLETO:\n${textoLimpo}\n\nPERGUNTA ESPECÍFICA:\n${subPerguntaFoco}` }] }],
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
    try { return JSON.parse(txt); } catch { throw new Error('Formato inesperado da IA.'); }
  }

  function validarCompletudeEspecifica(frases, rawText, perguntaEspecifica, tipoParte) {
    if (!Array.isArray(frases)) return [];
    
    if (tipoParte) {
      let frasesValidadas = frases.filter(frase => {
        const fraseNorm = frase.toLowerCase();
        const perguntaNorm = perguntaEspecifica.toLowerCase();
        
        if (tipoParte === 'por_que' && perguntaNorm.includes('por que')) {
          return fraseNorm.includes('medo') || fraseNorm.includes('preocupado') || 
                 fraseNorm.includes('receio') || fraseNorm.includes('difícil') ||
                 fraseNorm.includes('porque') || fraseNorm.includes('razão') ||
                 fraseNorm.includes('motivo') || fraseNorm.includes('sensação') ||
                 fraseNorm.includes('conseguiria') || fraseNorm.includes('talvez');
        }
        
        if (tipoParte === 'o_que_vamos_ver' && perguntaNorm.includes('vamos ver')) {
          return fraseNorm.includes('vamos') || fraseNorm.includes('estudo') || 
                 fraseNorm.includes('ver') || fraseNorm.includes('abordar') ||
                 fraseNorm.includes('aprender') || fraseNorm.includes('examinar') ||
                 fraseNorm.includes('considerar') || fraseNorm.includes('imitar');
        }
        
        return true;
      });

      if (tipoParte === 'por_que' && frasesValidadas.length > 0) {
        const conectoresAlternativos = [
          /ou\s+talvez[^.]*\./gi,
          /ou\s+então[^.]*\./gi,
          /ou\s+pode\s+ser[^.]*\./gi,
          /talvez[^.]*\./gi
        ];

        conectoresAlternativos.forEach(regex => {
          const matches = rawText.match(regex);
          if (matches) {
            matches.forEach(match => {
              const jaTem = frasesValidadas.some(f => {
                const fNorm = f.toLowerCase().replace(/\s+/g, ' ');
                const mNorm = match.toLowerCase().replace(/\s+/g, ' ');
                return mNorm.includes(fNorm) || fNorm.includes(mNorm);
              });
              if (!jaTem) {
                const fraseLimpa = match.trim().replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ');
                if (fraseLimpa.includes('talvez') || fraseLimpa.includes('medo') || 
                    fraseLimpa.includes('sensação') || fraseLimpa.includes('conseguiria')) {
                  frasesValidadas.push(fraseLimpa);
                }
              }
            });
          }
        });
      }

      return frasesValidadas;
    }
    
    return validarCompletudeResposta(frases, rawText, perguntaEspecifica);
  }

  try {
    let respostaFinalTexto = '';
    let frasesParaMarcar = {};

    if (isMultiPart) {
      const resultados = [];
      for (let i = 0; i < partesDetectadas.length; i++) {
        const parte = partesDetectadas[i];
        const tipoParte = determinarTipoParte(parte.pergunta);
        
        const resultado = await fetchIaResponse(parte.pergunta, true);
        
        const frasesValidadas = validarCompletudeEspecifica(
          resultado.frases_para_marcar || [], 
          textoLimpo, 
          parte.pergunta,
          tipoParte
        );
        
        resultados.push({
          letra: parte.letra,
          resposta: resultado.resposta_para_caixa || '',
          frases: frasesValidadas
        });
      }
      
      resultados.forEach((resultado, index) => {
        respostaFinalTexto += `(${resultado.letra}) ${resultado.resposta}`;
        if (index < resultados.length - 1) respostaFinalTexto += '\n\n';
        
        const cor = resultado.letra === 'a' ? 'amarelo' : 'verde';
        if (!frasesParaMarcar[cor]) frasesParaMarcar[cor] = [];
        frasesParaMarcar[cor].push(...resultado.frases);
      });
      
    } else {
      const resultado = await fetchIaResponse(perguntaCompleta, false);
      const frasesValidadas = validarCompletudeResposta(resultado.frases_para_marcar || [], textoLimpo, perguntaCompleta);
      
      respostaFinalTexto = resultado.resposta_para_caixa || '';
      frasesParaMarcar.amarelo = frasesValidadas;
    }

    if (frasesParaMarcar.amarelo?.length) {
      frasesParaMarcar.amarelo.forEach(frase => {
        paragrafosAssociados.forEach(p => highlightLiteralMultiNode(p, frase, 'ia-highlight'));
      });
    }
    if (frasesParaMarcar.verde?.length) {
      frasesParaMarcar.verde.forEach(frase => {
        paragrafosAssociados.forEach(p => highlightLiteralMultiNode(p, frase, 'ia-highlight-b'));
      });
    }

    respostaEl.textContent = respostaFinalTexto || '❌ Resposta não gerada.';

    if (window.CacheAnotacao) {
      window.CacheAnotacao.salvar(idRespostaIA, respostaEl.textContent);
      paragrafosAssociados.forEach(p => { if (p.id) window.CacheAnotacao.salvar(p.id, p.innerHTML); });
    }
  } catch (erro) {
    respostaEl.textContent = `❌ Erro: ${erro.message}.`;
  } finally {
    wrapperElement.classList.remove('ia-loading');
  }
}

function detectarPartesMultiplas(perguntaCompleta) {
  const partes = [];
  const regex = /\(([a-z])\)\s*([^(]*?)(?=\([a-z]\)|$)/gi;
  let match;
  
  while ((match = regex.exec(perguntaCompleta)) !== null) {
    const letra = match[1];
    const pergunta = match[2].trim();
    if (pergunta) {
      partes.push({ letra, pergunta });
    }
  }
  
  return partes;
}

function determinarTipoParte(pergunta) {
  const perguntaLower = pergunta.toLowerCase();
  
  if (perguntaLower.includes('por que') || perguntaLower.includes('por que')) {
    return 'por_que';
  }
  if (perguntaLower.includes('o que vamos ver') || perguntaLower.includes('que vamos ver')) {
    return 'o_que_vamos_ver';
  }
  if (perguntaLower.includes('como')) {
    return 'como';
  }
  if (perguntaLower.includes('quando')) {
    return 'quando';
  }
  if (perguntaLower.includes('onde')) {
    return 'onde';
  }
  
  return 'geral';
}

function validarCompletudeResposta(frases, rawText, pergunta) {
  const out = Array.isArray(frases) ? [...frases] : [];
  
  const conectoresImportantes = [
    /jesus\s+tamb[eé]m\s+(disse|falou|avisou)[^.]*\./gi,
    /al[eé]m\s+disso[^.]*\./gi,
    /depois[^.]*\./gi,
    /em\s+seguida[^.]*\./gi,
    /ent[aã]o[^.]*\./gi,
    /por\s+isso[^.]*\./gi
  ];

  conectoresImportantes.forEach(regex => {
    const matches = rawText.match(regex);
    if (matches) {
      matches.forEach(match => {
        const jaTem = out.some(f => {
          const fNorm = f.toLowerCase().replace(/\s+/g, ' ');
          const mNorm = match.toLowerCase().replace(/\s+/g, ' ');
          return mNorm.includes(fNorm) || fNorm.includes(mNorm);
        });
        if (!jaTem) {
          const fraseLimpa = match.trim().replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ');
          out.push(fraseLimpa);
        }
      });
    }
  });

  if (/o\s+que.*?disse|o\s+que.*?falou/i.test(pergunta)) {
    const declaracoes = rawText.match(/[^.]*?(disse|falou|avisou)[^.]*\./gi);
    if (declaracoes && declaracoes.length > 1) {
      declaracoes.forEach(decl => {
        const jaTem = out.some(f => decl.toLowerCase().includes(f.toLowerCase()));
        if (!jaTem) {
          const declLimpa = decl.trim().replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ');
          out.push(declLimpa);
        }
      });
    }
  }

  return Array.from(new Set(out));
}

function extrairTextoLimpo(paragrafosAssociados) {
  let textoCompleto = '';
  
  paragrafosAssociados.forEach(paragrafo => {
    const clone = paragrafo.cloneNode(true);
    
    const referencias = clone.querySelectorAll('a.bbl');
    referencias.forEach(ref => {
      const textoRef = ref.textContent.trim();
      ref.outerHTML = ` __REF_${textoRef}__ `;
    });
    
    let texto = clone.textContent;
    texto = texto.replace(/__REF_[^_]*__/g, '');
    texto = texto.replace(/\s+/g, ' ');
    texto = texto.trim();
    
    textoCompleto += texto + '\n\n';
  });
  
  return textoCompleto.trim();
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

function _wrapGlobalRange(scopeEl, gStart, gEnd, className) {
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
      node.parentNode.classList.add(className);
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
  return segments.filter(([s, e]) => e - s > 0);
}

function _applyRangeWithExclusions(scopeEl, rawStart, rawEnd, className) {
  const { fullText } = _buildTextIndex(scopeEl);
  const exclusions = _findParenExclusions_FullText(fullText);
  const segments = _subtractExclusionsFromRange(rawStart, rawEnd, exclusions);
  if (!segments.length) return false;
  let any = false;
  for (const [s, e] of segments) {
    const ok = _wrapGlobalRange(scopeEl, s, e, className);
    any = any || ok;
  }
  return any;
}

function highlightLiteralMultiNode(scopeEl, textToHighlight, className) {
  if (!textToHighlight || !scopeEl) return false;
  if (_highlightSingleNode(scopeEl, textToHighlight, className)) return true;

  const { fullText } = _buildTextIndex(scopeEl);
  const rangeRaw = _findNormalized(fullText, textToHighlight);
  if (!rangeRaw) return false;

  const [rawStart, rawEnd] = rangeRaw;
  return _applyRangeWithExclusions(scopeEl, rawStart, rawEnd, className);
}

function _highlightSingleNode(node, textToHighlight, highlightClass) {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null, false);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  for (let i = 0; i < textNodes.length; i++) {
    const currentNode = textNodes[i];
    const txt = currentNode.nodeValue || "";
    const index = txt.indexOf(textToHighlight);
    if (index === -1) continue;

    if (currentNode.parentElement && currentNode.parentElement.tagName === 'MARK') {
      currentNode.parentElement.classList.add(highlightClass);
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