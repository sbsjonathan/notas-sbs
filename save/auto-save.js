// save/auto-save.js - Sistema de Auto-Save Inteligente para Supabase

class AutoSaveManager {
    constructor() {
        this.editor = null;
        this.currentSemana = null;
        this.isLoggedIn = false;
        this.autoSaveTimeout = null;
        this.lastSavedContent = '';
        this.saveInProgress = false;
        
        // Configurações
        this.SAVE_DELAY = 80; // 80ms após parar de digitar (super rápido)
        this.MIN_CONTENT_LENGTH = 0; // MUDADO: Salva sempre, mesmo vazio
        
        console.log('💾 AutoSaveManager inicializando...');
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            setTimeout(() => this.setup(), 500);
        }
    }

    setup() {
        // 1. Detecta semana e login
        this.detectSemana();
        this.checkLoginStatus();
        
        // 2. Aguarda editor estar pronto
        this.waitForEditor();
        
        console.log('✅ AutoSaveManager configurado:', {
            semana: this.currentSemana,
            logado: this.isLoggedIn,
            delay: this.SAVE_DELAY + 'ms'
        });
    }

    detectSemana() {
        this.currentSemana = window.semanaAtual || 
                            new URLSearchParams(window.location.search).get('semana') ||
                            this.getFallbackWeek();
        console.log('📅 Semana detectada:', this.currentSemana);
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
        console.log('👤 Status login:', this.isLoggedIn ? 'Logado' : 'Não logado');
    }

    waitForEditor() {
        const checkEditor = () => {
            const editor = document.getElementById('text-editor');
            if (editor) {
                this.editor = editor;
                this.setupAutoSave();
                console.log('📝 Editor encontrado, auto-save ativado');
            } else {
                setTimeout(checkEditor, 200);
            }
        };
        checkEditor();
    }

    setupAutoSave() {
        if (!this.editor) return;

        // Salva conteúdo inicial para comparação
        this.lastSavedContent = this.editor.innerHTML;

        // Eventos que trigam auto-save
        const events = ['input', 'keyup', 'paste', 'cut'];
        
        events.forEach(event => {
            this.editor.addEventListener(event, () => {
                this.onContentChange();
            });
        });

        // Auto-save quando perde foco
        this.editor.addEventListener('blur', () => {
            this.onFocusLost();
        });

        // Auto-save antes de sair da página
        window.addEventListener('beforeunload', () => {
            this.onPageUnload();
        });

        // Monitora mudanças de login
        this.monitorLoginChanges();

        console.log('🎯 Eventos de auto-save configurados');
    }

    onContentChange() {
        // Cancela save anterior se ainda não executou
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }

        // Programa novo save com delay
        this.autoSaveTimeout = setTimeout(() => {
            this.executeAutoSave('input');
        }, this.SAVE_DELAY);

        // Feedback visual de "digitando..."
        this.showTypingFeedback();
    }

    onFocusLost() {
        // Auto-save imediato quando perde foco
        clearTimeout(this.autoSaveTimeout);
        setTimeout(() => {
            this.executeAutoSave('blur');
        }, 500);
    }

    onPageUnload() {
        // Auto-save síncrono antes de sair
        this.executeAutoSave('unload', true);
    }

    async executeAutoSave(trigger = 'auto', isSync = false) {
        if (this.saveInProgress) {
            console.log('⏳ Save já em progresso, ignorando...');
            return;
        }

        if (!this.editor || !this.currentSemana) {
            console.log('⚠️ Editor ou semana não disponível');
            return;
        }

        const currentContent = this.editor.innerHTML;
        const textContent = this.editor.textContent.trim();

        // Verifica se houve mudança real
        if (currentContent === this.lastSavedContent) {
            console.log('📝 Conteúdo inalterado, skip auto-save');
            return;
        }

        // Verifica conteúdo mínimo - REMOVIDO: Agora salva sempre
        // if (textContent.length < this.MIN_CONTENT_LENGTH) {
        //     console.log('📝 Conteúdo muito pequeno, skip auto-save');
        //     return;
        // }

        this.saveInProgress = true;

        try {
            console.log(`💾 Auto-save iniciado (${trigger}):`, {
                semana: this.currentSemana,
                tamanho: currentContent.length,
                texto: textContent.length + ' chars',
                logado: this.isLoggedIn,
                vazio: textContent.length === 0 ? 'SIM' : 'NÃO'
            });

            // 1. Salva no cache local sempre
            if (window.cacheRichText && typeof window.cacheRichText.salvar === 'function') {
                window.cacheRichText.salvar();
                console.log('💾 Cache local atualizado');
            }

            // 2. Salva no Supabase se logado
            if (this.isLoggedIn && window.SupabaseSync) {
                this.showSavingFeedback();
                
                const result = await window.SupabaseSync.salvarRichtextAnotacoes(
                    this.currentSemana, 
                    currentContent
                );

                if (result.success) {
                    this.lastSavedContent = currentContent;
                    console.log('☁️ Auto-save Supabase concluído');
                    this.showSavedFeedback();
                } else {
                    console.error('❌ Erro no auto-save Supabase:', result.error);
                    this.showErrorFeedback();
                }
            } else {
                console.log('💾 Auto-save apenas local (não logado)');
                this.lastSavedContent = currentContent;
                this.showLocalSaveFeedback();
            }

        } catch (error) {
            console.error('❌ Erro no auto-save:', error);
            this.showErrorFeedback();
        }

        this.saveInProgress = false;
    }

    monitorLoginChanges() {
        // Monitora mudanças no localStorage para detectar login/logout
        let lastLoginState = this.isLoggedIn;
        
        setInterval(() => {
            const currentLoginState = !!localStorage.getItem('supabase_user');
            
            if (currentLoginState !== lastLoginState) {
                console.log('🔄 Mudança de login detectada:', currentLoginState ? 'Logou' : 'Deslogou');
                this.isLoggedIn = currentLoginState;
                lastLoginState = currentLoginState;
                
                // Se logou, faz sync imediato
                if (currentLoginState) {
                    setTimeout(() => {
                        this.executeAutoSave('login');
                    }, 1000);
                }
            }
        }, 2000);
    }

    // === FEEDBACK VISUAL === //

    showTypingFeedback() {
        this.updateStatus('✏️ Digitando...', 'typing');
    }

    showSavingFeedback() {
        this.updateStatus('☁️ Salvando...', 'saving');
    }

    showSavedFeedback() {
        this.updateStatus('✅ Salvo na nuvem', 'success');
        setTimeout(() => this.hideStatus(), 3000);
    }

    showLocalSaveFeedback() {
        this.updateStatus('💾 Salvo localmente', 'local');
        setTimeout(() => this.hideStatus(), 2000);
    }

    showErrorFeedback() {
        this.updateStatus('❌ Erro ao salvar', 'error');
        setTimeout(() => this.hideStatus(), 4000);
    }

    updateStatus(message, type) {
        const statusDiv = document.getElementById('save-status');
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.className = `save-status show ${type}`;
        }
    }

    hideStatus() {
        const statusDiv = document.getElementById('save-status');
        if (statusDiv) {
            statusDiv.classList.remove('show');
        }
    }

    // === MÉTODOS PÚBLICOS === //

    forceAutoSave() {
        clearTimeout(this.autoSaveTimeout);
        this.executeAutoSave('manual');
    }

    pauseAutoSave() {
        clearTimeout(this.autoSaveTimeout);
        console.log('⏸️ Auto-save pausado');
    }

    resumeAutoSave() {
        this.onContentChange();
        console.log('▶️ Auto-save retomado');
    }

    setDelay(newDelay) {
        this.SAVE_DELAY = newDelay;
        console.log('⏱️ Delay do auto-save alterado para:', newDelay + 'ms');
    }

    getStatus() {
        return {
            ativo: !!this.editor,
            logado: this.isLoggedIn,
            semana: this.currentSemana,
            delay: this.SAVE_DELAY,
            saveEmProgresso: this.saveInProgress,
            ultimoConteudoSalvo: this.lastSavedContent.length + ' caracteres'
        };
    }

    debug() {
        console.log('=== DEBUG AUTO-SAVE MANAGER ===');
        console.log('Status:', this.getStatus());
        console.log('Editor:', this.editor ? 'Encontrado' : 'Não encontrado');
        console.log('SupabaseSync:', !!window.SupabaseSync);
        console.log('CacheRichText:', !!window.cacheRichText);
    }
}

// Instância global
window.AutoSaveManager = new AutoSaveManager();

// Métodos públicos disponíveis no console
window.forceAutoSave = () => window.AutoSaveManager.forceAutoSave();
window.pauseAutoSave = () => window.AutoSaveManager.pauseAutoSave();
window.resumeAutoSave = () => window.AutoSaveManager.resumeAutoSave();
window.autoSaveStatus = () => window.AutoSaveManager.getStatus();
window.debugAutoSave = () => window.AutoSaveManager.debug();

console.log('🛠️ Auto-save carregado! Comandos disponíveis:');
console.log('• window.forceAutoSave() - Força save imediato');
console.log('• window.pauseAutoSave() - Pausa auto-save');
console.log('• window.resumeAutoSave() - Retoma auto-save'); 
console.log('• window.autoSaveStatus() - Status atual');
console.log('• window.debugAutoSave() - Debug completo');