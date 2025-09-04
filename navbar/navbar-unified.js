// navbar-unified.js - Sistema inteligente unificado para barra inferior

class UnifiedNavbar {
    constructor() {
        this.navbar = null;
        this.lastScrollY = 0;
        this.scrollThreshold = 50; // Aumentado para ser menos sensível
        this.hideTimeout = null;
        this.isHidden = false;
        this.scrollDirection = 'up';
        this.touchStartY = 0;
        this.consecutiveScrollDown = 0;
        this.currentPage = this.detectCurrentPage();
        
        this.init();
    }

    init() {
        this.createNavbar();
        this.setupScrollBehavior();
        this.setupNavigation();
        
        // Delay para garantir que o DOM esteja pronto
        setTimeout(() => {
            this.updateActiveState();
            this.updateSaveButtonVisual(); // Só atualiza visual do botão
        }, 100);
        
        this.addBodyClass();
    }

    detectCurrentPage() {
        const path = window.location.pathname.toLowerCase();
        const search = window.location.search.toLowerCase();
        
        if (path.includes('index.html') || path === '/' || path.endsWith('/')) {
            return 'home';
        }
        if (path.includes('biblia') || path.includes('livro') || path.includes('capitulo')) {
            return 'bible';
        }
        if (path.includes('richtext') || path.includes('anotacoes')) {
            return 'notes';
        }
        if (path.includes('sentinela')) {
            return 'watchtower';
        }
        if (path.includes('save') || path.includes('auth')) {
            return 'save';
        }
        
        return 'home'; // fallback
    }

    createNavbar() {
        // Remove navbar existente
        const existingNav = document.querySelector('.bottom-navbar');
        if (existingNav) {
            existingNav.remove();
        }

        // HTML SIMPLES - só links diretos
        const navbarHTML = `
            <nav class="bottom-navbar" data-context="navbar-context-${this.currentPage}">
                <a href="${this.getBasePath()}index.html" class="navbar-item" data-page="home">
                    <div class="navbar-icon icon-home"></div>
                    <span class="navbar-label">Início</span>
                </a>
                
                <a href="${this.getBasePath()}biblia/biblia.html" class="navbar-item" data-page="bible">
                    <div class="navbar-icon icon-bible"></div>
                    <span class="navbar-label">Bíblia</span>
                </a>
                
                <a href="${this.getBasePath()}richtext/container.html${this.getSemanaParam()}" class="navbar-item" data-page="notes">
                    <div class="navbar-icon icon-notes"></div>
                    <span class="navbar-label">Anotações</span>
                </a>
                
                <a href="${this.getBasePath()}sentinela/01-09/sentinela.html" class="navbar-item" data-page="watchtower">
                    <div class="navbar-icon icon-watchtower"></div>
                    <span class="navbar-label">A Sentinela</span>
                </a>
                
                <a href="${this.getBasePath()}save/auth-supabase.html" class="navbar-item" data-page="save">
                    <div class="navbar-icon icon-save"></div>
                    <span class="navbar-label">Salvar</span>
                </a>
            </nav>
        `;

        document.body.insertAdjacentHTML('beforeend', navbarHTML);
        this.navbar = document.querySelector('.bottom-navbar');
    }

    getSemanaParam() {
        // Tenta detectar semana do contexto atual
        const urlParams = new URLSearchParams(window.location.search);
        const semanaURL = urlParams.get('semana');
        
        if (semanaURL) {
            return `?semana=${semanaURL}`;
        }
        
        if (window.semanaAtual) {
            return `?semana=${window.semanaAtual}`;
        }
        
        return ''; // Sem parâmetro se não conseguir detectar
    }

    getBasePath() {
        const path = window.location.pathname;
        
        // Detecta o nível de profundidade baseado no caminho
        if (path.includes('/biblia/livro/')) {
            return '../../../'; // biblia/livro/rute/rute.html
        }
        if (path.includes('/save/')) {
            return '../'; // save/auth.html
        }
        if (path.includes('/biblia/')) {
            return '../'; // biblia/biblia.html
        }
        if (path.includes('/richtext/')) {
            return '../'; // richtext/container.html
        }
        if (path.includes('/sentinela/')) {
            // Pode ser /sentinela/01-09/sentinela.html ou /sentinela/em-breve.html
            if (path.split('/').length > 3) {
                return '../../'; // sentinela/01-09/sentinela.html
            }
            return '../'; // sentinela/em-breve.html
        }
        
        return ''; // index.html na raiz
    }

