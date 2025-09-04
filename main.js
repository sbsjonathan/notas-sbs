// main.js - Sistema de carrossel para reuniões de domingo

class CarouselManager {
    constructor() {
        this.currentSlide = 0;
        this.totalSlides = 0;
        this.isAnimating = false;
        this.diasConfig = [];
        this.currentSemana = null;
        
        this.slidesWrapper = document.getElementById('slides-wrapper');
        this.semanaDisplay = document.getElementById('semana-display');
        this.indicatorsContainer = document.getElementById('indicators');
        this.prevBtn = document.getElementById('prev-btn');
        this.nextBtn = document.getElementById('next-btn');
        
        this.startX = 0;
        this.startY = 0;
        this.distX = 0;
        this.distY = 0;
        this.threshold = 50;
        
        this.init();
    }

    async init() {
        await this.carregarConfiguracao();
        this.inicializarCache();
        this.criarSlides();
        this.criarIndicadores();
        this.setupEventListeners();
        this.updateDisplay();
        this.configurarCachePorSemana();
        this.irParaSemanaAtual(); // Nova função
    }

    inicializarCache() {
        if (!window.CacheAnotacao) {
            window.CacheAnotacao = {
                salvar: function(id, conteudo) {
                    if (!id) return;
                    try {
                        localStorage.setItem(id, conteudo);
                    } catch (e) {
                        console.error("Erro ao salvar no cache:", e);
                    }
                },
                carregar: function(id) {
                    if (!id) return '';
                    try {
                        return localStorage.getItem(id) || '';
                    } catch (e) {
                        console.error("Erro ao carregar do cache:", e);
                        return '';
                    }
                }
            };
        }
    }

    configurarCachePorSemana() {
        if (this.diasConfig[0]) {
            this.currentSemana = this.diasConfig[0].parametro;
            window.semanaAtual = this.currentSemana;
        }
    }

    async carregarConfiguracao() {
        try {
            const response = await fetch('dias-config.js');
            if (response.ok) {
                const configText = await response.text();
                eval(configText);
                this.diasConfig = window.diasConfig || [];
            }
        } catch (error) {
            this.diasConfig = [
                {
                    semana: "25-31 de Agosto",
                    parametro: "25-08",
                    titulo: "25-31 de Agosto"
                },
                {
                    semana: "1-7 de Setembro", 
                    parametro: "01-09",
                    titulo: "1-7 de Setembro"
                }
            ];
        }
        this.totalSlides = this.diasConfig.length;
    }

