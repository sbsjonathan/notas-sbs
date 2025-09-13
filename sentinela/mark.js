// mark.js — VERSÃO CORRIGIDA FINAL

const CONFIG = {
  SELECTOR_SCOPE: '.paragrafo',
  BBL_SELECTOR: 'a.bbl',
  MARK_TAG: 'mark',
  DOUBLE_TAP_MS: 280,
  ALLOW_MARK_INSIDE_BBL: false
};

(function () {
  const { SELECTOR_SCOPE, BBL_SELECTOR, MARK_TAG, DOUBLE_TAP_MS, ALLOW_MARK_INSIDE_BBL } = CONFIG;

  const $all = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const isEl = (n) => n && n.nodeType === 1;

  let SUPPRESS_UNTIL = 0;
  const shouldSuppress = () => Date.now() < SUPPRESS_UNTIL;
  const triggerSuppress = (ms = 360) => { SUPPRESS_UNTIL = Date.now() + ms; };

  function saveParagraphState(p) {
    if (window.CacheAnotacao && p && p.id) {
      window.CacheAnotacao.salvar(p.id, p.innerHTML);
    }
  }

  function isInBBL(node) {
    const el = node && (node.nodeType === 1 ? node : node.parentNode);
    return el?.closest?.(BBL_SELECTOR);
  }

  function mergePair(second) {
    const first = second.previousSibling;
    if (!first || first.nodeName !== second.nodeName) return;
    while (second.firstChild) first.appendChild(second.firstChild);
    second.remove();
  }

  function normalizeTextNodes(parent) {
    if (parent && isEl(parent)) {
      parent.normalize();
    }
  }

  function removeHighlight(markEl) {
    if (!markEl || markEl.tagName?.toLowerCase() !== MARK_TAG) return false;
    const parent = markEl.parentNode;
    const paragraphScope = parent.closest(SELECTOR_SCOPE);

    while (markEl.firstChild) parent.insertBefore(markEl.firstChild, markEl);
    parent.removeChild(markEl);
    if (parent && isEl(parent)) {
      $all(`${MARK_TAG} + ${MARK_TAG}`, parent).forEach(mergePair);
      normalizeTextNodes(parent);
    }
    
    if (paragraphScope) {
      saveParagraphState(paragraphScope);
    }
    
    return true;
  }

  function buildTextIndex(scopeEl) {
    const walker = document.createTreeWalker(scopeEl, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        node.nodeValue && node.nodeValue.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
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

  function findParenExclusions(fullText) {
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

  function findPuncExclusions(fullText) {
    const ranges = [];
    const regex = /\d[.;]/g;
    let match;
    while ((match = regex.exec(fullText)) !== null) {
      const puncStartIndex = match.index + 1;
      ranges.push([puncStartIndex, puncStartIndex + 1]);
    }
    return ranges;
  }

  function unwrapSegmentInsideMark(textNode, localStart, localEnd) {
    const markEl = textNode.parentNode;
    if (!markEl || markEl.tagName?.toLowerCase() !== MARK_TAG) return;
    let mid = textNode;
    if (localStart > 0) {
      mid = mid.splitText(localStart);
      localEnd -= localStart;
    }
    if (localEnd < mid.nodeValue.length) {
      mid.splitText(localEnd);
    }
    const rightMark = document.createElement(MARK_TAG);
    while (mid.nextSibling) rightMark.appendChild(mid.nextSibling);
    if (rightMark.firstChild) markEl.after(rightMark);
    markEl.after(mid);
    if (!markEl.firstChild) markEl.remove();
    if (rightMark.previousSibling && isEl(rightMark.previousSibling) && rightMark.previousSibling.tagName.toLowerCase() === MARK_TAG) {
      mergePair(rightMark);
    }
  }

  function unmarkRangesInScope(scopeEl, ranges) {
    if (!ranges || !ranges.length) return;
    for (const [gStart, gEnd] of ranges) {
      const map = buildTextIndex(scopeEl);
      const { nodes, starts, lens } = map;
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i], nodeStart = starts[i], nodeEnd = nodeStart + lens[i];
        const interStart = Math.max(gStart, nodeStart), interEnd = Math.min(gEnd, nodeEnd);
        if (interStart >= interEnd) continue;
        if (!node.parentNode || node.parentNode.tagName?.toLowerCase() !== MARK_TAG) continue;
        const localStart = interStart - nodeStart, localEnd = interEnd - nodeStart;
        unwrapSegmentInsideMark(node, localStart, localEnd);
      }
    }
    $all(`${MARK_TAG} + ${MARK_TAG}`, scopeEl).forEach(mergePair);
    $all(MARK_TAG, scopeEl).forEach(m => { if (!m.textContent) m.remove(); });
    normalizeTextNodes(scopeEl);
  }

  function wrapSelectionWithMarks(scopeEl) {
    if (shouldSuppress()) return false;
    const sel = window.getSelection?.();
    if (!sel || sel.rangeCount === 0) return false;
    const range = sel.getRangeAt(0);
    if (range.collapsed || !scopeEl.contains(range.commonAncestorContainer)) return false;

    const walker = document.createTreeWalker(scopeEl, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeValue && n.nodeValue.trim().length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT)
    });

    const nodes = [];
    while (walker.nextNode()) {
      const n = walker.currentNode;
      let intersects = false;
      try { intersects = range.intersectsNode(n); } catch (e) { intersects = false; }
      if (!intersects || (!ALLOW_MARK_INSIDE_BBL && isInBBL(n))) continue;
      nodes.push(n);
    }
    if (!nodes.length) return false;

    let created = 0;
    nodes.forEach((orig) => {
      let node = orig, start = 0, end = node.nodeValue.length;
      if (node === range.startContainer) start = range.startOffset;
      if (node === range.endContainer) end = range.endOffset;
      if (start >= end) return;
      if (start > 0) { node = node.splitText(start); end -= start; }
      if (end < node.nodeValue.length) node.splitText(end);
      const txt = node.nodeValue, mL = txt.match(/^\s+/), mR = txt.match(/\s+$/);
      const leftTrim = mL ? mL[0].length : 0, rightTrim = mR ? mR[0].length : 0;
      if (leftTrim + rightTrim >= txt.length) return;
      if (leftTrim > 0) node = node.splitText(leftTrim);
      if (rightTrim > 0) node.splitText(node.nodeValue.length - rightTrim);
      if (!node.nodeValue) return;
      if (node.parentNode?.tagName?.toLowerCase() === MARK_TAG) { created = 1; return; }
      const mark = document.createElement(MARK_TAG);
      node.parentNode.replaceChild(mark, node);
      mark.appendChild(node);
      created = 1;
      const prev = mark.previousSibling;
      if (prev && isEl(prev) && prev.tagName.toLowerCase() === MARK_TAG) mergePair(mark);
      const next = mark.nextSibling;
      if (next && isEl(next) && next.tagName.toLowerCase() === MARK_TAG) mergePair(next);
      normalizeTextNodes(mark.parentNode);
    });

    if (created) {
      const { fullText } = buildTextIndex(scopeEl);
      const allExclusions = [...findParenExclusions(fullText), ...findPuncExclusions(fullText)];
      if (allExclusions.length) unmarkRangesInScope(scopeEl, allExclusions);
      normalizeTextNodes(scopeEl);
      sel.removeAllRanges();
      saveParagraphState(scopeEl);
      return true;
    }
    return false;
  }

  const dblTap = new WeakMap();
  document.addEventListener('touchend', (e) => {
    const markEl = e.target.closest && e.target.closest(MARK_TAG);
    if (!markEl || (!ALLOW_MARK_INSIDE_BBL && markEl.closest(BBL_SELECTOR))) return;
    const now = Date.now(), prev = dblTap.get(markEl) || 0;
    if (now - prev <= DOUBLE_TAP_MS) {
      triggerSuppress(420);
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      removeHighlight(markEl);
      dblTap.delete(markEl);
      return;
    }
    dblTap.set(markEl, now);
    setTimeout(() => { if (dblTap.get(markEl) === now) dblTap.delete(markEl); }, DOUBLE_TAP_MS + 80);
  });
  
  document.addEventListener('DOMContentLoaded', () => {
    const allParagraphs = $all(SELECTOR_SCOPE);
    
    allParagraphs.forEach((p, index) => {
      // Se clickable.js não deu um ID, damos um genérico.
      if (!p.id) {
        p.id = `paragrafo-geral-${index}`;
      }
    });

    if (window.CacheAnotacao) {
      allParagraphs.forEach(p => {
        // Agora os IDs estão corretos, então o carregamento funciona!
        const cachedHTML = window.CacheAnotacao.carregar(p.id);
        if (cachedHTML) {
          p.innerHTML = cachedHTML;
        }
      });
    }

    allParagraphs.forEach((p) => {
      p.addEventListener('mouseup', () => {
        if (shouldSuppress()) return;
        setTimeout(() => { if (!shouldSuppress()) wrapSelectionWithMarks(p); }, 10);
      });
      p.addEventListener('touchend', () => {
        if (shouldSuppress()) return;
        setTimeout(() => { if (!shouldSuppress()) wrapSelectionWithMarks(p); }, 30);
      });
    });

    // O sinal verde continua aqui para o scriptbbl.js
    console.log('✅ Cache restaurado. Disparando sinal "cacheRestored".');
    document.dispatchEvent(new CustomEvent('cacheRestored'));
  });
})();