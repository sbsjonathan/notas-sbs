// main.js - Carrossel com detecção automática da semana atual e em-breve inline

class CarouselManager {
    constructor() {
        this.currentSlide = 0;
        this.totalSlides = 0;
        this.slides = [];
        this.slidesWrapper = null;
        this.indicators = null;
        this.semanas = [];
        this.semanaAtual = null;
        
        this.init();
    }

    async init() {
        try {
            // Detecta a semana atual primeiro
            this.detectarSemanaAtual();
            
            // Carrega configuração das semanas
            await this.loadDiasConfig();
            
            // Cria os slides
            this.createSlides();
            
            // Encontra o índice da semana atual
            this.encontrarIndiceeSemanaAtual();
            
            // Configura navegação
            this.setupNavigation();
            
            // Inicia no slide correto
            this.goToSlide(this.currentSlide, false);
            
            // Atualiza display da semana
            this.updateSemanaDisplay();
            
            console.log('✅ Carrossel inicializado na semana:', this.semanaAtual);
            
        } catch (error) {
            console.error('❌ Erro ao inicializar carrossel:', error);
            this.showError();
        }
    }

    detectarSemanaAtual() {
        if (window.UnifiedNavbar && window.UnifiedNavbar.get()) {
            this.semanaAtual = window.UnifiedNavbar.get().calcularSemanaAtual();
            console.log('🧮 Semana detectada via navbar:', this.semanaAtual);
        } else {
            this.semanaAtual = this.calcularSemanaManual();
            console.log('📄 Semana calculada manualmente:', this.semanaAtual);
        }
        
        window.semanaAtual = this.semanaAtual;
    }

    calcularSemanaManual() {
        const hoje = new Date();
        const diaDaSemana = hoje.getDay();
        const diasParaSegunda = diaDaSemana === 0 ? -6 : 1 - diaDaSemana;
        
        const segundaFeira = new Date(hoje);
        segundaFeira.setDate(hoje.getDate() + diasParaSegunda);
        
        const dia = String(segundaFeira.getDate()).padStart(2, '0');
        const mes = String(segundaFeira.getMonth() + 1).padStart(2, '0');
        return `${dia}-${mes}`;
    }

