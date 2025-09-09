// save/sync.js - Sistema de sincronização manual do richtext com Supabase

class RichtextSync {
    constructor() {
        this.currentSemana = null;
        this.isLoggedIn = false;
        this.isSyncing = false;
        
        console.log('🔄 RichtextSync carregando...');
        this.init();
    }

    init() {
        // Aguarda todos os sistemas estarem prontos
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            setTimeout(() => this.setup(), 200); // Delay para garantir que tudo carregou
        }
    }

    setup() {
        // 1. Detecta semana atual
        this.detectSemana();
        
        // 2. Verifica login
        this.checkLoginStatus();
        
        // 3. Intercepta botão Salvar na navbar
        this.setupSaveButtonHandler();
        
        console.log('✅ RichtextSync configurado:', {
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

        // Método 2: URLSearchParams (igual cache-r.js)  
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
     * INTERCEPTA BOTÃO SALVAR
     */
    setupSaveButtonHandler() {
        // Aguarda navbar estar carregada
        const waitForNavbar = () => {
            const saveButton = document.querySelector('[data-page="save"]');
            if (saveButton) {
                this.interceptSaveButton(saveButton);
            } else {
                setTimeout(waitForNavbar, 100);
            }
        };
        waitForNavbar();
    }

    interceptSaveButton(saveButton) {
        console.log('🔗 Interceptando botão Salvar da navbar...');
        
        saveButton.addEventListener('click', (event) => {
            event.preventDefault(); // Impede ação padrão
            this.handleSaveClick();
        });
        
        console.log('✅ Botão Salvar interceptado');
    }

    /**
     * AÇÃO DO BOTÃO SALVAR
     */
    async handleSaveClick() {
        console.log('💾 Botão Salvar clicado!');

        // 1. Verifica se está logado
        if (!this.isLoggedIn) {
            console.log('❌ Não logado - redirecionando...');
            this.redirectToLogin();
            return;
        }

        // 2. Verifica se tem semana
        if (!this.currentSemana) {
            console.error('❌ Semana não detectada');
            this.showFeedback('Erro: semana não detectada', 'error');
            return;
        }

        // 3. Pega texto do editor
        const editor = document.getElementById('text-editor');
        if (!editor) {
            console.error('❌ Editor não encontrado');
            this.showFeedback('Erro: editor não encontrado', 'error');
            return;
        }

        const htmlContent = editor.innerHTML;
        const textContent = editor.textContent.trim();

        // 4. Verifica se tem conteúdo
        if (!textContent || textContent.length < 3) {
            console.log('⚠️ Editor vazio - nada para salvar');
            this.showFeedback('Editor vazio', 'error');
            return;
        }

        // 5. Salva no Supabase
        await this.syncToSupabase(htmlContent);
    }

    /**
     * SINCRONIZAÇÃO COM SUPABASE
     */
    async syncToSupabase(htmlContent) {
        if (this.isSyncing) {
            console.log('⏳ Já está sincronizando...');
            return;
        }

        this.isSyncing = true;
        console.log('☁️ Iniciando sincronização...', {
            semana: this.currentSemana,
            tamanho: htmlContent.length,
            preview: htmlContent.substring(0, 50) + '...'
        });

        // Feedback visual: loading
        this.showFeedback('Salvando...', 'saving');

        try {
            // Chama método do Supabase
            const result = await window.SupabaseSync.salvarRichtextAnotacoes(
                this.currentSemana,
                htmlContent
            );

            if (result.success) {
                console.log('✅ Sincronização bem-sucedida!');
                this.showFeedback('☁️ Salvo na nuvem!', 'success');
                
                // Força save do cache local também (para manter sincronizado)
                if (window.cacheRichText && typeof window.cacheRichText.salvar === 'function') {
                    window.cacheRichText.salvar();
                    console.log('💾 Cache local também atualizado');
                }
                
            } else {
                console.error('❌ Erro na sincronização:', result.error);
                this.showFeedback('❌ Erro ao salvar', 'error');
            }

        } catch (error) {
            console.error('❌ Erro fatal na sincronização:', error);
            this.showFeedback('❌ Erro de conexão', 'error');
        }

        this.isSyncing = false;
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
     * REDIRECIONA PARA LOGIN
     */
    redirectToLogin() {
        const currentUrl = encodeURIComponent(window.location.href);
        window.location.href = `../save/auth-supabase.html?return=${currentUrl}`;
    }

    /**
     * DEBUG - mostra status atual
     */
    debug() {
        console.log('=== DEBUG RICHTEXT SYNC ===');
        console.log('Semana atual:', this.currentSemana);
        console.log('Usuário logado:', this.isLoggedIn);
        console.log('Sincronizando:', this.isSyncing);
        console.log('SupabaseSync:', !!window.SupabaseSync);
        
        const editor = document.getElementById('text-editor');
        if (editor) {
            console.log('Editor encontrado:', true);
            console.log('Conteúdo HTML:', editor.innerHTML.substring(0, 100) + '...');
            console.log('Conteúdo texto:', editor.textContent.substring(0, 100) + '...');
        } else {
            console.log('Editor encontrado:', false);
        }
    }

    /**
     * MÉTODO PÚBLICO para salvar manualmente
     */
    async salvarManual() {
        await this.handleSaveClick();
    }
}

// Instância global
window.RichtextSync = new RichtextSync();

// Debug disponível no console
window.debugRichtextSync = () => window.RichtextSync.debug();
window.salvarManual = () => window.RichtextSync.salvarManual();

console.log('🛠️ Use window.debugRichtextSync() para debug');
console.log('🛠️ Use window.salvarManual() para testar sync manual');