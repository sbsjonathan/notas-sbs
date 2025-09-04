// save/load-sync.js - Sistema de Carregamento e Sincronização Unificado

class LoadSyncManager {
    constructor() {
        this.currentSemana = null;
        this.isLoggedIn = false;
        this.editor = null;
        this.loadAttempted = false;
        
        console.log('🔄 LoadSyncManager inicializando...');
        this.init();
    }

    init() {
        // Aguarda todos os sistemas estarem prontos
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            setTimeout(() => this.setup(), 300); // Delay para garantir que tudo carregou
        }
    }

    setup() {
        // 1. Detecta semana atual
        this.detectSemana();
        
        // 2. Verifica login
        this.checkLoginStatus();
        
        // 3. Aguarda editor estar pronto
        this.waitForEditor();
        
        console.log('✅ LoadSyncManager configurado:', {
            semana: this.currentSemana,
            logado: this.isLoggedIn
        });
    }

    /**
     * DETECTA SEMANA - igual ao sistema atual
     */
    detectSemana() {
        // Método 1: window.semanaAtual (definido pelo container.html)
        if (window.semanaAtual) {
            this.currentSemana = window.semanaAtual;
            console.log('📅 Semana via window.semanaAtual:', this.currentSemana);
            return;
        }

        // Método 2: URLSearchParams  
        const urlParams = new URLSearchParams(window.location.search);
        const semanaURL = urlParams.get('semana');
        if (semanaURL) {
            this.currentSemana = semanaURL;
            console.log('📅 Semana via URL:', this.currentSemana);
            return;
        }

        // Método 3: Fallback baseado na data atual
        const agora = new Date();
        const dia = String(agora.getDate()).padStart(2, '0');
        const mes = String(agora.getMonth() + 1).padStart(2, '0');
        this.currentSemana = `${dia}-${mes}`;
        console.log('📅 Semana fallback:', this.currentSemana);
    }

    /**
     * VERIFICA LOGIN
     */
    checkLoginStatus() {
        const savedUser = localStorage.getItem('supabase_user');
        this.isLoggedIn = !!savedUser;
        
        if (this.isLoggedIn) {
            try {
                const userData = JSON.parse(savedUser);
                console.log('👤 Usuário logado:', userData.usuario);
            } catch (e) {
                this.isLoggedIn = false;
                localStorage.removeItem('supabase_user');
                console.log('🗑️ Login inválido removido');
            }
        } else {
            console.log('❌ Usuário não logado');
        }
    }

    /**
     * AGUARDA EDITOR ESTAR PRONTO
     */
    waitForEditor() {
        const checkEditor = () => {
            const editor = document.getElementById('text-editor');
            if (editor) {
                this.editor = editor;
                console.log('📝 Editor encontrado, iniciando carregamento...');
                this.loadContent();
            } else {
                console.log('⏳ Aguardando editor...');
                setTimeout(checkEditor, 200);
            }
        };
        checkEditor();
    }

    /**
     * CARREGAMENTO PRINCIPAL - ORDEM DE PRIORIDADE
     */
    async loadContent() {
        if (this.loadAttempted) {
            console.log('⚠️ Carregamento já tentado, ignorando...');
            return;
        }
        
        this.loadAttempted = true;
        
        if (!this.currentSemana) {
            console.error('❌ Semana não detectada, impossível carregar');
            return;
        }

        console.log('🔍 Iniciando carregamento para semana:', this.currentSemana);

        let content = null;
        let source = 'nenhum';

        try {
            // PRIORIDADE 1: Supabase (se logado)
            if (this.isLoggedIn) {
                console.log('☁️ Tentando carregar do Supabase...');
                content = await this.loadFromSupabase();
                if (content) {
                    source = 'supabase';
                    console.log('✅ Conteúdo carregado do Supabase');
                }
            }

            // PRIORIDADE 2: Cache local (se não encontrou no Supabase)
            if (!content) {
                console.log('💾 Tentando carregar do cache local...');
                content = this.loadFromLocalCache();
                if (content) {
                    source = 'cache-local';
                    console.log('✅ Conteúdo carregado do cache local');
                }
            }

            // RESULTADO
            if (content && content.trim()) {
                this.applyContentToEditor(content);
                this.showLoadFeedback(`Carregado (${source})`, 'success');
                
                // Se carregou do cache local mas está logado, sincroniza para Supabase
                if (source === 'cache-local' && this.isLoggedIn) {
                    this.syncLocalToSupabase(content);
                }
            } else {
                console.log('📝 Nenhum conteúdo encontrado - editor vazio');
                this.showLoadFeedback('Editor vazio', 'info');
            }

        } catch (error) {
            console.error('❌ Erro no carregamento:', error);
            this.showLoadFeedback('Erro no carregamento', 'error');
        }
    }

    /**
     * CARREGA DO SUPABASE
     */
    async loadFromSupabase() {
        try {
            if (!window.SupabaseSync) {
                console.log('⚠️ SupabaseSync não disponível');
                return null;
            }

            const content = await window.SupabaseSync.carregarRichtextAnotacoes(this.currentSemana);
            
            if (content && content.trim()) {
                console.log('📥 Conteúdo encontrado no Supabase:', {
                    tamanho: content.length,
                    preview: content.substring(0, 50) + '...'
                });
                return content;
            }
            
            console.log('📭 Nenhum conteúdo no Supabase para esta semana');
            return null;
            
        } catch (error) {
            console.error('❌ Erro ao carregar do Supabase:', error);
            return null;
        }
    }

    /**
     * CARREGA DO CACHE LOCAL
     */
    loadFromLocalCache() {
        try {
            if (window.cacheRichText && typeof window.cacheRichText.carregar === 'function') {
                const content = window.cacheRichText.carregar();
                
                if (content && content.trim()) {
                    console.log('📥 Conteúdo encontrado no cache local:', {
                        tamanho: content.length,
                        preview: content.substring(0, 50) + '...'
                    });
                    return content;
                }
            }
            
            console.log('📭 Nenhum conteúdo no cache local');
            return null;
            
        } catch (error) {
            console.error('❌ Erro ao carregar do cache local:', error);
            return null;
        }
    }

    /**
     * APLICA CONTEÚDO NO EDITOR
     */
    applyContentToEditor(content) {
        if (!this.editor) {
            console.error('❌ Editor não encontrado');
            return;
        }

        try {
            // Aplica o conteúdo
            this.editor.innerHTML = content;
            
            // Atualiza classe empty se necessário
            if (content.trim() === '') {
                this.editor.classList.add('is-empty');
            } else {
                this.editor.classList.remove('is-empty');
            }
            
            // Atualiza estatísticas (se disponível)
            if (window.editor && typeof window.editor.updateStats === 'function') {
                window.editor.updateStats();
                window.editor.updatePlaceholder();
            }
            
            console.log('✅ Conteúdo aplicado no editor');
            
        } catch (error) {
            console.error('❌ Erro ao aplicar conteúdo no editor:', error);
        }
    }

    /**
     * SINCRONIZA CACHE LOCAL PARA SUPABASE
     */
    async syncLocalToSupabase(content) {
        console.log('🔄 Sincronizando cache local para Supabase...');
        
        try {
            const result = await window.SupabaseSync.salvarRichtextAnotacoes(
                this.currentSemana, 
                content
            );
            
            if (result.success) {
                console.log('✅ Sincronização cache → Supabase concluída');
                this.showLoadFeedback('Sincronizado ☁️', 'success');
            } else {
                console.log('⚠️ Falha na sincronização cache → Supabase');
            }
            
        } catch (error) {
            console.error('❌ Erro na sincronização cache → Supabase:', error);
        }
    }

    /**
     * FEEDBACK VISUAL
     */
    showLoadFeedback(message, type) {
        const statusDiv = document.getElementById('save-status');
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.className = `save-status show ${type}`;
            
            setTimeout(() => {
                statusDiv.classList.remove('show');
            }, 3000);
        }
        
        console.log(`📱 Feedback: ${message} (${type})`);
    }

    /**
     * MÉTODO PÚBLICO PARA FORÇAR RELOAD
     */
    async reloadContent() {
        this.loadAttempted = false;
        await this.loadContent();
    }

    /**
     * DEBUG - mostra status atual
     */
    debug() {
        console.log('=== DEBUG LOAD SYNC MANAGER ===');
        console.log('Semana atual:', this.currentSemana);
        console.log('Usuário logado:', this.isLoggedIn);
        console.log('Load tentado:', this.loadAttempted);
        console.log('Editor encontrado:', !!this.editor);
        console.log('SupabaseSync:', !!window.SupabaseSync);
        console.log('CacheRichText:', !!window.cacheRichText);
        
        if (this.editor) {
            console.log('Conteúdo atual do editor:', this.editor.innerHTML.substring(0, 100) + '...');
        }
    }
}

// Instância global
window.LoadSyncManager = new LoadSyncManager();

// Debug disponível no console
window.debugLoadSync = () => window.LoadSyncManager.debug();
window.reloadContent = () => window.LoadSyncManager.reloadContent();

console.log('🛠️ Use window.debugLoadSync() para debug');
console.log('🛠️ Use window.reloadContent() para forçar reload');