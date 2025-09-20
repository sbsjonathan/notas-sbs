// url.js — Abrir RTF a partir de uma URL e carregar no inputArea
// Apenas injeta UI e consome o RTFParser global. Não mexe nos seus arquivos.

(function () {
  'use strict';

  // ==== Utils ====
  const $ = (sel) => document.querySelector(sel);

  function updateStatusUI(msg, type) {
    const el = $('#statusText');
    if (!el) return;
    el.textContent = msg;
    const colors = { success: 'var(--success)', error: 'var(--danger)', warning: 'var(--warning)', info: 'var(--muted)' };
    el.style.color = colors[type] || 'var(--muted)';
  }

  function toast(msg, type = 'info') {
    const cont = document.getElementById('toastContainer');
    if (!cont) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    cont.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  function openInNewTab(url) {
    // Abre a URL para o usuário usar Compartilhar → Salvar em Arquivos (iOS)
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener'; // segurança
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ==== Injeta UI na topbar ====
  function injectUrlControls() {
    const topbar = $('.topbar');
    if (!topbar) return;

    const group = document.createElement('div');
    group.className = 'btn-group';

    const urlInput = document.createElement('input');
    urlInput.type = 'url';
    urlInput.id = 'rtfUrlInput';
    urlInput.placeholder = 'Cole a URL .rtf…';
    urlInput.autocomplete = 'url';
    urlInput.inputMode = 'url';
    urlInput.style.padding = '0.45rem 0.8rem';
    urlInput.style.border = '1px solid var(--secondary-border)';
    urlInput.style.borderRadius = '8px';
    urlInput.style.background = 'var(--bg-soft)';
    urlInput.style.color = 'var(--text)';
    urlInput.style.minWidth = '14rem';

    const openBtn = document.createElement('button');
    openBtn.id = 'openUrlBtn';
    openBtn.className = 'btn btn-primary btn-sm';
    openBtn.textContent = 'Abrir URL .rtf';

    group.appendChild(urlInput);
    group.appendChild(openBtn);

    const grow = topbar.querySelector('.grow');
    topbar.insertBefore(group, grow || null);
  }

  // ==== Decodificação ====
  function looksLikeRtf(txt) {
    return /^\{\s*\\rtf/iu.test(String(txt).slice(0, 100));
  }

  async function fetchRtfAsText(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000); // 25s timeout para redes lentas
    let res;
    try {
      res = await fetch(url, {
        method: 'GET',
        mode: 'cors',               // se o servidor permitir, ok; senão, erro → plano B
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: ctrl.signal
      });
    } finally {
      clearTimeout(t);
    }

    if (!res || !res.ok) {
      throw new Error(`HTTP ${(res && res.status) || 'desconhecido'}`);
    }

    // Content-Type ajuda a diagnosticar, mas não é obrigatório.
    const ct = (res.headers.get('content-type') || '').toLowerCase();

    // Lê como ArrayBuffer e tenta decodificações prováveis
    const buf = await res.arrayBuffer();

    // 1) windows-1252 (muito comum em RTF)
    try {
      const d = new TextDecoder('windows-1252', { fatal: false });
      const s = d.decode(buf);
      if (looksLikeRtf(s) || ct.includes('rtf') || ct.includes('text/plain')) return s;
    } catch (_) {}

    // 2) utf-8
    try {
      const d = new TextDecoder('utf-8', { fatal: false });
      const s = d.decode(buf);
      if (looksLikeRtf(s) || ct.includes('rtf') || ct.includes('text/plain')) return s;
      return s; // devolve mesmo assim: alguns servidores mandam cabeçalho estranho
    } catch (_) {}

    // 3) fallback final
    return await res.text();
  }

  // ==== Handler principal ====
  async function handleOpenUrl() {
    const inputArea = $('#inputArea');
    if (!inputArea) { toast('Campo de texto não encontrado.', 'error'); return; }
    if (typeof RTFParser === 'undefined' || !RTFParser || !RTFParser.parse) {
      toast('RTFParser não encontrado. Inclua rtf-parser.js antes do url.js.', 'error');
      return;
    }

    const urlEl = $('#rtfUrlInput');
    const btnEl = $('#openUrlBtn');
    if (!urlEl || !btnEl) return;

    const url = (urlEl.value || '').trim();
    if (!url) { toast('Cole uma URL de arquivo .rtf', 'warning'); urlEl.focus(); return; }

    try { new URL(url); } catch { toast('URL inválida', 'error'); urlEl.focus(); return; }

    btnEl.disabled = true;
    urlEl.disabled = true;
    updateStatusUI('Baixando RTF pela URL…', 'info');

    try {
      const rtfText = await fetchRtfAsText(url);

      if (!rtfText || !rtfText.trim()) {
        throw new Error('Conteúdo vazio');
      }

      // Verifica assinatura; se não parecer RTF, ainda tentamos parse, mas avisamos
      if (!looksLikeRtf(rtfText)) {
        console.warn('Conteúdo não parece RTF. Tentando parse mesmo assim…');
      }

      const extracted = RTFParser.parse(String(rtfText));
      if (!extracted || !extracted.trim()) {
        throw new Error('Não foi possível extrair texto do RTF');
      }

      inputArea.value = extracted;
      inputArea.scrollTop = 0;
      inputArea.dispatchEvent(new Event('input', { bubbles: true }));
      updateStatusUI('Arquivo carregado via URL! Pronto para processar.', 'success');
      toast('RTF carregado da URL!', 'success');

    } catch (err) {
      console.error('Falha ao abrir URL .rtf:', err);

      // Safari/iOS costuma dar TypeError sem mensagem quando é CORS/opaque/blocked
      const msg = String(err && err.message || '').toLowerCase();

      // Qualquer falha → plano B automático: abrir a URL numa nova aba
      openInNewTab(url);

      // Mensagem guiando ação no iOS
      if (msg.includes('abort') || msg.includes('timeout')) {
        toast('Conexão lenta: abri a URL em nova aba. Use “Compartilhar → Salvar em Arquivos”.', 'error');
        updateStatusUI('Timeout: finalize na aba aberta.', 'warning');
      } else if (msg.includes('http')) {
        toast('Servidor recusou a leitura direta. Abri em nova aba para você salvar.', 'error');
        updateStatusUI('Download indireto via aba aberta.', 'warning');
      } else {
        // Provável CORS/TypeError silencioso
        toast('O site bloqueou a leitura direta (CORS). Abri em nova aba para salvar.', 'error');
        updateStatusUI('CORS bloqueou leitura direta. Use a aba aberta → Salvar em Arquivos.', 'warning');
      }
    } finally {
      btnEl.disabled = false;
      urlEl.disabled = false;
    }
  }

  // ==== Init ====
  function init() {
    injectUrlControls();
    const btnEl = document.getElementById('openUrlBtn');
    const urlEl = document.getElementById('rtfUrlInput');
    if (btnEl) btnEl.addEventListener('click', handleOpenUrl);
    if (urlEl) urlEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleOpenUrl(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();