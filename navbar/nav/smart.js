// navbar/smart.js - Sistema inteligente de barra com scroll

class SmartNavbar {
    constructor() {
        this.lastScrollY = 0;
        this.scrollThreshold = 10;
        this.isHidden = false;
        this.navbar = null;
        this.init();
    }

    init() {
        this.createNavbar();
        this.setupScrollListener();
        this.setupBodyClass();
    }

    createNavbar() {
        // Remove navbar existente se houver
        const existingNav = document.querySelector('.bottom-navbar');
        if (existingNav) {
            existingNav.remove();
        }

        // Cria HTML da navbar
        const navbarHTML = `
            <nav class="bottom-navbar">
                <a href="../../index.html" class="navbar-item">
                    <div class="navbar-icon icon-home"></div>
                    <span class="navbar-label">Início</span>
                </a>
                
                <a href="../../biblia/biblia.html" class="navbar-item">
                    <div class="navbar-icon icon-bible"></div>
                    <span class="navbar-label">Bíblia</span>
                </a>
                
                <a href="#" class="navbar-item" onclick="window.SistemaGlobal.irParaAnotacoesAtual()">
                    <div class="navbar-icon icon-notes"></div>
                    <span class="navbar-label">Anotações</span>
                </a>
                
                <a href="#" class="navbar-item active" onclick="alert('Você está lendo A Sentinela')">
                    <div class="navbar-icon icon-watchtower"></div>
                    <span class="navbar-label">A Sentinela</span>
                </a>
                
                <a href="#" class="navbar-item" onclick="alert('Função salvar em desenvolvimento')">
                    <div class="navbar-icon icon-save"></div>
                    <span class="navbar-label">Salvar</span>
                </a>
            </nav>
        `;

        document.body.insertAdjacentHTML('beforeend', navbarHTML);
        this.navbar = document.querySelector('.bottom-navbar');
    }

    setupScrollListener() {
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

        window.addEventListener('scroll', handleScroll, { passive: true });
        
        // Touch events para melhor responsividade no mobile
        let touchStartY = 0;
        let touchEndY = 0;

        document.addEventListener('touchstart', (e) => {
            touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            touchEndY = e.changedTouches[0].screenY;
            this.handleTouchScroll(touchStartY, touchEndY);
        }, { passive: true });
    }

    onScroll() {
        const currentScrollY = window.scrollY;
        
        // Evita mudanças muito pequenas
        if (Math.abs(currentScrollY - this.lastScrollY) < this.scrollThreshold) {
            return;
        }

        // Decide se mostra ou esconde a barra
        if (currentScrollY > this.lastScrollY && currentScrollY > 100) {
            // Rolando para baixo e passou de 100px
            this.hideNavbar();
        } else if (currentScrollY < this.lastScrollY) {
            // Rolando para cima
            this.showNavbar();
        }

        this.lastScrollY = currentScrollY;
    }

    handleTouchScroll(startY, endY) {
        const diff = startY - endY;
        
        if (Math.abs(diff) > 20) { // Movimento mínimo
            if (diff > 0) {
                // Deslizando para cima
                this.hideNavbar();
            } else {
                // Deslizando para baixo
                this.showNavbar();
            }
        }
    }

    hideNavbar() {
        if (!this.isHidden && this.navbar) {
            this.navbar.classList.add('hidden');
            this.isHidden = true;
        }
    }

    showNavbar() {
        if (this.isHidden && this.navbar) {
            this.navbar.classList.remove('hidden');
            this.isHidden = false;
        }
    }

    setupBodyClass() {
        document.body.classList.add('with-smart-navbar');
    }
}

// Template HTML completo para páginas de Sentinela
window.criarPaginaSentinela = function(titulo, conteudo) {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${titulo}</title>
    <link rel="stylesheet" href="../../smart-navbar.css">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #fff;
            margin: 0;
            padding: 20px;
        }
        
        h1 {
            color: #2d3748;
            margin-bottom: 20px;
        }
        
        p {
            margin-bottom: 15px;
        }
    </style>
</head>
<body>
    <h1>${titulo}</h1>
    ${conteudo}
    
    <script src="../../config-global.js"></script>
    <script src="../../smart-navbar.js"></script>
    <script>
        // Inicializa a barra inteligente
        document.addEventListener('DOMContentLoaded', () => {
            new SmartNavbar();
        });
    </script>
</body>
</html>
    `;
};

// Inicializa automaticamente se já estiver carregado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new SmartNavbar();
    });
} else {
    new SmartNavbar();
}