    setupScrollBehavior() {
        // Scroll mais inteligente - só esconde em scroll rápido e consistente
        let ticking = false;

        const handleScroll = () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    this.onScroll();
                    ticking = false;
                });
                ticking = true;
            }
        };

        // Só ativa scroll behavior em páginas com conteúdo longo
        if (this.shouldEnableScrollBehavior()) {
            window.addEventListener('scroll', handleScroll, { passive: true });
            this.setupTouchBehavior();
        }
    }

    shouldEnableScrollBehavior() {
        // Ativa apenas em páginas que tipicamente têm scroll longo
        return this.currentPage === 'watchtower' || 
               document.body.scrollHeight > window.innerHeight * 1.5;
    }

    onScroll() {
        const currentScrollY = window.scrollY;
        const scrollDifference = currentScrollY - this.lastScrollY;
        
        // Ignora mudanças muito pequenas
        if (Math.abs(scrollDifference) < this.scrollThreshold) {
            return;
        }

        const newDirection = scrollDifference > 0 ? 'down' : 'up';
        
        if (newDirection === 'down') {
            this.consecutiveScrollDown++;
            
            // Só esconde após scroll consistente para baixo E se passou do fold
            if (this.consecutiveScrollDown >= 2 && currentScrollY > window.innerHeight * 0.3) {
                this.hideNavbar();
            }
        } else {
            this.consecutiveScrollDown = 0;
            this.showNavbar();
        }

        this.scrollDirection = newDirection;
        this.lastScrollY = currentScrollY;
    }

    setupTouchBehavior() {
        let touchStartY = 0;
        let touchEndY = 0;

        document.addEventListener('touchstart', (e) => {
            touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            touchEndY = e.changedTouches[0].screenY;
            const diff = touchStartY - touchEndY;
            
            // Gesto de swipe para cima para mostrar navbar
            if (diff < -100 && this.isHidden) {
                this.showNavbar();
            }
        }, { passive: true });
    }

    hideNavbar() {
        if (!this.isHidden && this.navbar) {
            this.navbar.classList.add('hidden');
            this.isHidden = true;
            
            // Auto-show após 3 segundos de inatividade
            clearTimeout(this.hideTimeout);
            this.hideTimeout = setTimeout(() => {
                this.showNavbar();
            }, 3000);
        }
    }

    showNavbar() {
        if (this.isHidden && this.navbar) {
            this.navbar.classList.remove('hidden');
            this.isHidden = false;
            clearTimeout(this.hideTimeout);
        }
    }

    setupNavigation() {
        if (!this.navbar) return;

        // VOLTANDO AO BÁSICO - navegação simples
        this.navbar.addEventListener('click', (e) => {
            const item = e.target.closest('.navbar-item');
            if (!item) return;

            // Se tem href válido, deixa navegar normalmente
            const href = item.getAttribute('href');
            if (href && href !== '#') {
                console.log('🔗 Navegando para:', href);
                return;
            }

            // Se chegou aqui é porque não tem href válido
            e.preventDefault();
        });
    }

    async handleSpecialAction(action, item) {
        this.showFeedback(item, 'loading');

        try {
            switch (action) {
                case 'notes':
                    await this.navigateToNotes();
                    break;
                case 'watchtower':
                    await this.navigateToWatchtower();
                    break;
                case 'save':
                    await this.handleSave();
                    break;
                default:
                    throw new Error('Ação não implementada');
            }
            
            this.showFeedback(item, 'success');
        } catch (error) {
            console.error('Erro na ação:', error);
            this.showFeedback(item, 'error');
        }
    }

    async navigateToNotes() {
        // Tenta usar o sistema global primeiro
        if (window.SistemaGlobal && typeof window.SistemaGlobal.irParaAnotacoesAtual === 'function') {
            try {
                await window.SistemaGlobal.irParaAnotacoesAtual();
                return;
            } catch (e) {
                console.log('Sistema global falhou, usando fallback');
            }
        }

        // Fallback: navega para anotações da semana atual se possível
        const semanaAtual = window.semanaAtual || this.detectCurrentWeek();
        if (semanaAtual) {
            window.location.href = `${this.getBasePath()}richtext/container.html?semana=${semanaAtual}`;
        } else {
            window.location.href = `${this.getBasePath()}richtext/container.html`;
        }
    }

    async navigateToWatchtower() {
        // Tenta usar o sistema global primeiro
        if (window.SistemaGlobal && typeof window.SistemaGlobal.irParaSentinelaAtual === 'function') {
            try {
                await window.SistemaGlobal.irParaSentinelaAtual();
                return;
            } catch (e) {
                console.log('Sistema global falhou, usando fallback');
            }
        }

        // Fallback robusto baseado na estrutura atual
        const semanaAtual = window.semanaAtual || this.detectCurrentWeek();
        const basePath = this.getBasePath();
        
        if (semanaAtual) {
            // Tenta ir para a página específica da semana
            window.location.href = `${basePath}sentinela/${semanaAtual}/sentinela.html`;
        } else {
            // Se não conseguir detectar, vai para primeira semana disponível
            window.location.href = `${basePath}sentinela/01-09/sentinela.html`;
        }
    }

    async handleSave() {
        // Se tem SyncManager, usa ele (sistema novo)
        if (window.SyncManager && typeof window.SyncManager.handleSaveButton === 'function') {
            await window.SyncManager.handleSaveButton();
            return;
        }

        // Fallback para sistema antigo
        if (this.currentPage === 'notes') {
            if (window.cacheRichText && typeof window.cacheRichText.salvar === 'function') {
                const editor = document.getElementById('text-editor');
                if (editor) {
                    window.cacheRichText.salvar();
                    
                    // Feedback visual
                    const navbar = window.UnifiedNavbar.get();
                    if (navbar) {
                        const saveBtn = navbar.navbar.querySelector('[data-page="save"]');
                        if (saveBtn) {
                            navbar.showFeedback(saveBtn, 'success');
                        }
                    }
                    return;
                }
            }
        }
        
        // Se não tem nada para salvar, redireciona para login
        const currentUrl = encodeURIComponent(window.location.href);
        window.location.href = `${this.getBasePath()}save/auth.html?return=${currentUrl}`;
    }

    detectCurrentWeek() {
        // Primeiro, tenta pegar da URL
        const urlParams = new URLSearchParams(window.location.search);
        const semanaURL = urlParams.get('semana');
        if (semanaURL) {
            console.log('🔗 Semana detectada da URL:', semanaURL);
            return semanaURL;
        }

        // Tenta pegar do window.semanaAtual
        if (window.semanaAtual) {
            console.log('🌐 Semana detectada do global:', window.semanaAtual);
            return window.semanaAtual;
        }

        // Tenta extrair do path da URL
        const path = window.location.pathname;
        const match = path.match(/sentinela\/([^\/]+)\//);
        if (match) {
            console.log('📁 Semana detectada do path:', match[1]);
            return match[1];
        }

        // Fallback baseado na data atual
        const agora = new Date();
        const dia = String(agora.getDate()).padStart(2, '0');
        const mes = String(agora.getMonth() + 1).padStart(2, '0');
        const fallback = `${dia}-${mes}`;
        console.log('📅 Usando fallback baseado na data:', fallback);
        return fallback;
    }

    showFeedback(item, type) {
        // Remove classes anteriores
        item.classList.remove('loading', 'success', 'error');
        
        // Adiciona nova classe
        item.classList.add(type);
        
        // Remove após um tempo
        if (type !== 'loading') {
            setTimeout(() => {
                item.classList.remove(type);
            }, 600);
        }
    }

    updateActiveState() {
        if (!this.navbar) return;

        // Debug - vamos ver o que está acontecendo
        console.log('🔍 Atualizando estado ativo para página:', this.currentPage);
        console.log('📍 URL atual:', window.location.pathname);

        // Remove todos os estados ativos
        const items = this.navbar.querySelectorAll('.navbar-item');
        items.forEach(item => {
            item.classList.remove('active');
            console.log('🧹 Removido active de:', item.dataset.page);
        });

        // Adiciona estado ativo baseado na página atual
        const activeItem = this.navbar.querySelector(`[data-page="${this.currentPage}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
            console.log('✅ Ativado botão:', this.currentPage);
            
            // Force o estilo diretamente como fallback
            activeItem.style.color = '#6B46C1';
        } else {
            console.warn('❌ Não encontrou botão para página:', this.currentPage);
        }

        // Atualiza contexto da navbar
        this.navbar.setAttribute('data-context', `navbar-context-${this.currentPage}`);
        console.log('🏷️ Contexto definido:', `navbar-context-${this.currentPage}`);
    }

    addBodyClass() {
        document.body.classList.add('with-bottom-navbar');
    }

    /**
     * Cria badge de status de sincronização - APENAS na página save
     */
    createStatusBadge() {
        // Só cria badge se estiver na página de save
        if (this.currentPage !== 'save') return;

        // Remove badge existente
        const existingBadge = document.querySelector('.sync-status-badge');
        if (existingBadge) {
            existingBadge.remove();
        }

        const badgeHTML = `
            <div class="sync-status-badge" id="sync-status-badge">
                <span id="sync-status-text">Verificando...</span>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', badgeHTML);
        document.body.classList.add('page-save'); // Classe para CSS específico
        this.statusBadge = document.getElementById('sync-status-badge');
    }

    /**
     * Verifica status de login e atualiza interface
     */
    /**
     * Atualiza apenas o visual do botão salvar (pontinho verde)
     */
    updateSaveButtonVisual() {
        const savedUser = localStorage.getItem('supabase_user');
        const saveButton = this.navbar?.querySelector('[data-page="save"]');
        
        if (savedUser && saveButton) {
            saveButton.classList.add('logged-in');
            console.log('✅ Pontinho verde ativado (usuário logado)');
        } else if (saveButton) {
            saveButton.classList.remove('logged-in');
            console.log('❌ Pontinho verde desativado (usuário não logado)');
        }
    }

    /**
     * Método público para atualizar login (chamado após login bem-sucedido)
     */
    onLoginSuccess(userData) {
        const saveButton = this.navbar?.querySelector('[data-page="save"]');
        if (saveButton) {
            saveButton.classList.add('logged-in');
        }
        
        // Badge e mensagens só na página save
        if (this.currentPage === 'save' && this.statusBadge) {
            this.statusBadge.classList.remove('logged-out', 'error');
            this.statusBadge.classList.add('show');
            document.getElementById('sync-status-text').textContent = 
                `Logado: ${userData.nome_completo || userData.usuario}`;
                
            // Auto-hide badge após 4 segundos
            setTimeout(() => {
                this.statusBadge.classList.remove('show');
            }, 4000);
        }
    }

    /**
     * Método público para logout
     */
    onLogout() {
        localStorage.removeItem('supabase_user');
        localStorage.removeItem('last_login');
        
        const saveButton = this.navbar?.querySelector('[data-page="save"]');
        if (saveButton) {
            saveButton.classList.remove('logged-in');
        }
        
        // Badge só na página save
        if (this.currentPage === 'save' && this.statusBadge) {
            this.statusBadge.classList.add('logged-out');
            this.statusBadge.classList.remove('show');
            document.getElementById('sync-status-text').textContent = 'Não logado';
        }
    }

    /**
     * Mostra mensagem temporária - APENAS na página save
     */
    showSyncMessage(message, type = 'info') {
        // Só mostra mensagens na página save
        if (this.currentPage !== 'save' || !this.statusBadge) return;
        
        const originalText = document.getElementById('sync-status-text').textContent;
        
        document.getElementById('sync-status-text').textContent = message;
        this.statusBadge.classList.add('show');
        
        if (type === 'success') {
            this.statusBadge.style.background = '#10b981';
        } else if (type === 'error') {
            this.statusBadge.style.background = '#ef4444';
        } else {
            this.statusBadge.style.background = '#6b7280';
        }
        
        setTimeout(() => {
            document.getElementById('sync-status-text').textContent = originalText;
            this.statusBadge.style.background = '';
            this.checkLoginStatus();
        }, 3000);
    }

    // Método público para atualizar página ativa
    setActivePage(page) {
        this.currentPage = page;
        this.updateActiveState();
    }

    // Método público para mostrar/esconder programaticamente
    show() {
        this.showNavbar();
    }

    hide() {
        this.hideNavbar();
    }

    // Método público para destruir a navbar
    destroy() {
        if (this.navbar) {
            this.navbar.remove();
            this.navbar = null;
        }
        clearTimeout(this.hideTimeout);
        document.body.classList.remove('with-bottom-navbar');
    }
}

// Sistema global para gerenciar a navbar
window.UnifiedNavbar = {
    instance: null,
    
    init(options = {}) {
        if (this.instance) {
            this.instance.destroy();
        }
        this.instance = new UnifiedNavbar(options);
        return this.instance;
    },
    
    get() {
        return this.instance;
    },
    
    setActivePage(page) {
        if (this.instance) {
            this.instance.setActivePage(page);
        }
    }
};

// Auto-inicialização
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.UnifiedNavbar.init();
    });
} else {
    window.UnifiedNavbar.init();
}

// Previne zoom duplo-toque no iPhone
let lastTouchEnd = 0;
document.addEventListener('touchend', function (event) {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false);