/* agente_perguntas.js — v3.0-inteligente
   - Prompt reformulado para capturar TODAS as ações/declarações
   - Pré-processamento do texto para limpar referências bíblicas
   - Pós-validação mais robusta para conectores
   - Modelo: gemini-2.5-flash (rápido)
   - Marca LITERAL atravessando múltiplos nós
*/

async function gerarRespostaIA(idPergunta, wrapperElement, idRespostaIA) {
  const perguntaEl = document.getElementById(idPergunta);
  const paragrafosAssociados = document.querySelectorAll(`[data-question-id="${idPergunta}"]`);
  const respostaEl = document.getElementById(idRespostaIA);

  if (!perguntaEl || paragrafosAssociados.length === 0 || !respostaEl) {
    console.warn(`Elementos essenciais não encontrados para a pergunta: ${idPergunta}`);
    return;
  }

  // 1) Limpa marcações anteriores do Agente 1
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
  
  // === NOVO: PRÉ-PROCESSAMENTO INTELIGENTE DO TEXTO ===
  const textoLimpo = extrairTextoLimpo(paragrafosAssociados);
  const isMultiPart = perguntaCompleta.includes('(a)') && perguntaCompleta.includes('(b)');

  // =======================
  //   GEMINI 2.5 FLASH
  // =======================
  const GEMINI_MODEL = 'gemini-2.5-flash';
  const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const API_KEY = "AIzaSyBnBn9u3GX6KqJSU6QvZiP0Gor3Vb7UMN4";

  // ========== PROMPT REFORMULADO E MAIS INTELIGENTE ==========
  const sistemaInstrucao = `
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

**EXEMPLO:**
Texto: "Ele avisou que X. (Luc. 21:20) Jesus também disse que Y."
Pergunta: "O que Jesus disse?"
Resposta deve incluir TANTO X quanto Y.

**SAÍDA JSON OBRIGATÓRIA:**
{
  "resposta_para_caixa": "resposta natural e completa",
  "frases_para_marcar": ["trecho literal 1", "trecho literal 2"]
}
`;

  async function fetchIaResponse(subPerguntaFoco) {
    const body = {
      contents: [{ parts: [{ text: `${sistemaInstrucao}\n\nPARÁGRAFO COMPLETO:\n${textoLimpo}\n\nPERGUNTA:\n${subPerguntaFoco}` }] }],
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

  // ========== PÓS-VALIDAÇÃO MELHORADA ==========
  function validarCompletudeResposta(frases, rawText, pergunta) {
    const out = Array.isArray(frases) ? [...frases] : [];
    const textoNormalizado = rawText.toLowerCase();
    
    // Padrões que indicam múltiplas declarações/ações
    const conectoresImportantes = [
      /jesus\s+tamb[eé]m\s+(disse|falou|avisou)[^.]*\./gi,
      /al[eé]m\s+disso[^.]*\./gi,
      /depois[^.]*\./gi,
      /em\s+seguida[^.]*\./gi,
      /ent[aã]o[^.]*\./gi,
      /por\s+isso[^.]*\./gi
    ];

    // Verifica se algum conector importante foi perdido
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
            // Limpa a frase antes de adicionar
            const fraseLimpa = match.trim().replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ');
            out.push(fraseLimpa);
          }
        });
      }
    });

    // Para perguntas sobre "o que disse/falou", garante múltiplas declarações
    if (/o\s+que.*?disse|o\s+que.*?falou/i.test(pergunta)) {
      // Procura por padrões de múltiplas declarações
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

    return Array.from(new Set(out)); // Remove duplicatas exatas
  }

  try {
    let respostaFinalTexto = '';
    let frasesParaMarcarAmarelo = [];
    let frasesParaMarcarVerde  = [];

    if (isMultiPart) {
      const [perguntaA, perguntaB] = perguntaCompleta.split('(b)');
      const resultadoA = await fetchIaResponse(perguntaA.replace('(a)', '').trim());
      const resultadoB = await fetchIaResponse(`(b) ${perguntaB.trim()}`);

      frasesParaMarcarAmarelo = validarCompletudeResposta(resultadoA.frases_para_marcar || [], textoLimpo, perguntaA);
      frasesParaMarcarVerde   = validarCompletudeResposta(resultadoB.frases_para_marcar || [], textoLimpo, perguntaB);

      respostaFinalTexto = `(a) ${resultadoA.resposta_para_caixa || ''}\n\n(b) ${resultadoB.resposta_para_caixa || ''}`.trim();
    } else {
      const resultado = await fetchIaResponse(perguntaCompleta);
      frasesParaMarcarAmarelo = validarCompletudeResposta(resultado.frases_para_marcar || [], textoLimpo, perguntaCompleta);
      respostaFinalTexto = resultado.resposta_para_caixa || '';
    }

    // ========== MARCAÇÃO — MULTINÓ ==========
    if (frasesParaMarcarAmarelo.length) {
      frasesParaMarcarAmarelo.forEach(frase => {
        paragrafosAssociados.forEach(p => highlightLiteralMultiNode(p, frase, 'ia-highlight'));
      });
    }
    if (frasesParaMarcarVerde.length) {
      frasesParaMarcarVerde.forEach(frase => {
        paragrafosAssociados.forEach(p => highlightLiteralMultiNode(p, frase, 'ia-highlight-b'));
      });
    }

    // ========== Resposta natural ==========
    respostaEl.textContent = respostaFinalTexto || '❌ Resposta não gerada.';

    // Cache opcional
    if (window.CacheAnotacao) {
      window.CacheAnotacao.salvar(idRespostaIA, respostaEl.textContent);
      paragrafosAssociados.forEach(p => { if (p.id) window.CacheAnotacao.salvar(p.id, p.innerHTML); });
    }
  } catch (erro) {
    console.error("Erro no processo da IA para a pergunta " + idPergunta + ":", erro);
    respostaEl.textContent = `❌ Erro: ${erro.message}.`;
  } finally {
    wrapperElement.classList.remove('ia-loading');
  }
}

