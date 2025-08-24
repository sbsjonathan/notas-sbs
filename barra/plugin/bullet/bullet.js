// bullet.js - Plugin para criar listas de bullet points (não ordenadas)

class BulletPlugin {
  constructor() {
    this.name = 'bullet';
    this.slotId = 4; // Conforme solicitado

    this.editor = null;
    this.bulletBtn = null;
    this._retryMs = 100;

    this.autoRegister();
  }

  // === Registro na Barra de Ferramentas ===
  autoRegister() {
    this.waitForDependency('toolbar', () => this.register());
  }

  waitForDependency(dependency, callback) {
    const check = () => {
      if (window[dependency]) {
        callback();
      } else {
        setTimeout(check, this._retryMs);
      }
    };
    check();
  }

  register() {
    const pluginHTML = `
      <div class="bullet-plugin">
        <button class="bullet-btn" id="bullet-plugin-btn" title="Lista" aria-label="Criar Lista">
          <svg class="bullet-icon" viewBox="0 0 24 24">
            <path d="M4 18h16v-2H4v2zm0-5h16v-2H4v2zm0-7v2h16V6H4z"/>
          </svg>
        </button>
      </div>
    `;

    const success = window.toolbar.registerPlugin(this.name, this.slotId, this, pluginHTML);
    if (!success) {
      setTimeout(() => this.register(), this._retryMs);
      return;
    }

    this.bulletBtn = document.getElementById('bullet-plugin-btn');
    
    // Usamos 'mousedown' para prevenir a perda de foco do editor, assim como no negrita.js
    this.bulletBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.handleToolbarClick();
    });

    this.waitForDependency('editor', () => this.connectToEditor());
  }

  // === Conexão com o Editor ===
  connectToEditor() {
    this.editor = window.editor;
    const editorEl = this.editor.editorElement;

    // Listeners para atualizar o estado do botão (ativo/inativo)
    document.addEventListener('selectionchange', () => this.updateButtonState());
    editorEl.addEventListener('keyup', () => this.updateButtonState()); // Keyup é bom para backspace/enter
    editorEl.addEventListener('focus', () => this.updateButtonState());
    editorEl.addEventListener('blur', () => this.updateButtonState(true)); // Passa true para forçar desativação

    this.updateButtonState();
    console.log('🔗 Plugin de Bullet List conectado');
  }

  // === Lógica Principal ===
  handleToolbarClick() {
    if (!this.editor) return;

    // O comando 'insertUnorderedList' é um toggle:
    // - Se não há lista, ele cria uma.
    // - Se já há uma lista, ele a remove.
    document.execCommand('insertUnorderedList', false, null);

    // Garante que o estado do botão seja atualizado imediatamente
    this.updateButtonState();
    
    // Garante que o editor mantenha o foco
    this.editor.focus();
  }

  updateButtonState(forceInactive = false) {
    if (!this.bulletBtn) return;

    if (forceInactive) {
        this.bulletBtn.classList.remove('active');
        return;
    }
    
    // Usamos queryCommandState para verificar se a seleção atual está dentro de uma lista
    try {
      const isList = document.queryCommandState('insertUnorderedList');
      this.bulletBtn.classList.toggle('active', isList);
    } catch (e) {
      this.bulletBtn.classList.remove('active');
    }
  }

  destroy() {
    // Limpeza de eventos se necessário no futuro
  }
}

// Auto-inicialização do plugin
const bulletPlugin = new BulletPlugin();