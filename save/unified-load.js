// save/unified-load.js (Versão Final com Estratégia Stale-While-Revalidate)

class UnifiedLoadManager {
    constructor() {
        this.editor = null;
        this.currentSemana = null;
        this.isLoggedIn = false;
        
        console.log('🚀 UnifiedLoadManager (RichText) inicializando...');
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            setTimeout(() => this.setup(), 100);
        }
    }

    async setup() {
        console.log('📋 Configurando sistema de load do RichText...');
        
        this.detectSemana();
        this.checkLoginStatus();
        
        await this.waitForEditor();
        
        // 1. Carrega o conteúdo local imediatamente para uma experiência rápida.
        this.loadInitialContentFromCache();
        
        // 2. Se estiver logado, inicia a sincronização com a nuvem em segundo plano.
        if (this.isLoggedIn) {
            this.syncWithSupabase();
        }
        
        this.setupListeners();
    }

    // Unifica a detecção da semana em um único método robusto.
    detectSemana() {
        const urlParams = new URLSearchParams(window.location.search);
        this.currentSemana = urlParams.get('semana') || window.semanaAtual || 'default-week';
        this.updateSemanaIndicator();
    }

    checkLoginStatus() {
        this.isLoggedIn = !!localStorage.getItem('supabase_user');
    }

    // Espera o editor estar pronto na página.
    waitForEditor() {
        return new Promise((resolve) => {
            const check = () => {
                const editorElement = document.getElementById('text-editor');
                if (editorElement) {
                    this.editor = editorElement;
                    console.log('📝 Editor RichText encontrado.');
                    resolve();
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    // PASSO 1 DA ESTRATÉGIA: Carrega do cache local primeiro.
    loadInitialContentFromCache() {
        if (!window.cacheRichText) {
            console.warn('CacheRichText (cache-r.js) não encontrado para o load inicial.');
            return;
        }
        const cachedContent = window.cacheRichText.carregar();
        if (cachedContent && cachedContent.trim()) {
            this.applyContentToEditor(cachedContent);
            console.log('✅ Conteúdo inicial carregado do cache local.');
        } else {
            console.log('📄 Nenhum conteúdo no cache local. Iniciando com editor vazio.');
        }
    }

    // PASSO 2 DA ESTRATÉGIA: Sincroniza com o Supabase em segundo plano.
    async syncWithSupabase() {
        console.log('☁️ Iniciando sincronização com o Supabase em segundo plano...');
        this.showFeedback('Sincronizando...', 'saving');

        // Espera o Supabase estar pronto, com paciência.
        if (!window.SupabaseSync || typeof window.SupabaseSync.carregarRichtextAnotacoes !== 'function') {
            console.warn('SupabaseSync não está pronto. Tentando sincronizar novamente em 1s...');
            setTimeout(() => this.syncWithSupabase(), 1000);
            return;
        }

        const supabaseContent = await window.SupabaseSync.carregarRichtextAnotacoes(this.currentSemana);

        // Se não encontrou nada na nuvem, não faz nada.
        if (!supabaseContent || !supabaseContent.trim()) {
            console.log('📭 Nenhum conteúdo encontrado no Supabase para esta semana.');
            this.showFeedback('Salvo localmente', 'local');
            return;
        }

        const currentEditorContent = this.editor.innerHTML;

        // A MÁGICA: Só atualiza a tela se o conteúdo da nuvem for DIFERENTE.
        if (supabaseContent !== currentEditorContent) {
            console.log('🔄 Conteúdo da nuvem é mais recente. Atualizando o editor.');
            this.applyContentToEditor(supabaseContent);

            // Atualiza também o cache local com a versão da nuvem
            if (window.cacheRichText) {
                window.cacheRichText.salvar(supabaseContent);
            }
            // E atualiza o AutoSaveManager para evitar um salvamento desnecessário
            if (window.AutoSaveManager) {
                window.AutoSaveManager.lastSavedContent = supabaseContent;
            }

            this.showFeedback('✅ Sincronizado', 'success');
        } else {
            console.log('👍 Conteúdo local já está sincronizado com a nuvem.');
            this.showFeedback('✅ Sincronizado', 'success');
        }
    }
    
    // Aplica o conteúdo no editor e atualiza as estatísticas.
    applyContentToEditor(content) {
        if (!this.editor) return;
        this.editor.innerHTML = content;

        // Dispara um evento de 'input' para que outros scripts (como o de contagem de palavras) reajam.
        this.editor.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    }

    // Fica "ouvindo" por mudanças de login para recarregar.
    setupListeners() {
        window.addEventListener('storage', (e) => {
            if (e.key === 'supabase_user') {
                const wasLoggedIn = this.isLoggedIn;
                this.checkLoginStatus();
                if (!wasLoggedIn && this.isLoggedIn) {
                    console.log('🔄 Login detectado! Sincronizando com a nuvem...');
                    this.syncWithSupabase();
                }
            }
        });
    }

    // --- Funções de Feedback Visual ---
    updateSemanaIndicator() {
        const indicator = document.getElementById('semana-indicator');
        if (indicator) indicator.textContent = `Semana: ${this.currentSemana}`;
    }

    showFeedback(message, type) {
        const statusDiv = document.getElementById('save-status');
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.className = `save-status show ${type}`;
            setTimeout(() => statusDiv.classList.remove('show'), 3000);
        }
    }
}

// Inicializa a classe.
window.UnifiedLoadManager = new UnifiedLoadManager();