/**
 * cache-r.js - Sistema de Cache Inteligente para Anotações do RichText
 * Similar ao sistema de cache da Sentinela, mas para anotações por semana
 * Endereçamento: 25-08, 01-09, 08-09, etc.
 */

class CacheRichText {
    constructor() {
        this.semanaAtual = null;
        this.prefixoCache = 'richtext_cache_';
        this.debugMode = true; // Para desenvolvimento
        
        this.init();
    }

    /**
     * Inicialização do sistema
     */
    init() {
        // Obtém o parâmetro da semana da URL
        this.semanaAtual = this.obterSemanaURL();
        
        if (this.debugMode) {
            console.log('🗂️ Cache RichText inicializado');
            console.log('📅 Semana detectada:', this.semanaAtual);
        }

        // Se não conseguiu obter a semana, usa uma padrão
        if (!this.semanaAtual) {
            this.semanaAtual = this.obterSemanaAtual();
            console.warn('⚠️ Semana não encontrada na URL, usando padrão:', this.semanaAtual);
        }

        // Aguarda o DOM estar pronto para integrar com o editor
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.integrarComEditor());
        } else {
            this.integrarComEditor();
        }
    }

    /**
     * Obtém o parâmetro da semana da URL
     * Exemplo: container.html?semana=25-08 -> "25-08"
     */
    obterSemanaURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const semanaParam = urlParams.get('semana');
        
        if (semanaParam) {
            // Valida o formato da semana (DD-MM)
            const formatoValido = /^\d{2}-\d{2}$/.test(semanaParam);
            if (formatoValido) {
                return semanaParam;
            } else {
                console.warn('⚠️ Formato de semana inválido:', semanaParam);
            }
        }
        
        return null;
    }

    /**
     * Gera uma semana padrão baseada na data atual
     * Para fallback quando não há parâmetro na URL
     */
    obterSemanaAtual() {
        const agora = new Date();
        const dia = String(agora.getDate()).padStart(2, '0');
        const mes = String(agora.getMonth() + 1).padStart(2, '0');
        return `${dia}-${mes}`;
    }

    /**
     * Gera a chave do localStorage para a semana atual
     */
    obterChaveCache() {
        return `${this.prefixoCache}${this.semanaAtual}`;
    }

    /**
     * Salva o conteúdo do editor no cache da semana atual
     */
    salvarCache(conteudo) {
        try {
            const chave = this.obterChaveCache();
            const dados = {
                conteudo: conteudo,
                ultimaAtualizacao: new Date().toISOString(),
                semana: this.semanaAtual,
                versao: '1.0'
            };

            localStorage.setItem(chave, JSON.stringify(dados));
            
            if (this.debugMode) {
                console.log('💾 Cache salvo para semana', this.semanaAtual);
                console.log('📊 Tamanho do conteúdo:', conteudo.length, 'caracteres');
            }

            return true;
        } catch (error) {
            console.error('❌ Erro ao salvar cache:', error);
            return false;
        }
    }

    /**
     * Carrega o conteúdo do cache da semana atual
     */
    carregarCache() {
        try {
            const chave = this.obterChaveCache();
            const dadosString = localStorage.getItem(chave);
            
            if (!dadosString) {
                if (this.debugMode) {
                    console.log('📭 Nenhum cache encontrado para semana', this.semanaAtual);
                }
                return null;
            }

            const dados = JSON.parse(dadosString);
            
            if (this.debugMode) {
                console.log('📂 Cache carregado para semana', this.semanaAtual);
                console.log('🕐 Última atualização:', dados.ultimaAtualizacao);
                console.log('📊 Tamanho do conteúdo:', dados.conteudo.length, 'caracteres');
            }

            return dados.conteudo;
        } catch (error) {
            console.error('❌ Erro ao carregar cache:', error);
            return null;
        }
    }

    /**
     * Limpa o cache da semana atual
     */
    limparCache() {
        try {
            const chave = this.obterChaveCache();
            localStorage.removeItem(chave);
            
            if (this.debugMode) {
                console.log('🗑️ Cache limpo para semana', this.semanaAtual);
            }
            
            return true;
        } catch (error) {
            console.error('❌ Erro ao limpar cache:', error);
            return false;
        }
    }

    /**
     * Lista todas as semanas que têm cache salvo
     */
    listarSemanasComCache() {
        const semanas = [];
        
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const chave = localStorage.key(i);
                if (chave && chave.startsWith(this.prefixoCache)) {
                    const semana = chave.replace(this.prefixoCache, '');
                    semanas.push(semana);
                }
            }
            
            // Ordena as semanas
            semanas.sort();
            
            if (this.debugMode) {
                console.log('📋 Semanas com cache:', semanas);
            }
            
            return semanas;
        } catch (error) {
            console.error('❌ Erro ao listar semanas:', error);
            return [];
        }
    }

    /**
     * Obtém estatísticas do cache
     */
    obterEstatisticas() {
        const semanas = this.listarSemanasComCache();
        let tamanhoTotal = 0;
        const detalhes = [];

        semanas.forEach(semana => {
            try {
                const chave = `${this.prefixoCache}${semana}`;
                const dados = localStorage.getItem(chave);
                if (dados) {
                    const parsed = JSON.parse(dados);
                    const tamanho = dados.length;
                    tamanhoTotal += tamanho;
                    
                    detalhes.push({
                        semana: semana,
                        tamanho: tamanho,
                        ultimaAtualizacao: parsed.ultimaAtualizacao,
                        caracteres: parsed.conteudo.length
                    });
                }
            } catch (error) {
                console.error('❌ Erro ao processar semana:', semana, error);
            }
        });

        return {
            totalSemanas: semanas.length,
            tamanhoTotal: tamanhoTotal,
            detalhes: detalhes
        };
    }

    /**
     * Integra o sistema de cache com o editor existente
     */
    integrarComEditor() {
        // Aguarda o editor estar disponível
        const verificarEditor = () => {
            const editor = document.getElementById('text-editor');
            if (editor) {
                this.setupEditor(editor);
            } else {
                // Tenta novamente em 100ms
                setTimeout(verificarEditor, 100);
            }
        };
        
        verificarEditor();
    }

    /**
     * Configura a integração com o editor de texto
     */
    setupEditor(editor) {
        if (this.debugMode) {
            console.log('🔌 Integrando cache com editor');
        }

        // Carrega o conteúdo salvo
        const conteudoSalvo = this.carregarCache();
        if (conteudoSalvo) {
            editor.innerHTML = conteudoSalvo;
            
            // Atualiza a classe empty se necessário
            if (conteudoSalvo.trim() === '') {
                editor.classList.add('is-empty');
            } else {
                editor.classList.remove('is-empty');
            }
        }

        // Auto-save a cada 2 segundos de inatividade
        let timeoutSave = null;
        const autoSave = () => {
            clearTimeout(timeoutSave);
            timeoutSave = setTimeout(() => {
                this.salvarCache(editor.innerHTML);
            }, 2000);
        };

        // Eventos para auto-save
        editor.addEventListener('input', autoSave);
        editor.addEventListener('keyup', autoSave);
        editor.addEventListener('paste', autoSave);

        // Salva antes de sair da página
        window.addEventListener('beforeunload', () => {
            this.salvarCache(editor.innerHTML);
        });

        // Salva quando a página perde o foco
        window.addEventListener('blur', () => {
            this.salvarCache(editor.innerHTML);
        });

        // Adiciona método global para debug
        window.cacheRichText = {
            salvar: () => this.salvarCache(editor.innerHTML),
            carregar: () => this.carregarCache(),
            limpar: () => this.limparCache(),
            semanas: () => this.listarSemanasComCache(),
            stats: () => this.obterEstatisticas(),
            semanaAtual: () => this.semanaAtual
        };

        if (this.debugMode) {
            console.log('✅ Cache integrado com sucesso!');
            console.log('🛠️ Use window.cacheRichText para debug');
        }
    }

    /**
     * Migra dados de cache antigo (se existir) para o novo formato
     */
    migrarCacheAntigo() {
        // Verifica se existe cache no formato antigo
        const cacheAntigo = localStorage.getItem('editor_content');
        if (cacheAntigo) {
            console.log('🔄 Migrando cache antigo...');
            
            // Salva no novo formato
            this.salvarCache(cacheAntigo);
            
            // Remove o cache antigo
            localStorage.removeItem('editor_content');
            
            console.log('✅ Migração concluída!');
        }
    }
}

// Inicializa o sistema automaticamente
const cacheRichText = new CacheRichText();

// Exporta para uso global (se necessário)
window.CacheRichText = CacheRichText;