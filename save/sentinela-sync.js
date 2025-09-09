// save/sentinela-sync.js - Sincroniza anotações (comentários, IA) da Sentinela

class SentinelaSync {
    constructor() {
        this.semanaAtual = null;
        this.estudoId = null;
        this.isLoggedIn = false;
        this.isSyncing = false;
        this.autoSaveTimeout = null;
        this.lastSavedDataJSON = '{}'; // Armazena o último JSON enviado
        
        // Configurações
        this.SAVE_DELAY = 2500; // 2.5 segundos após a última anotação
        
        console.log('📖 SentinelaSync (Anotações) inicializando...');
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            // Pequeno delay para garantir que as variáveis globais da página sejam definidas
            setTimeout(() => this.setup(), 200);
        }
    }

    setup() {
        this.detectSemanaEEstudo();
        this.checkLoginStatus();
        
        if (this.isLoggedIn) {
            this.loadFromSupabase();
        }
        
        this.interceptCacheSalvar();
        
        console.log('✅ SentinelaSync (Anotações) configurado:', {
            semana: this.semanaAtual,
            estudo: this.estudoId,
            logado: this.isLoggedIn
        });
    }

    detectSemanaEEstudo() {
        const urlParams = new URLSearchParams(window.location.search);
        this.semanaAtual = window.semanaAtual || urlParams.get('semana');
        this.estudoId = window.estudoId || document.body.dataset.estudo;
    }

    checkLoginStatus() {
        this.isLoggedIn = !!localStorage.getItem('supabase_user');
    }

    interceptCacheSalvar() {
        if (!window.CacheAnotacao || typeof window.CacheAnotacao.salvar !== 'function') {
            console.warn('⚠️ CacheAnotacao não encontrado para interceptação.');
            return;
        }

        const originalSalvar = window.CacheAnotacao.salvar.bind(window.CacheAnotacao);
        
        window.CacheAnotacao.salvar = (id, conteudo) => {
            originalSalvar(id, conteudo);
            this.scheduleAutoSave();
        };

        console.log('🎯 Interceptador do CacheAnotacao ativado.');
    }

    scheduleAutoSave() {
        if (!this.isLoggedIn) return;
        clearTimeout(this.autoSaveTimeout);
        this.autoSaveTimeout = setTimeout(() => {
            this.executeAutoSave();
        }, this.SAVE_DELAY);
    }

    async executeAutoSave() {
        // ================== INÍCIO DA CORREÇÃO ==================
        // Adiciona uma guarda de segurança para esperar o SupabaseSync estar pronto.
        if (!window.SupabaseSync || typeof window.SupabaseSync.salvarSentinelaAnotacoes !== 'function') {
            console.warn('⚠️ SupabaseSync não está pronto. Tentando salvar novamente em 1s...');
            // Reagenda o salvamento em vez de falhar, tornando o sistema auto-corrigível.
            this.scheduleAutoSave(); 
            return;
        }
        // =================== FIM DA CORREÇÃO ===================

        if (this.isSyncing || !this.isLoggedIn) {
            return;
        }

        this.isSyncing = true;
        this.showStatus('☁️ Salvando anotações...', 'saving');

        try {
            const anotacoes = this.collectAnnotationsFromLocalStorage();
            const anotacoesJSON = JSON.stringify(anotacoes);

            if (anotacoesJSON === this.lastSavedDataJSON) {
                console.log('📖 Anotações inalteradas, skip auto-save.');
                this.isSyncing = false;
                this.showStatus('✅ Anotações salvas', 'success');
                return;
            }

            console.log(`💾 Auto-save Sentinela: ${Object.keys(anotacoes).length} anotações.`);

            const result = await window.SupabaseSync.salvarSentinelaAnotacoes(
                this.semanaAtual,
                this.estudoId,
                anotacoes
            );

            if (result.success) {
                this.lastSavedDataJSON = anotacoesJSON;
                console.log('✅ Auto-save Sentinela (Anotações) concluído.');
                this.showStatus('✅ Anotações salvas', 'success');
            } else {
                console.error('❌ Erro no auto-save de anotações:', result.error);
                this.showStatus('❌ Erro ao salvar', 'error');
            }

        } catch (error) {
            console.error('❌ Erro crítico no auto-save de anotações:', error);
            this.showStatus('❌ Erro de conexão', 'error');
        } finally {
            this.isSyncing = false;
        }
    }

    async loadFromSupabase() {
        if (!window.SupabaseSync) {
            console.log('Aguardando SupabaseSync...');
            setTimeout(() => this.loadFromSupabase(), 500);
            return;
        }
    
        const loadFlag = `sentinela_loaded_${this.semanaAtual}_${this.estudoId}`;
        if (sessionStorage.getItem(loadFlag)) {
            console.log('📖 Anotações já carregadas do Supabase nesta sessão.');
            return;
        }
    
        console.log('📥 Carregando anotações da Sentinela do Supabase...');
        this.showStatus('📥 Carregando da nuvem...', 'loading');
    
        try {
            const anotacoes = await window.SupabaseSync.carregarSentinelaAnotacoes(
                this.semanaAtual,
                this.estudoId
            );
    
            if (anotacoes && Object.keys(anotacoes).length > 0) {
                console.log(`✅ ${Object.keys(anotacoes).length} anotações recebidas. Populando localStorage...`);
    
                let localChangesExist = false;
                for (const [key, value] of Object.entries(anotacoes)) {
                    if (localStorage.getItem(key) !== value) {
                        localStorage.setItem(key, value);
                        localChangesExist = true;
                    }
                }
    
                if (localChangesExist) {
                    console.log('🔄 Dados atualizados. Recarregando a página...');
                    sessionStorage.setItem(loadFlag, 'true');
                    location.reload();
                } else {
                    console.log('👍 Dados locais já estão sincronizados.');
                    this.showStatus('👍 Sincronizado', 'success');
                }
            } else {
                console.log('📭 Nenhuma anotação encontrada na nuvem.');
                this.hideStatus();
            }
        } catch (error) {
            console.error('❌ Erro ao carregar anotações da Sentinela:', error);
            this.showStatus('❌ Erro ao carregar', 'error');
        }
    }
    
    collectAnnotationsFromLocalStorage() {
        const anotacoes = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (/^(c-|r-|p-|obj-)/.test(key)) {
                anotacoes[key] = localStorage.getItem(key);
            }
        }
        return anotacoes;
    }

    showStatus(message, type) {
        const el = document.getElementById('sentinela-status') || this.createStatusElement();
        el.textContent = message;
        el.className = `sentinela-status show ${type}`;
        
        if (type !== 'saving' && type !== 'loading') {
            setTimeout(() => {
                el.classList.remove('show');
            }, 3000);
        }
    }

    hideStatus() {
        const el = document.getElementById('sentinela-status');
        if (el) el.classList.remove('show');
    }

    createStatusElement() {
        let el = document.getElementById('sentinela-status');
        if (!el) {
            el = document.createElement('div');
            el.id = 'sentinela-status';
            document.body.appendChild(el);
        }
        return el;
    }
}

new SentinelaSync();