    criarSlides() {
        this.slidesWrapper.innerHTML = '';
        
        if (this.diasConfig.length === 0) {
            this.slidesWrapper.innerHTML = `
                <div class="slide">
                    <div class="slide-content">
                        <div class="loading-content">
                            <div class="loading-spinner"></div>
                            <p>Nenhum dia configurado</p>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        this.diasConfig.forEach((dia) => {
            const slideHtml = `
                <div class="slide" data-semana="${dia.semana}" data-parametro="${dia.parametro}">
                    <div class="slide-content">
                        <h2 class="subtitulo">${dia.titulo}</h2>
                        
                        <nav class="nav-links">
                            <a href="richtext/container.html?semana=${dia.parametro}" class="nav-link" 
                               onclick="window.semanaAtual='${dia.parametro}'; this.classList.add('loading');">
                                <span class="icone">📝</span>
                                Anotações do Discurso
                            </a>
                            
                            <a href="sentinela/${dia.parametro}/sentinela.html" class="nav-link"
                               onclick="window.semanaAtual='${dia.parametro}'; this.classList.add('loading');">
                                <span class="icone">📖</span>
                                A Sentinela
                            </a>
                        </nav>
                        
                        <p class="descricao">
                            Material de estudo para a reunião de domingo desta semana.
                        </p>
                    </div>
                </div>
            `;
            this.slidesWrapper.innerHTML += slideHtml;
        });
    }

    criarIndicadores() {
        this.indicatorsContainer.innerHTML = '';
        
        for (let i = 0; i < this.totalSlides; i++) {
            const indicator = document.createElement('span');
            indicator.className = i === 0 ? 'indicator active' : 'indicator';
            indicator.dataset.slide = i;
            this.indicatorsContainer.appendChild(indicator);
        }
    }

    setupEventListeners() {
        this.prevBtn.addEventListener('click', () => this.prevSlide());
        this.nextBtn.addEventListener('click', () => this.nextSlide());

        this.indicatorsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('indicator')) {
                const slideIndex = parseInt(e.target.dataset.slide);
                this.goToSlide(slideIndex);
            }
        });

        this.slidesWrapper.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: true });
        this.slidesWrapper.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        this.slidesWrapper.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: true });

        this.slidesWrapper.addEventListener('click', (e) => {
            if (e.target.classList.contains('nav-link') || e.target.closest('.nav-link')) {
                const link = e.target.classList.contains('nav-link') ? e.target : e.target.closest('.nav-link');
                
                // Verifica se é link da Sentinela e se é semana futura
                if (link.href.includes('/sentinela/') && this.ehSemanaFutura(link)) {
                    e.preventDefault();
                    const parametro = this.extrairParametroDoLink(link.href);
                    window.location.href = `sentinela/em-breve.html?semana=${parametro}`;
                    return;
                }
                
                link.classList.add('loading');
                setTimeout(() => link.classList.remove('loading'), 2000);
            }
        });

        let lastTouchEnd = 0;
        document.addEventListener('touchend', (event) => {
            const now = (new Date()).getTime();
            if (now - lastTouchEnd <= 300) {
                event.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
    }

    onTouchStart(e) {
        this.startX = e.touches[0].clientX;
        this.startY = e.touches[0].clientY;
        this.slidesWrapper.classList.add('swiping');
    }

    onTouchMove(e) {
        if (!this.startX || !this.startY) return;

        this.distX = e.touches[0].clientX - this.startX;
        this.distY = e.touches[0].clientY - this.startY;

        if (Math.abs(this.distX) > Math.abs(this.distY)) {
            e.preventDefault();
        }
    }

    onTouchEnd(e) {
        this.slidesWrapper.classList.remove('swiping');
        
        if (!this.startX || !this.startY) return;

        if (Math.abs(this.distX) > Math.abs(this.distY) && Math.abs(this.distX) > this.threshold) {
            if (this.distX > 0) {
                this.prevSlide();
            } else {
                this.nextSlide();
            }
        }

        this.startX = 0;
        this.startY = 0;
        this.distX = 0;
        this.distY = 0;
    }

    goToSlide(slideIndex) {
        if (this.isAnimating || slideIndex === this.currentSlide || slideIndex < 0 || slideIndex >= this.totalSlides) return;
        
        this.isAnimating = true;
        this.currentSlide = slideIndex;
        
        const translateX = -(slideIndex * 100);
        this.slidesWrapper.style.transform = `translateX(${translateX}%)`;
        
        setTimeout(() => {
            this.isAnimating = false;
            this.updateDisplay();
            this.atualizarContextoCache();
        }, 300);
    }

    nextSlide() {
        const nextIndex = (this.currentSlide + 1) % this.totalSlides;
        this.goToSlide(nextIndex);
    }

    prevSlide() {
        const prevIndex = (this.currentSlide - 1 + this.totalSlides) % this.totalSlides;
        this.goToSlide(prevIndex);
    }

    updateDisplay() {
        const indicators = this.indicatorsContainer.querySelectorAll('.indicator');
        indicators.forEach((indicator, index) => {
            indicator.classList.toggle('active', index === this.currentSlide);
        });

        if (this.diasConfig[this.currentSlide]) {
            const semanaText = this.diasConfig[this.currentSlide].semana;
            this.semanaDisplay.textContent = `Reunião de ${semanaText}`;
        }
    }

    atualizarContextoCache() {
        if (this.diasConfig[this.currentSlide]) {
            this.currentSemana = this.diasConfig[this.currentSlide].parametro;
            window.semanaAtual = this.currentSemana;
        }
    }

    irParaSemanaAtual() {
        const hoje = new Date();
        const semanaAtual = this.detectarSemanaAtual(hoje);
        
        if (semanaAtual !== -1) {
            setTimeout(() => {
                this.goToSlide(semanaAtual);
            }, 500);
        }
    }

    detectarSemanaAtual(dataAtual) {
        const ano = dataAtual.getFullYear();
        
        for (let i = 0; i < this.diasConfig.length; i++) {
            const config = this.diasConfig[i];
            const periodos = this.extrairPeriodo(config.semana, ano);
            
            if (periodos && this.dataEstaEntrePeriodos(dataAtual, periodos)) {
                return i;
            }
        }
        return -1;
    }

    extrairPeriodo(textoSemana, ano) {
        // Padrão: "25-31 de Agosto" ou "29 de Setembro - 5 de Outubro"
        const padrao1 = /(\d{1,2})-(\d{1,2}) de (\w+)/;
        const padrao2 = /(\d{1,2}) de (\w+) - (\d{1,2}) de (\w+)/;
        
        const meses = {
            'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3,
            'maio': 4, 'junho': 5, 'julho': 6, 'agosto': 7,
            'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11
        };

        let match = textoSemana.match(padrao2);
        if (match) {
            const diaInicio = parseInt(match[1]);
            const mesInicio = meses[match[2].toLowerCase()];
            const diaFim = parseInt(match[3]);
            const mesFim = meses[match[4].toLowerCase()];
            
            return {
                inicio: new Date(ano, mesInicio, diaInicio),
                fim: new Date(ano, mesFim, diaFim)
            };
        }

        match = textoSemana.match(padrao1);
        if (match) {
            const diaInicio = parseInt(match[1]);
            const diaFim = parseInt(match[2]);
            const mes = meses[match[3].toLowerCase()];
            
            return {
                inicio: new Date(ano, mes, diaInicio),
                fim: new Date(ano, mes, diaFim)
            };
        }

        return null;
    }

    dataEstaEntrePeriodos(data, periodo) {
        return data >= periodo.inicio && data <= periodo.fim;
    }

    ehSemanaFuturaParametro(parametro) {
        const configSemana = this.diasConfig.find(config => config.parametro === parametro);
        if (!configSemana) return false;
        
        const hoje = new Date();
        const ano = hoje.getFullYear();
        const periodo = this.extrairPeriodo(configSemana.semana, ano);
        
        if (!periodo) return false;
        
        return hoje < periodo.inicio;
    }

    ehSemanaFutura(linkElement) {
        const href = linkElement.href;
        const parametro = this.extrairParametroDoLink(href);
        
        if (!parametro) return false;
        
        // Encontra a configuração desta semana
        const configSemana = this.diasConfig.find(config => config.parametro === parametro);
        if (!configSemana) return false;
        
        const hoje = new Date();
        const ano = hoje.getFullYear();
        const periodo = this.extrairPeriodo(configSemana.semana, ano);
        
        if (!periodo) return false;
        
        // Verifica se a semana ainda não começou (é futura)
        return hoje < periodo.inicio;
    }

    extrairParametroDoLink(href) {
        const match = href.match(/sentinela\/([^\/]+)\//);
        return match ? match[1] : null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CarouselManager();
});