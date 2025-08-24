// toggle.js - VERSÃO DE DIAGNÓSTICO COM LOGS DETALHADOS

console.warn("--- CARREGANDO VERSÃO DE DIAGNÓSTICO DO toggle.js ---");

class TogglePlugin {
  constructor() {
    this.name = 'toggle';
    this.slotId = 3;
    this.MAX_LEVEL = 3;
    this.editor = null;
    this.toggleBtn = null;
    this._retryMs = 100;
    console.log('[CONSTRUCTOR] Plugin Toggle inicializado.');
    this.autoRegister();
  }

  // === REGISTRO ===
  autoRegister() {
    console.log('[autoRegister] Aguardando o objeto `toolbar` global...');
    this.waitForDependency('toolbar', () => this.waitForSlotAndRegister());
  }

  waitForDependency(dependency, callback) {
    const check = () => {
      if (window[dependency]) {
        console.log(`[waitForDependency] Dependência '${dependency}' encontrada.`);
        callback();
      } else {
        setTimeout(check, this._retryMs);
      }
    };
    check();
  }

  waitForSlotAndRegister() {
    const slotEl = document.getElementById(`plugin-slot-${this.slotId}`);
    if (slotEl) {
      console.log(`[waitForSlotAndRegister] Slot ${this.slotId} encontrado no DOM. Tentando registrar...`);
      this.register();
    } else {
      console.log(`[waitForSlotAndRegister] Slot ${this.slotId} ainda não existe. Tentando novamente em ${this._retryMs}ms.`);
      setTimeout(() => this.waitForSlotAndRegister(), this._retryMs);
    }
  }

