// save/sync-bridge.js - Sistema que conecta todas as páginas

class SyncBridge {
    constructor() {
        this.currentSemana = null;
        this.isLoggedIn = false;
        this.hasLoadedFromSupabase = false; // NOVO: Flag para controlar carregamento
        
        console.log('🌉 SyncBridge iniciando - conectando todas as páginas...');
        this.init();
    }

    init() {
        this.detectSemana();
        this.checkLoginStatus();
        this.checkIfAlreadyLoaded(); // NOVO: Verifica se já carregou
        this.setupStorageListener();
        this.setupPeriodicCheck();
        
        // Se for página do editor, aguarda editor estar pronto
        if (window.location.pathname.includes('richtext') || window.location.pathname.includes('container')) {
            this.waitForEditor();
        }
        
        console.log('✅ SyncBridge ativo:', {
            semana: this.currentSemana,
            logado: this.isLoggedIn,
            jaCarregou: this.hasLoadedFromSupabase,
            pagina: this.detectPage()
        });
    }

    detectPage() {
        const path = window.location.pathname;
        if (path.includes('richtext') || path.includes('container')) return 'editor';
        if (path.includes('auth') || path.includes('save')) return 'login';
        return 'other';
    }

    detectSemana() {
        this.currentSemana = window.semanaAtual || 
                            new URLSearchParams(window.location.search).get('semana') ||
                            this.getFallbackWeek();
    }

    getFallbackWeek() {
        const agora = new Date();
        const dia = String(agora.getDate()).padStart(2, '0');
        const mes = String(agora.getMonth() + 1).padStart(2, '0');
        return `${dia}-${mes}`;
    }

    checkLoginStatus() {
        const savedUser = localStorage.getItem('supabase_user');
        this.isLoggedIn = !!savedUser;
    }

    /**
     * NOVO: Verifica se já carregou do Supabase para esta semana
     */
    checkIfAlreadyLoaded() {
        const loadKey = `supabase_loaded_${this.currentSemana}`;
        const lastLoaded = localStorage.getItem(loadKey);
        
        console.log('🔍 Verificando se já carregou:', {
            semana: this.currentSemana,
            chave: loadKey,
            valorSalvo: lastLoaded,
            logado: this.isLoggedIn
        });
        
        if (lastLoaded && this.isLoggedIn) {
            this.hasLoadedFromSupabase = true;
            console.log('✅ JÁ CARREGOU do Supabase para esta semana - usará cache local');
        } else {
            this.hasLoadedFromSupabase = false;
            console.log('📭 AINDA NÃO CARREGOU do Supabase para esta semana - carregará do Supabase');
        }
        
        return this.hasLoadedFromSupabase;
    }

    /**
     * NOVO: Marca que já carregou do Supabase
     */
    markAsLoaded() {
        const loadKey = `supabase_loaded_${this.currentSemana}`;
        const timestamp = Date.now().toString();
        localStorage.setItem(loadKey, timestamp);
        this.hasLoadedFromSupabase = true;
        
        console.log('✅ MARCADO COMO CARREGADO:', {
            semana: this.currentSemana,
            chave: loadKey,
            timestamp: timestamp,
            flag: this.hasLoadedFromSupabase
        });
    }

    /**
     * NOVO: Força nova carga (limpa a marca)
     */
    clearLoadedFlag() {
        const loadKey = `supabase_loaded_${this.currentSemana}`;
        localStorage.removeItem(loadKey);
        this.hasLoadedFromSupabase = false;
        console.log('🗑️ Flag de carregamento limpa - próximo load será do Supabase');
    }

    /**
     * ESCUTA MUDANÇAS EM OUTRAS ABAS/PÁGINAS
     */
    setupStorageListener() {
        // Escuta mudanças no localStorage
        window.addEventListener('storage', (e) => {
            console.log('🔔 Mudança detectada:', e.key);
            
            if (e.key === 'sync_signal_content_updated') {
                this.handleContentUpdated(e.newValue);
            }
            else if (e.key === 'sync_signal_load_content') {
                this.handleLoadRequest(e.newValue);
            }
            else if (e.key === 'supabase_user') {
                this.handleLoginStatusChanged(e.newValue);
            }
        });

        // Para mudanças na mesma aba (não funciona com storage event)
        this.setupCustomEvents();
    }

