// navbar-unified.js - Sistema inteligente unificado para barra inferior (SENTINELA CORRIGIDA)

class UnifiedNavbar {
    constructor() {
        this.navbar = null;
        this.lastScrollY = 0;
        this.scrollThreshold = 50;
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
            this.updateSaveButtonVisual();
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
        if (path.includes('richtext') || path.includes('anotacoes') || path.includes('container')) {
            return 'notes';
        }
        // CORRIGIDO: Detecta sentinela corretamente
        if (path.includes('sentinela') || path.includes('em-breve')) {
            return 'watchtower';
        }
        if (path.includes('save') || path.includes('auth')) {
            return 'save';
        }
        
        return 'home';
    }

    /**
     * NOVA FUNÇÃO: Calcula a semana baseada na segunda-feira
     */
    calcularSemanaAtual() {
        const hoje = new Date();
        
        // Encontra a segunda-feira da semana atual
        const diaDaSemana = hoje.getDay(); // 0=domingo, 1=segunda, ..., 6=sábado
        const diasParaSegunda = diaDaSemana === 0 ? -6 : 1 - diaDaSemana; // Se domingo, volta 6 dias
        
        const segundaFeira = new Date(hoje);
        segundaFeira.setDate(hoje.getDate() + diasParaSegunda);
        
        // Formata no padrão DD-MM
        const dia = String(segundaFeira.getDate()).padStart(2, '0');
        const mes = String(segundaFeira.getMonth() + 1).padStart(2, '0');
        const semanaCalculada = `${dia}-${mes}`;
        
        console.log('📅 Cálculo de semana:', {
            hoje: hoje.toLocaleDateString('pt-BR'),
            diaDaSemana: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][diaDaSemana],
            segundaFeira: segundaFeira.toLocaleDateString('pt-BR'),
            semanaCalculada: semanaCalculada
        });
        