    async loadDiasConfig() {
        try {
            if (window.diasConfig) {
                this.semanas = window.diasConfig;
                console.log('📋 Configuração carregada:', this.semanas.length, 'semanas');
            } else {
                this.semanas = this.getDefaultConfig();
                console.log('📄 Usando configuração padrão');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar configuração:', error);
            this.semanas = this.getDefaultConfig();
        }
    }

    getDefaultConfig() {
        return [
            {
                semana: "25-31 de Agosto",
                parametro: "25-08",
                titulo: "25-31 de Agosto"
            },
            {
                semana: "1-7 de Setembro", 
                parametro: "01-09",
                titulo: "1-7 de Setembro"
            },
            {
                semana: "8-14 de Setembro",
                parametro: "08-09",
                titulo: "8-14 de Setembro"
            },
            {
                semana: "15-21 de Setembro",
                parametro: "15-09",
                titulo: "15-21 de Setembro"
            },
            {
                semana: "22-28 de Setembro",
                parametro: "22-09",
                titulo: "22-28 de Setembro"
            },
            {
                semana: "29 de Setembro - 5 de Outubro",
                parametro: "29-09",
                titulo: "29 de Setembro - 5 de Outubro"
            }
        ];
    }

    encontrarIndiceeSemanaAtual() {
        const indiceEncontrado = this.semanas.findIndex(config => 
            config.parametro === this.semanaAtual
        );

        if (indiceEncontrado !== -1) {
            this.currentSlide = indiceEncontrado;
            console.log(`🎯 Semana ${this.semanaAtual} encontrada no índice:`, indiceEncontrado);
        } else {
            const indiceProximo = this.encontrarSemanaMaisProxima();
            this.currentSlide = indiceProximo;
            console.log(`🔍 Semana mais próxima encontrada no índice:`, indiceProximo);
        }
    }

    encontrarSemanaMaisProxima() {
        const [diaAtual, mesAtual] = this.semanaAtual.split('-').map(Number);
        const dataAtual = new Date(2024, mesAtual - 1, diaAtual);
        
        let menorDiferenca = Infinity;
        let indiceMaisProximo = 0;
        
        this.semanas.forEach((config, index) => {
            const [dia, mes] = config.parametro.split('-').map(Number);
            const dataConfig = new Date(2024, mes - 1, dia);
            const diferenca = Math.abs(dataAtual - dataConfig);
            
            if (diferenca < menorDiferenca) {
                menorDiferenca = diferenca;
                indiceMaisProximo = index;
            }
        });
        
        console.log('🔍 Semana mais próxima:', this.semanas[indiceMaisProximo].parametro);
        return indiceMaisProximo;
    }

    createSlides() {
        this.slidesWrapper = document.getElementById('slides-wrapper');
        this.indicators = document.getElementById('indicators');
        
        if (!this.slidesWrapper) {
            throw new Error('Slides wrapper não encontrado');
        }

        this.slidesWrapper.innerHTML = '';
        if (this.indicators) {
            this.indicators.innerHTML = '';
        }

        this.semanas.forEach((config, index) => {
            this.createSlide(config, index);
            this.createIndicator(index);
        });

        this.totalSlides = this.semanas.length;
        console.log(`📱 ${this.totalSlides} slides criados`);
    }

    createSlide(config, index) {
        const slide = document.createElement('div');
        slide.className = 'slide';
        slide.innerHTML = `
            <div class="slide-content">
                <h2 class="subtitulo">${config.titulo}</h2>
                <div class="nav-links">
                    <a href="richtext/container.html?semana=${config.parametro}" class="nav-link">
                        <span class="icone">📝</span>
                        Anotações do Discurso
                    </a>
                    <a href="javascript:void(0)" class="nav-link" data-semana="${config.parametro}">
                        <span class="icone">📖</span>
                        Estudo de A Sentinela
                    </a>
                </div>
                <p class="descricao">Semana de ${config.semana}</p>
            </div>
        `;
        this.slidesWrapper.appendChild(slide);
        this.slides.push(slide);
    }

    createIndicator(index) {
        if (!this.indicators) return;
        
        const indicator = document.createElement('div');
        indicator.className = 'indicator';
        indicator.addEventListener('click', () => this.goToSlide(index));
        this.indicators.appendChild(indicator);
    }

    setupNavigation() {
        // Botões de navegação
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.previousSlide());
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextSlide());
        }

        // Event listener para links da Sentinela
        this.slidesWrapper.addEventListener('click', (e) => {
            const link = e.target.closest('a[data-semana]');
            if (link) {
                e.preventDefault();
                const semana = link.getAttribute('data-semana');
                console.log(`🎯 Clicou na Sentinela da semana: ${semana}`);
                this.verificarESentinela(semana);
            }
        });

        // Navegação por swipe
        this.setupSwipeNavigation();

        // Navegação por teclado
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.previousSlide();
            if (e.key === 'ArrowRight') this.nextSlide();
        });
    }

    setupSwipeNavigation() {
        let startX = 0;
        let startY = 0;
        let endX = 0;
        let endY = 0;

        this.slidesWrapper.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }, { passive: true });

        this.slidesWrapper.addEventListener('touchend', (e) => {
            endX = e.changedTouches[0].clientX;
            endY = e.changedTouches[0].clientY;
            
            const deltaX = startX - endX;
            const deltaY = startY - endY;
            
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
                if (deltaX > 0) {
                    this.nextSlide();
                } else {
                    this.previousSlide();
                }
            }
        }, { passive: true });
    }

    goToSlide(index, animate = true) {
        if (index < 0 || index >= this.totalSlides) return;

        this.currentSlide = index;
        
        const translateX = -index * 100;
        this.slidesWrapper.style.transform = `translateX(${translateX}%)`;
        
        if (!animate) {
            this.slidesWrapper.style.transition = 'none';
            this.slidesWrapper.offsetHeight;
            this.slidesWrapper.style.transition = '';
        }

        this.updateIndicators();
        this.updateSemanaDisplay();

        console.log(`🔍 Navegou para slide ${index}:`, this.semanas[index]?.titulo);
    }

    nextSlide() {
        const nextIndex = (this.currentSlide + 1) % this.totalSlides;
        this.goToSlide(nextIndex);
    }

    previousSlide() {
        const prevIndex = (this.currentSlide - 1 + this.totalSlides) % this.totalSlides;
        this.goToSlide(prevIndex);
    }

    updateIndicators() {
        if (!this.indicators) return;
        
        const indicators = this.indicators.querySelectorAll('.indicator');
        indicators.forEach((indicator, index) => {
            indicator.classList.toggle('active', index === this.currentSlide);
        });
    }

    updateSemanaDisplay() {
        const semanaDisplay = document.getElementById('semana-display');
        if (semanaDisplay && this.semanas[this.currentSlide]) {
            const config = this.semanas[this.currentSlide];
            semanaDisplay.textContent = config.titulo;
            
            if (config.parametro === this.semanaAtual) {
                semanaDisplay.style.color = '#667eea';
                semanaDisplay.style.fontWeight = '700';
            } else {
                semanaDisplay.style.color = '';
                semanaDisplay.style.fontWeight = '';
            }
        }
    }

    showError() {
        this.slidesWrapper = document.getElementById('slides-wrapper');
        if (this.slidesWrapper) {
            this.slidesWrapper.innerHTML = `
                <div class="slide">
                    <div class="slide-content">
                        <h2 class="subtitulo">Erro ao Carregar</h2>
                        <p class="descricao">Não foi possível carregar o carrossel.</p>
                    </div>
                </div>
            `;
        }
    }

    // Função que verifica se arquivo existe antes de redirecionar
    async verificarESentinela(semana) {
        try {
            console.log(`🔍 Verificando: sentinela/${semana}.html`);
            
            const response = await fetch(`sentinela/${semana}.html`, { method: 'HEAD' });
            
            if (response.ok) {
                // Arquivo existe, vai para ele
                console.log(`✅ Arquivo encontrado!`);
                window.location.href = `sentinela/${semana}.html`;
            } else {
                // Arquivo não existe, mostra em-breve inline
                console.log(`📄 Arquivo não encontrado, mostrando em-breve`);
                this.mostrarEmBreveInline(semana);
            }
        } catch (error) {
            // Erro, mostra em-breve inline
            console.log(`❌ Erro: ${error.message}`);
            this.mostrarEmBreveInline(semana);
        }
    }

    // Mostra página em-breve inline
    mostrarEmBreveInline(semana) {
        // Formata a semana para exibição
        const [dia, mes] = semana.split('-');
        const semanaFormatada = `${dia}/${mes}`;
        
        // Cria o HTML do em-breve
        const emBreveHTML = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                <title>Estudo Em Breve</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                        margin: 0;
                        padding: 20px;
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        -webkit-tap-highlight-color: transparent;
                    }
                    .container {
                        background: white;
                        border-radius: 20px;
                        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
                        padding: 40px;
                        text-align: center;
                        max-width: 400px;
                        width: 100%;
                        position: relative;
                        overflow: hidden;
                    }
                    .container::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 4px;
                        background: linear-gradient(90deg, #3F3C6D, #667eea);
                    }
                    .icone {
                        font-size: 4rem;
                        margin-bottom: 20px;
                        opacity: 0.8;
                    }
                    .titulo {
                        font-size: 1.8rem;
                        font-weight: 600;
                        color: #375255;
                        margin-bottom: 15px;
                        line-height: 1.2;
                    }
                    .semana {
                        font-size: 1.1rem;
                        color: #6B46C1;
                        font-weight: 500;
                        margin-bottom: 25px;
                    }
                    .mensagem {
                        color: #666;
                        line-height: 1.6;
                        margin-bottom: 30px;
                        font-size: 1rem;
                    }
                    .botoes {
                        display: flex;
                        flex-direction: column;
                        gap: 15px;
                    }
                    .botao {
                        background: #375255;
                        color: white;
                        padding: 16px 24px;
                        border-radius: 12px;
                        text-decoration: none;
                        font-weight: 600;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                        transition: all 0.3s ease;
                        font-size: 16px;
                        touch-action: manipulation;
                    }
                    .botao:active {
                        background: #2a3d40;
                        transform: scale(0.95);
                    }
                    .botao-reload {
                        background: #6b7280;
                    }
                    .botao-reload:active {
                        background: #4b5563;
                    }
                    @media (max-width: 480px) {
                        .container {
                            padding: 30px 20px;
                            margin: 10px;
                        }
                        .titulo {
                            font-size: 1.5rem;
                        }
                        .icone {
                            font-size: 3rem;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="icone">📖</div>
                    <h1 class="titulo">Estudo Em Breve</h1>
                    <p class="semana">Semana: ${semanaFormatada}</p>
                    <p class="mensagem">
                        O estudo de <strong>A Sentinela</strong> para esta semana ainda não foi publicado. 
                        Nossos estudos são disponibilizados semanalmente.
                    </p>
                    <div class="botoes">
                        <a href="index.html" class="botao">
                            <span>←</span>
                            <span>Voltar ao Índice</span>
                        </a>
                        <button onclick="window.location.reload()" class="botao botao-reload">
                            <span>🔄</span>
                            <span>Verificar Novamente</span>
                        </button>
                    </div>
                </div>
                
                <script>
                    // Previne zoom duplo-toque no iPhone
                    let lastTouchEnd = 0;
                    document.addEventListener('touchend', function (event) {
                        const now = (new Date()).getTime();
                        if (now - lastTouchEnd <= 300) {
                            event.preventDefault();
                        }
                        lastTouchEnd = now;
                    }, false);
                </script>
            </body>
            </html>
        `;
        
        // Substitui todo o conteúdo da página pelo em-breve
        document.open();
        document.write(emBreveHTML);
        document.close();
        
        console.log(`📄 Em-breve exibido para semana ${semana}`);
    }

    // Métodos públicos
    getCurrentWeek() {
        return this.semanaAtual;
    }

    getCurrentSlideConfig() {
        return this.semanas[this.currentSlide];
    }

    forceGoToWeek(semanaParametro) {
        const index = this.semanas.findIndex(config => 
            config.parametro === semanaParametro
        );
        
        if (index !== -1) {
            this.goToSlide(index);
            return true;
        }
        
        return false;
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    const script = document.createElement('script');
    script.src = 'dias-config.js';
    script.onload = () => {
        const carousel = new CarouselManager();
        window.carousel = carousel;
    };
    script.onerror = () => {
        const carousel = new CarouselManager();
        window.carousel = carousel;
    };
    document.head.appendChild(script);
});

// Métodos globais para debug
window.goToWeek = (semana) => {
    if (window.carousel) {
        return window.carousel.forceGoToWeek(semana);
    }
    return false;
};

window.getCurrentWeek = () => {
    if (window.carousel) {
        return window.carousel.getCurrentWeek();
    }
    return null;
};