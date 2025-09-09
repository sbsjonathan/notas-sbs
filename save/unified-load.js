// save/unified-load.js - Sistema UNIFICADO de carregamento para RichText
// Este arquivo substitui SimpleAutoLoad, SyncBridge e partes do RichtextSync

class UnifiedLoadManager {
    constructor() {
        // Estado principal
        this.editor = null;
        this.currentSemana = null;
        this.isLoggedIn = false;
        this.isLoading = false;
        this.lastLoadedContent = '';
        this.loadAttempts = 0;
        
        // Configurações
        this.MAX_SUPABASE_WAIT = 10000; // 10 segundos de espera máxima
        this.RETRY_DELAY = 1000; // 1 segundo entre tentativas
        this.MAX_RETRIES = 3; // 3 tentativas se falhar
        
        console.log('🚀 UnifiedLoadManager inicializando...');
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            // Pequeno delay para garantir que tudo carregou
            setTimeout(() => this.setup(), 100);
        }
    }

    async setup() {
        console.log('📋 Configurando sistema unificado de load...');
        
        // 1. Detecta informações básicas
        this.detectSemana();
        this.checkLoginStatus();
        
        // 2. Aguarda editor e Supabase
        await this.waitForDependencies();
        
        // 3. Executa o carregamento principal
        await this.executeMainLoad();
        
        // 4. Configura listeners para mudanças
        this.setupListeners();
        
        console.log('✅ Sistema de load configurado e executado');
    }

    /**
     * DETECTA SEMANA ATUAL - Versão unificada
     */
    detectSemana() {
        // Prioridade 1: URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const semanaURL = urlParams.get('semana');
        if (semanaURL) {
            this.currentSemana = semanaURL;
            console.log('📅 Semana detectada via URL:', this.currentSemana);
            this.updateSemanaIndicator();
            return;
        }

        // Prioridade 2: window.semanaAtual
        if (window.semanaAtual) {
            this.currentSemana = window.semanaAtual;
            console.log('📅 Semana detectada via window:', this.currentSemana);
            this.updateSemanaIndicator();
            return;
        }

        // Prioridade 3: weekManager
        if (window.weekManager?.getCurrentWeek) {
            this.currentSemana = window.weekManager.getCurrentWeek();
            console.log('📅 Semana detectada via weekManager:', this.currentSemana);
            this.updateSemanaIndicator();
            return;
        }

        // Fallback: data atual
        const agora = new Date();
        const dia = String(agora.getDate()).padStart(2, '0');
        const mes = String(agora.getMonth() + 1).padStart(2, '0');
        this.currentSemana = `${dia}-${mes}`;
        console.log('📅 Semana fallback (data atual):', this.currentSemana);
        this.updateSemanaIndicator();
    }

    /**
     * VERIFICA STATUS DE LOGIN
     */
    checkLoginStatus() {
        const savedUser = localStorage.getItem('supabase_user');
        this.isLoggedIn = !!savedUser;
        console.log('👤 Status de login:', this.isLoggedIn ? 'Logado' : 'Não logado');
    }

    /**
     * AGUARDA DEPENDÊNCIAS ESTAREM PRONTAS
     */
    async waitForDependencies() {
        console.log('⏳ Aguardando dependências...');
        
        // Aguarda editor
        await this.waitForEditor();
        
        // Se logado, aguarda Supabase
        if (this.isLoggedIn) {
            await this.waitForSupabase();
        }
        
        console.log('✅ Todas as dependências prontas');
    }

    /**
     * AGUARDA EDITOR ESTAR DISPONÍVEL
     */
    waitForEditor() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 100; // 10 segundos máximo
            
            const checkEditor = () => {
                this.editor = document.getElementById('text-editor');
                
                if (this.editor) {
                    console.log('📝 Editor encontrado');
                    resolve();
                } else if (attempts >= maxAttempts) {
                    console.error('❌ Editor não encontrado após 10 segundos');
                    resolve(); // Resolve mesmo assim para não travar
                } else {
                    attempts++;
                    setTimeout(checkEditor, 100);
                }
            };
            
            checkEditor();
        });
    }

    /**
     * AGUARDA SUPABASE ESTAR PRONTO
     */
    waitForSupabase() {
        return new Promise((resolve) => {
            const startTime = Date.now();
            
            const checkSupabase = () => {
                const elapsed = Date.now() - startTime;
                
                // Verifica se Supabase está completamente pronto
                if (window.SupabaseSync && 
                    typeof window.SupabaseSync.carregarRichtextAnotacoes === 'function') {
                    console.log('☁️ SupabaseSync pronto');
                    resolve();
                } else if (elapsed >= this.MAX_SUPABASE_WAIT) {
                    console.warn('⚠️ SupabaseSync não inicializou em 10s - continuando sem ele');
                    resolve();
                } else {
                    // Continua tentando
                    setTimeout(checkSupabase, 100);
                }
            };
            
            checkSupabase();
        });
    }

    /**
     * EXECUTA O CARREGAMENTO PRINCIPAL
     */
    async executeMainLoad() {
        if (this.isLoading) {
            console.log('⏳ Já está carregando...');
            return;
        }

        if (!this.currentSemana) {
            console.error('❌ Semana não detectada - não é possível carregar');
            return;
        }

        this.isLoading = true;
        console.log('🔄 Iniciando carregamento principal...');

        // Mostra loading apenas se estiver logado
        if (this.isLoggedIn) {
            this.showLoading();
        }

        try {
            let content = null;
            let source = null;

            // PASSO 1: Se logado, tenta Supabase primeiro
            if (this.isLoggedIn && window.SupabaseSync) {
                content = await this.loadFromSupabase();
                if (content) {
                    source = 'Supabase';
                }
            }

            // PASSO 2: Se não conseguiu do Supabase, tenta cache local
            if (!content) {
                content = await this.loadFromLocalCache();
                if (content) {
                    source = 'Cache Local';
                }
            }

            // PASSO 3: Aplica o conteúdo se encontrou
            if (content && content.trim()) {
                this.applyContentToEditor(content);
                this.lastLoadedContent = content;
                this.showFeedback(`Carregado do ${source}`, 'success');
                console.log(`✅ Conteúdo carregado do ${source}`);
            } else {
                console.log('📄 Nenhum conteúdo salvo encontrado - novo documento');
                this.showFeedback('Novo documento', 'info');
            }

        } catch (error) {
            console.error('❌ Erro no carregamento:', error);
            this.showFeedback('Erro ao carregar', 'error');
            
            // Tenta novamente se for a primeira tentativa
            if (this.loadAttempts < this.MAX_RETRIES) {
                this.loadAttempts++;
                console.log(`🔄 Tentando novamente (${this.loadAttempts}/${this.MAX_RETRIES})...`);
                setTimeout(() => {
                    this.isLoading = false;
                    this.executeMainLoad();
                }, this.RETRY_DELAY);
                return;
            }
        } finally {
            this.hideLoading();
            this.isLoading = false;
        }
    }

    /**
     * CARREGA DO SUPABASE COM RETRY
     */
    async loadFromSupabase() {
        try {
            console.log('☁️ Carregando do Supabase...');
            
            // Garante que o usuário ainda está logado
            this.checkLoginStatus();
            if (!this.isLoggedIn) {
                console.log('❌ Usuário não está mais logado');
                return null;
            }

            const content = await window.SupabaseSync.carregarRichtextAnotacoes(this.currentSemana);
            
            if (content && content.trim()) {
                console.log('✅ Conteúdo encontrado no Supabase');
                return content;
            } else {
                console.log('📭 Nenhum conteúdo no Supabase para esta semana');
                return null;
            }
        } catch (error) {
            console.error('❌ Erro ao carregar do Supabase:', error);
            return null;
        }
    }

    /**
     * CARREGA DO CACHE LOCAL
     */
    async loadFromLocalCache() {
        try {
            console.log('💾 Carregando do cache local...');
            
            // Método 1: Usar cacheRichText se disponível
            if (window.cacheRichText && typeof window.cacheRichText.carregar === 'function') {
                const content = window.cacheRichText.carregar();
                if (content && content.trim()) {
                    console.log('✅ Conteúdo encontrado via cacheRichText');
                    return content;
                }
            }

            // Método 2: Acessar localStorage diretamente
            const chaveCache = `richtext_cache_${this.currentSemana}`;
            const dadosString = localStorage.getItem(chaveCache);
            
            if (dadosString) {
                const dados = JSON.parse(dadosString);
                if (dados.conteudo && dados.conteudo.trim()) {
                    console.log('✅ Conteúdo encontrado no localStorage');
                    return dados.conteudo;
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
            console.error('❌ Editor não disponível para aplicar conteúdo');
            return;
        }

        try {
            // Aplica o conteúdo
            this.editor.innerHTML = content;
            
            // Atualiza classes
            if (content.trim() === '') {
                this.editor.classList.add('is-empty');
            } else {
                this.editor.classList.remove('is-empty');
            }
            
            // Atualiza estatísticas se disponível
            if (window.editor && typeof window.editor.updateStats === 'function') {
                window.editor.updateStats();
            }
            
            // Atualiza placeholder se disponível
            if (window.editor && typeof window.editor.updatePlaceholder === 'function') {
                window.editor.updatePlaceholder();
            }
            
            console.log('✅ Conteúdo aplicado no editor');
            
        } catch (error) {
            console.error('❌ Erro ao aplicar conteúdo no editor:', error);
        }
    }

    /**
     * CONFIGURA LISTENERS PARA MUDANÇAS
     */
    setupListeners() {
        // Listener para mudanças de login
        window.addEventListener('storage', (e) => {
            if (e.key === 'supabase_user') {
                const wasLoggedIn = this.isLoggedIn;
                this.checkLoginStatus();
                
                // Se fez login, recarrega do Supabase
                if (!wasLoggedIn && this.isLoggedIn) {
                    console.log('🔄 Login detectado - recarregando do Supabase...');
                    this.loadAttempts = 0; // Reset attempts
                    this.executeMainLoad();
                }
            }
        });

        // Listener para mudanças de semana
        document.addEventListener('semanaChanged', (e) => {
            const novaSemana = e.detail.semana;
            if (novaSemana !== this.currentSemana) {
                console.log('📅 Semana mudou:', this.currentSemana, '→', novaSemana);
                this.currentSemana = novaSemana;
                this.updateSemanaIndicator();
                this.loadAttempts = 0; // Reset attempts
                this.executeMainLoad();
            }
        });

        // Método público para forçar recarregamento
        window.forceLoadFromSupabase = () => {
            console.log('🔄 Recarregamento forçado solicitado');
            this.loadAttempts = 0;
            this.executeMainLoad();
        };
    }

    /**
     * ATUALIZA INDICADOR DE SEMANA
     */
    updateSemanaIndicator() {
        const indicator = document.getElementById('semana-indicator');
        if (indicator && this.currentSemana) {
            indicator.textContent = `Semana: ${this.currentSemana}`;
        }
    }

    /**
     * MOSTRA LOADING OVERLAY
     */
    showLoading() {
        const overlay = document.getElementById('supabase-loading');
        if (overlay) {
            overlay.classList.add('show');
        }
    }

    /**
     * ESCONDE LOADING OVERLAY
     */
    hideLoading() {
        const overlay = document.getElementById('supabase-loading');
        if (overlay) {
            // Pequeno delay para evitar flash
            setTimeout(() => {
                overlay.classList.remove('show');
            }, 300);
        }
    }

    /**
     * MOSTRA FEEDBACK VISUAL
     */
    showFeedback(message, type) {
        const statusDiv = document.getElementById('save-status');
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.className = `save-status show ${type}`;
            
            // Remove após 3 segundos
            setTimeout(() => {
                statusDiv.classList.remove('show');
            }, 3000);
        }
        
        console.log(`📢 Feedback: ${message} (${type})`);
    }

    /**
     * MÉTODOS PÚBLICOS PARA DEBUG
     */
    getStatus() {
        return {
            semana: this.currentSemana,
            logado: this.isLoggedIn,
            carregando: this.isLoading,
            tentativas: this.loadAttempts,
            ultimoConteudo: this.lastLoadedContent ? this.lastLoadedContent.length + ' caracteres' : 'nenhum',
            editor: !!this.editor,
            supabaseDisponivel: !!window.SupabaseSync
        };
    }

    debug() {
        console.log('=== DEBUG UNIFIED LOAD MANAGER ===');
        console.log('Status:', this.getStatus());
        console.log('Editor HTML:', this.editor ? this.editor.innerHTML.substring(0, 100) + '...' : 'N/A');
        console.log('Cache keys:', Object.keys(localStorage).filter(k => k.includes('richtext')));
    }
}

// Instância global única
window.UnifiedLoadManager = new UnifiedLoadManager();

// Atalhos globais para debug
window.loadStatus = () => window.UnifiedLoadManager.getStatus();
window.debugLoad = () => window.UnifiedLoadManager.debug();

console.log('✅ UnifiedLoadManager carregado - Sistema de load unificado ativo');