        return semanaCalculada;
    }

    createNavbar() {
        // Remove navbar existente
        const existingNav = document.querySelector('.bottom-navbar');
        if (existingNav) {
            existingNav.remove();
        }

        // HTML com links corretos
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
                
                <a href="#" class="navbar-item" data-page="watchtower" onclick="irParaSentinela(event)">
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

    /**
     * FUNÇÃO CORRIGIDA: Agora usa a semana calculada corretamente
     */
    getSemanaParam() {
        // 1. Primeiro, tenta pegar da URL atual (se já estiver navegando com semana)
        const urlParams = new URLSearchParams(window.location.search);
        const semanaURL = urlParams.get('semana');
        
        if (semanaURL && this.validarFormatoSemana(semanaURL)) {
            console.log('🔗 Usando semana da URL atual:', semanaURL);
            return `?semana=${semanaURL}`;
        }
        
        // 2. Tenta pegar do window.semanaAtual (se definido pela página)
        if (window.semanaAtual && this.validarFormatoSemana(window.semanaAtual)) {
            console.log('🌐 Usando semana global:', window.semanaAtual);
            return `?semana=${window.semanaAtual}`;
        }
        
        // 3. NOVO: Calcula a semana baseada na segunda-feira
        const semanaCalculada = this.calcularSemanaAtual();
        console.log('🧮 Usando semana calculada:', semanaCalculada);
        return `?semana=${semanaCalculada}`;
    }

    /**
     * NOVA FUNÇÃO: Valida se o formato da semana está correto (DD-MM)
     */
    validarFormatoSemana(semana) {
        const regex = /^\d{2}-\d{2}$/;
        return regex.test(semana);
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
            return '../'; // sentinela/01-09.html
        }
        
        return ''; // index.html na raiz
    }

    setupScrollBehavior() {
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

        if (this.shouldEnableScrollBehavior()) {
            window.addEventListener('scroll', handleScroll, { passive: true });
            this.setupTouchBehavior();
        }
    }

    shouldEnableScrollBehavior() {
        return this.currentPage === 'watchtower' || 
               document.body.scrollHeight > window.innerHeight * 1.5;
    }

    onScroll() {
        const currentScrollY = window.scrollY;
        const scrollDifference = currentScrollY - this.lastScrollY;
        
        if (Math.abs(scrollDifference) < this.scrollThreshold) {
            return;
        }

        const newDirection = scrollDifference > 0 ? 'down' : 'up';
        
        if (newDirection === 'down') {
            this.consecutiveScrollDown++;
            
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
            
            if (diff < -100 && this.isHidden) {
                this.showNavbar();
            }
        }, { passive: true });
    }

    hideNavbar() {
        if (!this.isHidden && this.navbar) {
            this.navbar.classList.add('hidden');
            this.isHidden = true;
            
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

        this.navbar.addEventListener('click', (e) => {
            const item = e.target.closest('.navbar-item');
            if (!item) return;

            const href = item.getAttribute('href');
            if (href && href !== '#') {
                console.log('🔗 Navegando para:', href);
                return; // Navegação normal
            }

            // Se é link com #, já foi tratado pelo onclick
        });
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

        // Calcula baseado na segunda-feira
        return this.calcularSemanaAtual();
    }

    showFeedback(item, type) {
        item.classList.remove('loading', 'success', 'error');
        item.classList.add(type);
        
        if (type !== 'loading') {
            setTimeout(() => {
                item.classList.remove(type);
            }, 600);
        }
    }

    updateActiveState() {
        if (!this.navbar) return;

        console.log('🎯 Atualizando estado ativo para página:', this.currentPage);
        console.log('🔍 URL atual:', window.location.pathname);

        const items = this.navbar.querySelectorAll('.navbar-item');
        items.forEach(item => {
            item.classList.remove('active');
        });

        const activeItem = this.navbar.querySelector(`[data-page="${this.currentPage}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
            console.log('✅ Ativado botão:', this.currentPage);
            
            // Force o estilo diretamente como fallback
            activeItem.style.color = '#6B46C1';
            
            // NOVO: Força ícone ativo especificamente para Sentinela
            if (this.currentPage === 'watchtower') {
                const icon = activeItem.querySelector('.navbar-icon');
                if (icon) {
                    icon.style.filter = 'brightness(0) saturate(100%) invert(35%) sepia(95%) saturate(1347%) hue-rotate(248deg) brightness(89%) contrast(90%)';
                }
                console.log('📖 Ícone da Sentinela ativado');
            }
        } else {
            console.warn('❌ Não encontrou botão para página:', this.currentPage);
        }

        this.navbar.setAttribute('data-context', `navbar-context-${this.currentPage}`);
        console.log('🏷️ Contexto definido:', `navbar-context-${this.currentPage}`);
    }

    addBodyClass() {
        document.body.classList.add('with-bottom-navbar');
    }

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

    onLoginSuccess(userData) {
        const saveButton = this.navbar?.querySelector('[data-page="save"]');
        if (saveButton) {
            saveButton.classList.add('logged-in');
        }
        
        console.log('✅ Login success - pontinho verde ativado');
    }

    onLogout() {
        localStorage.removeItem('supabase_user');
        localStorage.removeItem('last_login');
        
        const saveButton = this.navbar?.querySelector('[data-page="save"]');
        if (saveButton) {
            saveButton.classList.remove('logged-in');
        }
        
        console.log('👋 Logout - pontinho verde desativado');
    }

    // Métodos públicos
    setActivePage(page) {
        this.currentPage = page;
        this.updateActiveState();
    }

    show() {
        this.showNavbar();
    }

    hide() {
        this.hideNavbar();
    }

    destroy() {
        if (this.navbar) {
            this.navbar.remove();
            this.navbar = null;
        }
        clearTimeout(this.hideTimeout);
        document.body.classList.remove('with-bottom-navbar');
    }

    /**
     * NOVO MÉTODO PÚBLICO: Pega a semana calculada
     */
    getSemanaCalculada() {
        return this.calcularSemanaAtual();
    }
}

// NOVA FUNÇÃO GLOBAL: Navegar para Sentinela
async function irParaSentinela(event) {
    event.preventDefault();
    
    // Detecta semana atual
    let semana;
    
    // Tenta pegar do window global
    if (window.semanaAtual) {
        semana = window.semanaAtual;
    } 
    // Tenta pegar da URL atual
    else {
        const urlParams = new URLSearchParams(window.location.search);
        semana = urlParams.get('semana');
    }
    
    // Se não achou, calcula a semana atual
    if (!semana) {
        const hoje = new Date();
        const diaDaSemana = hoje.getDay();
        const diasParaSegunda = diaDaSemana === 0 ? -6 : 1 - diaDaSemana;
        
        const segundaFeira = new Date(hoje);
        segundaFeira.setDate(hoje.getDate() + diasParaSegunda);
        
        const dia = String(segundaFeira.getDate()).padStart(2, '0');
        const mes = String(segundaFeira.getMonth() + 1).padStart(2, '0');
        semana = `${dia}-${mes}`;
    }
    
    console.log('📖 Navegando para sentinela da semana:', semana);
    
    // Detecta caminho base
    const path = window.location.pathname;
    let basePath = '';
    
    if (path.includes('/save/')) {
        basePath = '../';
    } else if (path.includes('/richtext/')) {
        basePath = '../';
    } else if (path.includes('/biblia/')) {
        basePath = '../';
    } else if (path.includes('/sentinela/')) {
        basePath = './';
    }
    
    try {
        // Tenta verificar se arquivo existe
        const response = await fetch(`${basePath}sentinela/${semana}.html`, { method: 'HEAD' });
        
        if (response.ok) {
            // Arquivo existe
            window.location.href = `${basePath}sentinela/${semana}.html`;
        } else {
            // Arquivo não existe, vai para em-breve
            window.location.href = `${basePath}sentinela/em-breve.html?semana=${semana}`;
        }
    } catch (error) {
        // Erro de rede, vai para em-breve
        console.log('Erro ao verificar arquivo, indo para em-breve');
        window.location.href = `${basePath}sentinela/em-breve.html?semana=${semana}`;
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
    },

    // NOVO: Método público para pegar semana
    getSemanaCalculada() {
        if (this.instance) {
            return this.instance.getSemanaCalculada();
        }
        return null;
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