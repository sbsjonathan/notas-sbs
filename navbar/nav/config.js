// navbar/config.js - Sistema global de configuração e detecção de semanas

window.SistemaGlobal = {
    diasConfig: [],
    carregado: false,

    async init() {
        if (this.carregado) return;
        
        try {
            const response = await fetch(this.getConfigPath());
            if (response.ok) {
                const configText = await response.text();
                eval(configText);
                this.diasConfig = window.diasConfig || [];
                this.carregado = true;
            }
        } catch (error) {
            console.error('Erro ao carregar configuração global:', error);
        }
    },

    getConfigPath() {
        const path = window.location.pathname;
        if (path.includes('/biblia/') || path.includes('/sentinela/')) {
            return '../dias-config.js';
        }
        return 'dias-config.js';
    },

    detectarSemanaAtual() {
        if (!this.carregado) return -1;
        
        const hoje = new Date();
        const ano = hoje.getFullYear();
        
        for (let i = 0; i < this.diasConfig.length; i++) {
            const config = this.diasConfig[i];
            const periodo = this.extrairPeriodo(config.semana, ano);
            
            if (periodo && this.dataEstaEntrePeriodos(hoje, periodo)) {
                return i;
            }
        }
        return -1;
    },

    ehSemanaFutura(config) {
        const hoje = new Date();
        const ano = hoje.getFullYear();
        const periodo = this.extrairPeriodo(config.semana, ano);
        
        return periodo && hoje < periodo.inicio;
    },

    extrairPeriodo(textoSemana, ano) {
        const padrao1 = /(\d{1,2})-(\d{1,2}) de (\w+)/;
        const padrao2 = /(\d{1,2}) de (\w+) - (\d{1,2}) de (\w+)/;
        
        const meses = {
            'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3,
            'maio': 4, 'junho': 5, 'julho': 6, 'agosto': 7,
            'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11
        };

        let match = textoSemana.match(padrao2);
        if (match) {
            return {
                inicio: new Date(ano, meses[match[2].toLowerCase()], parseInt(match[1])),
                fim: new Date(ano, meses[match[4].toLowerCase()], parseInt(match[3]))
            };
        }

        match = textoSemana.match(padrao1);
        if (match) {
            const mes = meses[match[3].toLowerCase()];
            return {
                inicio: new Date(ano, mes, parseInt(match[1])),
                fim: new Date(ano, mes, parseInt(match[2]))
            };
        }

        return null;
    },

    dataEstaEntrePeriodos(data, periodo) {
        return data >= periodo.inicio && data <= periodo.fim;
    },

    async irParaSentinelaAtual() {
        await this.init();
        
        if (!this.carregado) {
            alert('Erro ao carregar sistema.');
            return;
        }

        const semanaAtual = this.detectarSemanaAtual();
        
        if (semanaAtual !== -1) {
            const config = this.diasConfig[semanaAtual];
            const basePath = this.getBasePath();
            
            if (this.ehSemanaFutura(config)) {
                window.location.href = `${basePath}sentinela/em-breve.html?semana=${config.parametro}`;
            } else {
                window.location.href = `${basePath}sentinela/${config.parametro}/sentinela.html`;
            }
        } else {
            alert('Não foi possível detectar a semana atual.');
        }
    },

    async irParaAnotacoesAtual() {
        await this.init();
        
        if (!this.carregado) {
            alert('Erro ao carregar sistema.');
            return;
        }

        const semanaAtual = this.detectarSemanaAtual();
        
        if (semanaAtual !== -1) {
            const config = this.diasConfig[semanaAtual];
            const basePath = this.getBasePath();
            
            // Define a semana atual globalmente antes de navegar
            window.semanaAtual = config.parametro;
            
            // Vai direto para o richtext com o parâmetro da semana
            window.location.href = `${basePath}richtext/container.html?semana=${config.parametro}`;
        } else {
            alert('Não foi possível detectar a semana atual.');
        }
    },

    getBasePath() {
        const path = window.location.pathname;
        if (path.includes('/biblia/')) {
            return '../';
        } else if (path.includes('/richtext/') || path.includes('/sentinela/')) {
            return '../';
        }
        return '';
    }
};

// Carrega automaticamente
window.SistemaGlobal.init();