// ========== NOVA FUNÇÃO: EXTRAÇÃO DE TEXTO LIMPO ==========
function extrairTextoLimpo(paragrafosAssociados) {
  let textoCompleto = '';
  
  paragrafosAssociados.forEach(paragrafo => {
    // Clona o elemento para não modificar o original
    const clone = paragrafo.cloneNode(true);
    
    // Remove ou substitui elementos <a class="bbl"> por um marcador especial
    const referencias = clone.querySelectorAll('a.bbl');
    referencias.forEach(ref => {
      const textoRef = ref.textContent.trim();
      // Substitui por um marcador que será removido depois
      ref.outerHTML = ` __REF_${textoRef}__ `;
    });
    
    // Pega o texto e limpa os marcadores de referência
    let texto = clone.textContent;
    texto = texto.replace(/__REF_[^_]*__/g, ''); // Remove marcadores
    texto = texto.replace(/\s+/g, ' '); // Normaliza espaços
    texto = texto.trim();
    
    textoCompleto += texto + '\n\n';
  });
  
  return textoCompleto.trim();
}

/* ============================
   MARCAÇÃO MULTINÓ (mantida igual, com PATCH de exclusões)
   ============================ */

/** Normaliza caractere para busca tolerante (aspas retas/curvas e espaços) */
function _normChar(ch) {
  const code = ch.charCodeAt(0);
  if (ch === '\u00A0' || /\s/.test(ch)) return ' ';
  if (ch === '"' || ch === '\u201C' || ch === '\u201D') return '"';
  if (ch === "'" || ch === '\u2018' || ch === '\u2019') return "'";
  return ch;
}

/** Itera string "raw", colapsando runs de espaço e mapeando aspas */
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

/** Busca `needle` normalizado dentro de `haystack` normalizado */
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

/** Indexa text nodes do escopo */
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

/** Envolve [gStart, gEnd) em múltiplos nós com <mark class=className> */
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

/* =========================
   NOVO: exclusões por parênteses (igual recap)
   ========================= */
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

/** Fast-path (nó único) + fallback multinó COM EXCLUSÕES DE PARÊNTESES */
function highlightLiteralMultiNode(scopeEl, textToHighlight, className) {
  if (!textToHighlight || !scopeEl) return false;
  if (_highlightSingleNode(scopeEl, textToHighlight, className)) return true;

  const { fullText } = _buildTextIndex(scopeEl);
  const rangeRaw = _findNormalized(fullText, textToHighlight);
  if (!rangeRaw) return false;

  const [rawStart, rawEnd] = rangeRaw;
  // APLICA a faixa “inteira”, mas subtraindo ( ... ) + espaços colados
  return _applyRangeWithExclusions(scopeEl, rawStart, rawEnd, className);
}

/** Implementação antiga (nó único) — compatibilidade */
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