    /**
     * EVENTOS PERSONALIZADOS PARA MESMA ABA
     */
    setupCustomEvents() {
        document.addEventListener('syncbridge_content_updated', (e) => {
            console.log('🔔 Conteúdo atualizado (mesma aba)');
            this.applyContentToEditor(e.detail.content);
        });

        document.addEventListener('syncbridge_load_request', (e) => {
            console.log('🔔 Solicitação de carregamento (mesma aba)');
            this.executeLoad();
        });
    }

    /**
     * VERIFICA MUDANÇAS PERIODICAMENTE - REMOVIDO O AUTO-LOAD
     */
    setupPeriodicCheck() {
        // Apenas monitora login status, SEM carregar automaticamente
        setInterval(() => {
            const newLoginStatus = !!localStorage.getItem('supabase_user');
            if (newLoginStatus !== this.isLoggedIn) {
                console.log('🔄 Login status changed:', newLoginStatus);
                this.isLoggedIn = newLoginStatus;
                
                // REMOVIDO: Não carrega automaticamente quando detecta login
                // if (newLoginStatus) {
                //     setTimeout(() => {
                //         this.executeLoad();
                //     }, 1000);
                // }
            }
        }, 2000);
    }

    /**
     * AGUARDA EDITOR ESTAR PRONTO - SEM AUTO-LOAD
     */
    waitForEditor() {
        const checkEditor = () => {
            const editor = document.getElementById('text-editor');
            if (editor) {
                console.log('📝 Editor encontrado - SyncBridge conectado (sem auto-load)');
                // REMOVIDO: Auto-load quando encontra editor
                // setTimeout(() => {
                //     this.smartLoad('editor_open');
                // }, 500);
            } else {
                setTimeout(checkEditor, 200);
            }
        };
        checkEditor();
    }

    // === HANDLERS === //

    handleContentUpdated(newValueJson) {
        try {
            const data = JSON.parse(newValueJson);
            if (data.semana === this.currentSemana) {
                console.log('📥 Aplicando conteúdo atualizado de outra página');
                this.applyContentToEditor(data.content);
            }
        } catch (e) {
            console.error('Erro ao processar conteúdo atualizado:', e);
        }
    }

    handleLoadRequest(newValueJson) {
        console.log('📥 Solicitação de carregamento de outra página');
        // Se for request forçado, força carregamento do Supabase
        try {
            const data = JSON.parse(newValueJson);
            if (data.forced) {
                this.clearLoadedFlag(); // Limpa flag para forçar Supabase
            }
        } catch (e) {}
        
        this.smartLoad('manual');
    }

    handleLoginStatusChanged(newValue) {
        const wasLoggedIn = this.isLoggedIn;
        this.isLoggedIn = !!newValue;
        
        console.log('👤 Status login mudou:', wasLoggedIn, '→', this.isLoggedIn);
        
        // REMOVIDO: Não carrega automaticamente quando detecta mudança de login
        // if (!wasLoggedIn && this.isLoggedIn) {
        //     setTimeout(() => {
        //         this.executeLoad();
        //     }, 1000);
        // }
    }

    // === AÇÕES === //

