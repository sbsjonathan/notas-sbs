// agente-modal.js — long-press (2s) no número da pergunta abre modal de IA
// Versão melhorada: sempre responde, indicando quando vai além do artigo

(function () {
  'use strict';

  // ====== CONFIGURAÇÃO DA IA ======
  const GEMINI_MODEL    = 'gemini-2.0-flash-exp';
  const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const API_KEY         = 'AIzaSyANZlDe64BqLPM8ByCNyaz9KecnTgRwEPc';
  const LONG_PRESS_TIME = 2000; // 2 segundos

  // ====== CRIA/ABRE/FECHA MODAL ======
  function ensureModal() {
    if (document.getElementById('modal-agente')) return;

    const overlay = document.createElement('div');
    overlay.id = 'modal-agente';
    overlay.innerHTML = `
      <div class="modal-agente-content" role="dialog" aria-modal="true" aria-labelledby="agente-titulo">
        <div class="modal-agente-header">
          <div class="modal-agente-fechar" id="agente-fechar" aria-label="Fechar">×</div>
          <h3 class="agente-modal-titulo" id="agente-titulo">Agente IA</h3>
        </div>
        <div class="agente-modal-body">
          <textarea id="agente-pergunta" 
                    placeholder="Pergunte algo sobre este artigo..." 
                    autocomplete="off"
                    autocorrect="on"
                    autocapitalize="sentences"
                    spellcheck="true"></textarea>
          <div class="agente-controles">
            <button id="agente-enviar" class="agente-btn agente-btn--primario">
              <span class="agente-btn-icon">✨</span>
              <span>Gerar Resposta</span>
            </button>
            <button id="agente-reset" class="agente-btn" title="Limpar">
              <span>Limpar</span>
            </button>
          </div>
          <div class="agente-status" id="agente-status"></div>
          <div id="agente-resposta" aria-live="polite"></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Eventos de fechar
    const fechar = () => closeModal();
    overlay.addEventListener('click', (e) => { 
      if (e.target === overlay) fechar(); 
    });
    overlay.querySelector('#agente-fechar').addEventListener('click', fechar);
    
    // ESC para fechar
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.style.display === 'flex') {
        fechar();
      }
    });
  }

  function openModal(contextoTitulo) {
    ensureModal();
    const overlay = document.getElementById('modal-agente');
    const titulo  = overlay.querySelector('#agente-titulo');
    
    titulo.textContent = contextoTitulo ? `Agente IA — ${contextoTitulo}` : 'Agente IA';
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Foca no textarea após abrir
    setTimeout(() => {
      const textarea = overlay.querySelector('#agente-pergunta');
      if (textarea) {
        textarea.focus();
        textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }

  function closeModal() {
    const overlay = document.getElementById('modal-agente');
    if (!overlay) return;
    
    overlay.style.display = 'none';
    document.body.style.overflow = '';
    
    document.activeElement?.blur();
  }

  // ====== EXTRAÇÃO DO TEXTO DO ARTIGO ======
  function extrairTextoArtigo() {
    const paragrafos = Array.from(document.querySelectorAll('.paragrafo'));
    if (!paragrafos.length) return '';
    
    const textos = paragrafos.map(p => {
      const clone = p.cloneNode(true);
      // Remove links bíblicos para texto limpo
      clone.querySelectorAll('a.bbl').forEach(a => a.replaceWith(a.textContent));
      // Remove números dos parágrafos
      const spans = clone.querySelectorAll('span');
      spans.forEach(s => s.remove());
      
      return clone.textContent.replace(/\s+/g, ' ').trim();
    });
    
    return textos.filter(t => t.length > 0).join('\n\n');
  }

  // ====== PROMPTS MELHORADOS ======
  function buildPromptComArticulo(artigoTexto, pergunta) {
    return `
Você é um assistente que ajuda a estudar artigos bíblicos.

INSTRUÇÕES:
1. Primeiro, verifique se a informação está no ARTIGO fornecido
2. Se estiver no artigo: responda baseado nele
3. Se NÃO estiver no artigo: comece com "Esta informação não está neste artigo, mas posso explicar:" e depois forneça conhecimento geral confiável sobre o tema
4. Responda sempre em português, de forma clara e educativa (4-8 frases)
5. Para textos bíblicos, mencione apenas as referências

=== ARTIGO ===
${artigoTexto || '[vazio]'}
=== FIM DO ARTIGO ===

PERGUNTA: ${pergunta}
`.trim();
  }

  function buildPromptSemArticulo(pergunta) {
    return `
Você é um assistente que responde perguntas sobre temas bíblicos e cristãos.

INSTRUÇÕES:
1. Como não há artigo disponível, forneça conhecimento geral confiável
2. Responda em português, de forma clara e educativa (4-8 frases)  
3. Se for sobre temas bíblicos, inclua contexto relevante
4. Para textos bíblicos, mencione apenas as referências
5. Se não souber algo específico, seja honesto sobre isso

PERGUNTA: ${pergunta}
`.trim();
  }

  async function chamarGemini(textoPrompt) {
    const body = {
      contents: [{ parts: [{ text: textoPrompt }] }],
      generationConfig: { 
        temperature: 0.7, 
        topK: 40, 
        topP: 0.95, 
        maxOutputTokens: 600 // Aumentado para respostas mais completas
      }
    };

    const resp = await fetch(GEMINI_ENDPOINT + `?key=${encodeURIComponent(API_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (!resp.ok) {
      let msg = `Erro HTTP ${resp.status}`;
      try { 
        const error = await resp.json();
        msg = error?.error?.message || msg; 
      } catch {}
      throw new Error(msg);
    }
    
    const data = await resp.json();
    return (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
  }

  async function gerarRespostaIA(pergunta, artigoTexto) {
    // Escolhe o prompt baseado na presença de artigo significativo
    let prompt;
    if (artigoTexto && artigoTexto.length > 50) {
      prompt = buildPromptComArticulo(artigoTexto, pergunta);
    } else {
      prompt = buildPromptSemArticulo(pergunta);
    }

    const resposta = await chamarGemini(prompt);
    return resposta || 'Não consegui gerar uma resposta no momento. Tente reformular sua pergunta.';
  }

  // ====== CONFIGURAÇÃO DO LONG-PRESS ======
  function setupLongPress() {
    const perguntas = document.querySelectorAll('.pergunta');
    
    perguntas.forEach((pergunta) => {
      const span = pergunta.querySelector('span');
      if (!span || span.dataset.agenteModalBound === '1') return;
      
      span.dataset.agenteModalBound = '1';
      span.classList.add('agente-touchable');

      let timer = null;
      let startX = 0, startY = 0;
      let isPressed = false;

      const iniciarPress = (clientX, clientY) => {
        if (isPressed) return;
        isPressed = true;
        startX = clientX;
        startY = clientY;
        
        span.classList.add('agente-pressing');
        
        timer = setTimeout(() => {
          if (isPressed) {
            span.classList.remove('agente-pressing');
            span.classList.add('agente-activated');
            
            if (window.navigator?.vibrate) {
              window.navigator.vibrate(50);
            }
            
            const numero = span.textContent.trim().replace(/\.$/, '');
            openModal(`Pergunta ${numero}`);
            
            setTimeout(() => {
              span.classList.remove('agente-activated');
            }, 300);
          }
        }, LONG_PRESS_TIME);
      };

      const cancelarPress = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        isPressed = false;
        span.classList.remove('agente-pressing', 'agente-activated');
      };

      // Touch events
      span.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (e.touches.length === 1) {
          const touch = e.touches[0];
          iniciarPress(touch.clientX, touch.clientY);
        }
      }, { passive: false });

      span.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
          const touch = e.touches[0];
          if (Math.abs(touch.clientX - startX) > 10 || 
              Math.abs(touch.clientY - startY) > 10) {
            cancelarPress();
          }
        }
      }, { passive: true });

      span.addEventListener('touchend', cancelarPress, { passive: true });
      span.addEventListener('touchcancel', cancelarPress, { passive: true });

      // Mouse events
      span.addEventListener('mousedown', (e) => {
        e.preventDefault();
        iniciarPress(e.clientX, e.clientY);
      });
      
      span.addEventListener('mousemove', (e) => {
        if (isPressed && (Math.abs(e.clientX - startX) > 10 || 
                         Math.abs(e.clientY - startY) > 10)) {
          cancelarPress();
        }
      });
      
      span.addEventListener('mouseup', cancelarPress);
      span.addEventListener('mouseleave', cancelarPress);

      span.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  // ====== AÇÕES DO MODAL ======
  function wireModalActions() {
    ensureModal();
    const overlay = document.getElementById('modal-agente');
    const btnSend = overlay.querySelector('#agente-enviar');
    const btnReset = overlay.querySelector('#agente-reset');
    const areaQ = overlay.querySelector('#agente-pergunta');
    const areaR = overlay.querySelector('#agente-resposta');
    const status = overlay.querySelector('#agente-status');

    const enviar = async () => {
      const pergunta = (areaQ.value || '').trim();
      if (!pergunta) {
        areaQ.focus();
        return;
      }

      const artigo = extrairTextoArtigo();

      // Desabilita controles
      btnSend.disabled = true;
      btnReset.disabled = true;
      areaQ.disabled = true;
      
      status.textContent = 'Gerando resposta...';
      status.classList.add('agente-status--loading');
      areaR.textContent = '';
      areaR.classList.add('agente-resposta--loading');

      try {
        const texto = await gerarRespostaIA(pergunta, artigo);
        areaR.textContent = texto;
        areaR.classList.remove('agente-resposta--loading');
      } catch (err) {
        areaR.textContent = `Erro: ${err.message}`;
        areaR.classList.add('agente-resposta--erro');
      } finally {
        btnSend.disabled = false;
        btnReset.disabled = false;
        areaQ.disabled = false;
        status.textContent = '';
        status.classList.remove('agente-status--loading');
      }
    };

    const limpar = () => {
      areaQ.value = '';
      areaR.textContent = '';
      areaR.classList.remove('agente-resposta--erro');
      areaQ.focus();
    };

    btnSend.addEventListener('click', enviar);
    btnReset.addEventListener('click', limpar);
    
    areaQ.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        enviar();
      }
    });
  }

  // ====== INICIALIZAÇÃO ======
  function inicializar() {
    ensureModal();
    setupLongPress();
    wireModalActions();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }

  window.addEventListener('load', () => {
    setTimeout(setupLongPress, 500);
  });

  const observer = new MutationObserver(() => {
    setupLongPress();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

})();