  register() {
    const pluginHTML = `
      <div class="toggle-plugin">
        <button class="toggle-btn" id="toggle-plugin-btn" title="Bloco de Toggle" aria-label="Inserir Bloco de Toggle">
          <svg class="toggle-icon" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="4,9 10,12 4,15" fill="currentColor" stroke-width="0"/>
            <line x1="12" y1="12" x2="20" y2="12" fill="none"/>
            <line x1="12" y1="16" x2="17" y2="16" fill="none"/>
          </svg>
        </button>
      </div>
    `;

    const success = window.toolbar.registerPlugin(this.name, this.slotId, this, pluginHTML);
    if (!success) {
      console.error(`[register] Falha ao registrar no slot ${this.slotId}. Tentando novamente...`);
      setTimeout(() => this.register(), this._retryMs);
      return;
    }
    console.log(`[register] Plugin registrado com sucesso no slot ${this.slotId}.`);

    this.toggleBtn = document.getElementById('toggle-plugin-btn');
    this.toggleBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      console.log('[EVENT] Botão de Toggle na barra foi clicado (mousedown).');
      this.handleToolbarClick();
    });

    this.waitForDependency('editor', () => this.connectToEditor());
  }

  connectToEditor() {
    this.editor = window.editor;
    this.setupEventDelegation();
    console.log('🔗✅ Plugin de Toggle conectado ao editor.');
  }

  // === CRIAÇÃO E MANIPULAÇÃO ===
  handleToolbarClick() {
    // ... (esta parte não é o foco do problema, mantida sem logs)
    const activeElement = document.activeElement;
    const currentToggle = activeElement?.closest('.toggle');
    if (currentToggle) {
      this.escapeToggleToText(currentToggle);
    } else {
      const newToggle = this.createToggle(0);
      this.editor.insertElement(newToggle);
    }
  }

  createToggle(level, titleText = '') {
    // ...
    const wrapper = document.createElement('div');
    wrapper.className = 'toggle';
    wrapper.setAttribute('data-level', level);
    const canAddChild = level < this.MAX_LEVEL;
    wrapper.innerHTML = `
      <div class="toggle-header">
        <div class="arrow-wrapper"><div class="arrow"></div></div>
        <div class="toggle-title" contenteditable="true" data-placeholder="Digite o título..." autocapitalize="sentences">${titleText}</div>
      </div>
      <div class="toggle-content">
        <div class="content-wrapper">
          <div class="content-invisible" contenteditable="true" data-placeholder="Digite aqui seu texto..."></div>
          <button class="add-child-btn"${canAddChild ? '' : ' disabled'}>+</button>
        </div>
      </div>`;
    return wrapper;
  }

  createContentWrapper() {
    // ...
    const wrapper = document.createElement('div');
    wrapper.className = 'content-wrapper';
    wrapper.innerHTML = `
      <div class="content-invisible" contenteditable="true" data-placeholder="Digite aqui seu texto..."></div>
      <button class="add-child-btn">+</button>
    `;
    return wrapper;
  }

  // === EVENTOS ===
  setupEventDelegation() {
    const editorEl = this.editor.editorElement;

    editorEl.addEventListener('click', (e) => {
      const arrowWrapper = e.target.closest('.arrow-wrapper');
      if (arrowWrapper) {
        const toggle = arrowWrapper.closest('.toggle');
        this.toggleExpansion(toggle);
      }
    });
    
    editorEl.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('add-child-btn')) {
        console.log('[EVENT] Botão + foi clicado (mousedown). Prevenindo o comportamento padrão...');
        e.preventDefault();
        this.handleAddChild(e.target);
      }
    });
    
    // ... (outros eventos mantidos sem logs para não poluir)
    editorEl.addEventListener('focusin', (e) => this.handleFocusIn(e));
    editorEl.addEventListener('input', (e) => this.handleInput(e));
    editorEl.addEventListener('blur', (e) => this.handleBlur(e), true);
    editorEl.addEventListener('keydown', (e) => this.handleKeydown(e));
    console.log('[setupEventDelegation] Listeners de evento configurados no editor.');
  }

  toggleExpansion(toggle) {
    toggle.querySelector('.arrow').classList.toggle('expanded');
    toggle.querySelector('.toggle-content').classList.toggle('visible');
  }

  // ===== FUNÇÃO CRÍTICA COM LOGS DETALHADOS =====
  handleAddChild(button) {
    console.group("--- Iniciando handleAddChild ---");
    console.log("➕ [handleAddChild] Iniciado pelo clique no botão:", button);
    console.log("[handleAddChild] Elemento focado ANTES da ação:", document.activeElement);

    const parentToggle = button.closest('.toggle');
    const level = parseInt(parentToggle.getAttribute('data-level'), 10);
    console.log(`[handleAddChild] Toggle pai encontrado (nível ${level}):`, parentToggle);
    
    if (level >= this.MAX_LEVEL) {
      console.warn("[handleAddChild] Nível máximo atingido. Ação abortada.");
      console.groupEnd();
      return;
    }

    const contentWrapper = button.parentElement;
    const contentField = contentWrapper.querySelector('.content-invisible');
    const textContent = contentField.innerText.trim();
    console.log("📄 [handleAddChild] Texto capturado do campo de conteúdo:", `"${textContent}"`);

    if (textContent.includes('\n')) {
      console.error("[handleAddChild] Texto contém quebra de linha. Ação abortada.");
      this.showError(contentWrapper);
      console.groupEnd();
      return;
    }

    const title = textContent ? this.capitalize(textContent) : '';
    console.log(`[handleAddChild] Título para o novo toggle: "${title}"`);
    const childToggle = this.createToggle(level + 1, title);
    
    const parentContent = parentToggle.querySelector('.toggle-content');
    console.log("💣 [handleAddChild] PREPARANDO PARA ALTERAR O DOM. Limpando conteúdo do toggle pai...");
    parentContent.innerHTML = '';
    console.log(" DOM-WRITE: Conteúdo limpo.");
    parentContent.appendChild(childToggle);
    console.log(" DOM-WRITE: Novo toggle filho adicionado ao DOM:", childToggle);
    
    const newTitle = childToggle.querySelector('.toggle-title');
    if (newTitle) {
      console.log("🎯 [handleAddChild] Encontrado o novo título para focar:", newTitle);
      console.log("[handleAddChild] Agendando a lógica de foco para daqui a 50ms...");
      
      setTimeout(() => {
        console.group("--- Executando Lógica de Foco (setTimeout) ---");
        console.log("⏰ [setTimeout] Executando após 50ms de delay...");
        console.log("🏃‍♂️ [setTimeout] Tentando focar em:", newTitle);

        newTitle.focus();
        
        console.log("✅ [setTimeout] .focus() foi chamado.");
        console.log("🔍 [setTimeout] Elemento ativo NESTE MOMENTO é:", document.activeElement);

        if (document.activeElement !== newTitle) {
            console.error("‼️ ATENÇÃO: O foco NÃO foi para o elemento esperado!");
        } else {
            console.log("🎉 SUCESSO: O elemento esperado está focado.");
        }
        
        const selection = window.getSelection();
        if (!selection) {
            console.error("[setTimeout] Objeto window.getSelection() é nulo!");
            console.groupEnd();
            return;
        }

        console.log("[setTimeout] Manipulando a seleção do cursor...");
        selection.selectAllChildren(newTitle);
        selection.collapseToEnd();
        console.log("🏁 [setTimeout] Fim da lógica de foco. Cursor posicionado.");
        console.groupEnd();
      }, 50);

    } else {
      console.error("[handleAddChild] ERRO CRÍTICO: Não foi possível encontrar '.toggle-title' no novo toggle criado.");
    }
    console.groupEnd();
  }

  handleFocusIn(e) {
    document.querySelectorAll('.add-child-btn.visible').forEach(b => b.classList.remove('visible'));
    if (e.target.classList.contains('content-invisible')) {
      const btn = e.target.parentElement.querySelector('.add-child-btn');
      if (btn && !btn.disabled) btn.classList.add('visible');
    }
  }

  handleInput(e) {
    const target = e.target;
    if (target.classList.contains('toggle-title') || target.classList.contains('content-invisible')) {
      this.cleanEmpty(target);
      if (target.classList.contains('toggle-title')) this.autoCapitalize(target);
    }
  }

  handleBlur(e) {
    if (e.target.classList.contains('content-invisible') || e.target.classList.contains('toggle-title')) {
      this.cleanEmpty(e.target);
    }
  }

  handleKeydown(e) {
    const target = e.target;
    const toggle = target.closest('.toggle');
    if (!toggle) return;
    if (target.classList.contains('content-invisible')) this.handleContentKeydown(e, target, toggle);
    else if (target.classList.contains('toggle-title')) this.handleTitleKeydown(e, target, toggle);
  }

  handleContentKeydown(e, target, toggle) {
    const isEmpty = !target.textContent.trim();
    if (e.key === 'Backspace' && isEmpty) {
      e.preventDefault();
      this.focusElement(toggle.querySelector('.toggle-title'));
    } else if (e.key === 'Enter' && isEmpty) {
      e.preventDefault();
      this.exitToggle(toggle);
    }
  }

  handleTitleKeydown(e, title, toggle) {
    if (e.key === 'Backspace' && !title.textContent.trim()) {
      e.preventDefault();
      this.handleTitleBackspace(toggle);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this.handleTitleEnter(title, toggle);
    }
  }

  handleTitleBackspace(toggle) {
    const level = parseInt(toggle.getAttribute('data-level'), 10);
    const parent = toggle.parentElement;
    if (level > 0 && parent.classList.contains('toggle-content')) {
      const siblings = parent.querySelectorAll(':scope > .toggle');
      if (siblings.length === 1) {
        const parentToggle = parent.closest('.toggle');
        const newContent = this.createContentWrapper();
        parent.innerHTML = '';
        parent.appendChild(newContent);
        this.focusElement(newContent.querySelector('.content-invisible'));
      } else {
        toggle.remove();
      }
    } else {
      this.removeFocusPrevious(toggle);
    }
  }

  handleTitleEnter(title, toggle) {
    if (title.textContent.trim()) {
      const level = parseInt(toggle.getAttribute('data-level'), 10);
      const sibling = this.createToggle(level);
      toggle.after(sibling);
      this.focusElement(sibling.querySelector('.toggle-title'));
    } else {
      this.handleEmptyTitleEnter(toggle);
    }
  }

  handleEmptyTitleEnter(toggle) {
    const level = parseInt(toggle.getAttribute('data-level'), 10);
    if (level > 0) {
      toggle.setAttribute('data-level', level - 1);
      const parentToggle = toggle.parentElement.closest('.toggle');
      if (parentToggle) {
        parentToggle.after(toggle);
        this.focusElement(toggle.querySelector('.toggle-title'));
      }
    } else {
      this.editor.createTextBlockAfterElement(toggle);
      toggle.remove();
      this.editor.updatePlaceholder();
    }
  }

  // === UTILITÁRIOS ===
  escapeToggleToText(currentToggle) {
    let rootToggle = currentToggle;
    while (rootToggle && parseInt(rootToggle.getAttribute('data-level'), 10) > 0) {
      rootToggle = rootToggle.parentElement.closest('.toggle');
    }
    const next = rootToggle.nextElementSibling;
    if (next?.classList.contains('text-block')) this.focusElement(next);
    else this.editor.createTextBlockAfterElement(rootToggle);
  }

  exitToggle(toggle) {
    const next = toggle.nextElementSibling;
    if (next?.classList.contains('text-block')) this.focusElement(next);
    else this.editor.createTextBlockAfterElement(toggle);
  }

  removeFocusPrevious(toggle) {
    const prev = toggle.previousElementSibling;
    toggle.remove();
    if (prev) {
      if (prev.classList.contains('toggle')) this.focusElement(prev.querySelector('.toggle-title'));
      else if (prev.classList.contains('text-block')) this.focusElement(prev);
    } else {
      const newBlock = this.editor.createTextBlock();
      this.editor.editorElement.appendChild(newBlock);
      this.editor.currentTextBlock = newBlock;
      this.focusElement(newBlock);
    }
    this.editor.updatePlaceholder();
  }

  focusElement(element) {
    console.log(`[focusElement] Chamada para focar no elemento:`, element);
    if (!element) return;
    setTimeout(() => {
      console.log(`[focusElement - setTimeout] Executando foco para:`, element);
      element.focus();
      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      console.log(`[focusElement - setTimeout] Foco concluído. Elemento ativo agora:`, document.activeElement);
    }, 0);
  }

  cleanEmpty(el) {
    const text = el.innerText.replace(/\uFEFF/g, '').trim();
    if (!text) el.innerHTML = '';
  }

  capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
  }

  autoCapitalize(element) {
    const text = element.textContent;
    if (text.length === 1 && text === text.toLowerCase()) {
      element.textContent = text.toUpperCase();
      this.focusElement(element);
    }
  }

  showError(element) {
    element.classList.add('shake');
    setTimeout(() => element.classList.remove('shake'), 500);
  }

  destroy() {
    console.log('🗑️ Plugin de Toggle destruído');
  }
}

// Auto-start
const togglePlugin = new TogglePlugin();