    /**
     * NOVO: Carregamento inteligente que decide de onde carregar
     */
    async smartLoad(trigger = 'manual') {
        if (!this.currentSemana) {
            console.log('⚠️ Semana não detectada');
            return;
        }

        // Atualiza status antes de decidir
        this.checkLoginStatus();
        this.checkIfAlreadyLoaded();

        console.log(`🧠 Smart Load (${trigger}):`, {
            logado: this.isLoggedIn,
            jaCarregou: this.hasLoadedFromSupabase,
            semana: this.currentSemana,
            trigger: trigger,
            internet: navigator.onLine
        });

        // LÓGICA SIMPLIFICADA:
        // Se trigger for 'editor_open' E já carregou E está logado → só cache local
        // Caso contrário → tenta Supabase se logado

        let useOnlyCache = (trigger === 'editor_open' && this.hasLoadedFromSupabase && this.isLoggedIn);

        console.log('🔍 Decisão de carregamento:', {
            useOnlyCache: useOnlyCache,
            motivo: useOnlyCache ? 'Já carregou do Supabase anteriormente' : 'Primeira vez ou carregamento manual'
        });

        // Se vai tentar Supabase E tem internet, mostra loading
        const willTrySupabase = !useOnlyCache && this.isLoggedIn && navigator.onLine;
        if (willTrySupabase) {
            this.showSupabaseLoading();
        }

        try {
            let content = null;
            let source = 'nenhum';

            // Se deve usar só cache, pula Supabase
            if (!useOnlyCache && this.isLoggedIn && window.SupabaseSync) {
                console.log('☁️ Carregando do Supabase...');
                content = await window.SupabaseSync.carregarRichtextAnotacoes(this.currentSemana);
                if (content) {
                    source = 'supabase';
                    this.markAsLoaded(); // Marca como carregado
                    console.log('✅ Carregado do Supabase (marcado como carregado)');
                }
            }

            // Fallback para cache local
            if (!content) {
                console.log('💾 Carregando do cache local...');
                content = this.loadFromLocalCache();
                if (content) {
                    source = 'cache-local';
                    console.log('✅ Carregado do cache local');
                }
            }

            // Aplica se encontrou conteúdo
            if (content && content.trim()) {
                this.applyContentToEditor(content);
                this.showFeedback(`Carregado (${source})`, 'success');
                
                // Sinaliza para outras páginas
                this.signalContentUpdated(content);
            } else {
                console.log('📝 Nenhum conteúdo encontrado');
                this.showFeedback('Nenhum conteúdo salvo', 'info');
            }

        } catch (error) {
            console.error('❌ Erro no carregamento:', error);
            this.showFeedback('Erro no carregamento', 'error');
        } finally {
            // Remove loading sempre
            if (willTrySupabase) {
                this.hideSupabaseLoading();
            }
        }
    }

    /**
     * DEPRECATED: Mantido para compatibilidade, mas usa smartLoad
     */
    async executeLoad() {
        return this.smartLoad('manual');
    }

    /**
     * CARREGA DO CACHE LOCAL
     */
    loadFromLocalCache() {
        try {
            const chaveCache = `richtext_cache_${this.currentSemana}`;
            const dadosString = localStorage.getItem(chaveCache);
            
            if (dadosString) {
                const dados = JSON.parse(dadosString);
                return dados.conteudo || null;
            }
            
            return null;
        } catch (error) {
            console.error('Erro ao carregar do cache local:', error);
            return null;
        }
    }

    /**
     * APLICA CONTEÚDO NO EDITOR
     */
    applyContentToEditor(content) {
        const editor = document.getElementById('text-editor');
        if (!editor) {
            console.log('⚠️ Editor não encontrado - salvando para aplicar depois');
            this.pendingContent = content;
            return;
        }

        try {
            editor.innerHTML = content;
            
            // Atualiza classe empty
            if (content.trim() === '') {
                editor.classList.add('is-empty');
            } else {
                editor.classList.remove('is-empty');
            }
            
            // Atualiza estatísticas se disponível
            if (window.editor && typeof window.editor.updateStats === 'function') {
                window.editor.updateStats();
                window.editor.updatePlaceholder();
            }
            
            console.log('✅ Conteúdo aplicado no editor');
            
        } catch (error) {
            console.error('❌ Erro ao aplicar conteúdo:', error);
        }
    }

    /**
     * SINALIZA MUDANÇAS PARA OUTRAS PÁGINAS
     */
    signalContentUpdated(content) {
        const signal = {
            content: content,
            semana: this.currentSemana,
            timestamp: Date.now()
        };

        // Para outras abas
        localStorage.setItem('sync_signal_content_updated', JSON.stringify(signal));
        
        // Remove o sinal para permitir novo trigger
        setTimeout(() => {
            localStorage.removeItem('sync_signal_content_updated');
        }, 100);

        // Para mesma aba
        document.dispatchEvent(new CustomEvent('syncbridge_content_updated', {
            detail: signal
        }));
    }

    /**
     * SOLICITA CARREGAMENTO EM TODAS AS PÁGINAS - FORÇADO
     */
    requestLoadInAllPages() {
        // Primeiro limpa a flag para forçar carregamento do Supabase
        this.clearLoadedFlag();
        
        const signal = {
            semana: this.currentSemana,
            timestamp: Date.now(),
            forced: true // Marca como forçado
        };

        // Para outras abas
        localStorage.setItem('sync_signal_load_content', JSON.stringify(signal));
        
        // Remove o sinal
        setTimeout(() => {
            localStorage.removeItem('sync_signal_load_content');
        }, 100);

        // Para mesma aba
        document.dispatchEvent(new CustomEvent('syncbridge_load_request', {
            detail: signal
        }));

        console.log('📡 Carregamento FORÇADO enviado para todas as páginas');
    }

    /**
     * FEEDBACK VISUAL
     */
    showFeedback(message, type) {
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
     * NOVO: Controles do loading overlay do Supabase
     */
    showSupabaseLoading() {
        const loadingOverlay = document.getElementById('supabase-loading');
        if (loadingOverlay) {
            loadingOverlay.classList.add('show');
            console.log('⏳ Loading Supabase mostrado');
        }
    }

    hideSupabaseLoading() {
        const loadingOverlay = document.getElementById('supabase-loading');
        if (loadingOverlay) {
            // Pequeno delay para evitar flash muito rápido
            setTimeout(() => {
                loadingOverlay.classList.remove('show');
                console.log('✅ Loading Supabase escondido');
            }, 300);
        }
    }

    // === MÉTODOS PÚBLICOS === //

    forceLoad() {
        console.log('🔄 Carregamento forçado iniciado');
        this.clearLoadedFlag(); // Limpa flag para forçar Supabase
        this.smartLoad('manual');
    }

    forceLoadAllPages() {
        console.log('🔄 Carregamento forçado em TODAS as páginas');
        this.requestLoadInAllPages();
    }

    getStatus() {
        return {
            semana: this.currentSemana,
            logado: this.isLoggedIn,
            jaCarregou: this.hasLoadedFromSupabase,
            pagina: this.detectPage(),
            temEditor: !!document.getElementById('text-editor')
        };
    }

    debug() {
        console.log('=== DEBUG SYNC BRIDGE ===');
        console.log('Status:', this.getStatus());
        console.log('SupabaseSync:', !!window.SupabaseSync);
        
        const loadKey = `supabase_loaded_${this.currentSemana}`;
        console.log('Flag de carregamento:', localStorage.getItem(loadKey));
        
        const editor = document.getElementById('text-editor');
        if (editor) {
            console.log('Conteúdo do editor:', editor.innerHTML.substring(0, 100) + '...');
        }
    }
}

// Instância global
if (!window.SyncBridge) {
    window.SyncBridge = new SyncBridge();
}

// Métodos públicos
window.forceLoad = () => window.SyncBridge.forceLoad();
window.forceLoadAllPages = () => window.SyncBridge.forceLoadAllPages();
window.syncBridgeStatus = () => window.SyncBridge.getStatus();
window.debugSyncBridge = () => window.SyncBridge.debug();
window.clearLoadFlag = () => window.SyncBridge.clearLoadedFlag(); // NOVO: para debug

console.log('🌉 SyncBridge carregado!');
console.log('🛠️ Comandos: window.forceLoad(), window.forceLoadAllPages(), window.debugSyncBridge()');
console.log('🛠️ Debug: window.clearLoadFlag() - limpa flag de carregamento');