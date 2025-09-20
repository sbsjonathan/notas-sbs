// barra/barra.js (VERSÃO COM BOTÃO DE CARREGAR DA NUVEM)

document.addEventListener("DOMContentLoaded", () => {
    const barraEstudo = document.querySelector(".barra-estudo");
    const mainContent = document.querySelector("main");

    if (!barraEstudo || !mainContent) {
        console.error("Elemento .barra-estudo ou main não encontrado.");
        return;
    }

    const menuContainer = document.createElement("div");
    menuContainer.className = "menu-barra";
    menuContainer.innerHTML = `
        <button class="btn-carregar-nuvem">📥 Carregar da Nuvem</button>
        <button class="btn-limpar-cache">🗑️ Limpar Anotações</button>
    `;

    mainContent.prepend(menuContainer);
    
    const btnCarregarNuvem = menuContainer.querySelector(".btn-carregar-nuvem");
    const btnLimparCache = menuContainer.querySelector(".btn-limpar-cache");

    barraEstudo.style.cursor = "pointer";
    barraEstudo.addEventListener("click", () => {
        menuContainer.classList.toggle("ativa");
    });

    // ===== NOVO: BOTÃO CARREGAR DA NUVEM =====
    btnCarregarNuvem.addEventListener("click", async () => {
        // Verifica se está logado
        const isLoggedIn = !!localStorage.getItem('supabase_user');
        
        if (!isLoggedIn) {
            alert("Você precisa fazer login primeiro para carregar da nuvem.");
            return;
        }

        // Desabilita o botão durante o carregamento
        btnCarregarNuvem.disabled = true;
        const textoOriginal = btnCarregarNuvem.innerHTML;
        btnCarregarNuvem.innerHTML = '⏳ Carregando...';

        try {
            // Detecta semana e estudo
            const urlParams = new URLSearchParams(window.location.search);
            const semanaAtual = window.semanaAtual || urlParams.get('semana');
            const estudoId = window.estudoId || document.body.dataset.estudo;

            if (!semanaAtual || !estudoId) {
                throw new Error('Semana ou estudo não detectados');
            }

            // Aguarda SupabaseSync estar pronto
            let attempts = 0;
            while (!window.SupabaseSync && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }

            if (!window.SupabaseSync) {
                throw new Error('Sistema de sincronização não disponível');
            }

            // Remove flag de já carregado para forçar novo load
            const loadFlag = `sentinela_loaded_${semanaAtual}_${estudoId}`;
            sessionStorage.removeItem(loadFlag);

            console.log('🔄 Forçando carregamento da nuvem...');

            // Carrega as anotações
            const anotacoes = await window.SupabaseSync.carregarSentinelaAnotacoes(
                semanaAtual,
                estudoId
            );

            if (anotacoes && Object.keys(anotacoes).length > 0) {
                console.log(`✅ ${Object.keys(anotacoes).length} anotações recebidas`);

                // Verifica se há mudanças
                let hasChanges = false;
                for (const [key, value] of Object.entries(anotacoes)) {
                    if (localStorage.getItem(key) !== value) {
                        localStorage.setItem(key, value);
                        hasChanges = true;
                    }
                }

                if (hasChanges) {
                    // Marca como carregado
                    sessionStorage.setItem(loadFlag, 'true');
                    
                    btnCarregarNuvem.innerHTML = '✅ Carregado!';
                    alert("Anotações carregadas da nuvem! A página será recarregada.");
                    
                    setTimeout(() => {
                        location.reload();
                    }, 1000);
                } else {
                    btnCarregarNuvem.innerHTML = '✅ Já sincronizado';
                    setTimeout(() => {
                        btnCarregarNuvem.innerHTML = textoOriginal;
                        btnCarregarNuvem.disabled = false;
                    }, 2000);
                }
            } else {
                btnCarregarNuvem.innerHTML = '📭 Nada na nuvem';
                setTimeout(() => {
                    btnCarregarNuvem.innerHTML = textoOriginal;
                    btnCarregarNuvem.disabled = false;
                }, 2000);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar:', error);
            alert(`Erro ao carregar da nuvem: ${error.message}`);
            btnCarregarNuvem.innerHTML = '❌ Erro';
            
            setTimeout(() => {
                btnCarregarNuvem.innerHTML = textoOriginal;
                btnCarregarNuvem.disabled = false;
            }, 2000);
        }
    });

    // ===== BOTÃO LIMPAR CACHE (ORIGINAL) =====
    btnLimparCache.addEventListener("click", () => {
        let totalBytes = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key) || '';
            totalBytes += (key.length + value.length) * 2;
        }
        const quotaBytes = 5 * 1024 * 1024;
        const percentualUso = (totalBytes / quotaBytes) * 100;

        const mensagemConfirmacao = 
            `Isso apagará TODAS as anotações, marcações e respostas de IA salvas neste dispositivo.\n\n` +
            `Uso atual do cache: ${percentualUso.toFixed(2)}% de 5 MB.\n\n` +
            `Deseja continuar?`;

        if (confirm(mensagemConfirmacao)) {
            // Filtra chaves que começam com "c-" (comentário), "r-" (resposta IA),
            // ou "paragrafo-" (marcações em parágrafos gerais),
            // ou que contenham "-pg-" (marcações em parágrafos de perguntas).
            Object.keys(localStorage)
                .filter(key => /^(c-|r-|paragrafo-)|-pg-/.test(key)) 
                .forEach(key => localStorage.removeItem(key));
            
            alert("Anotações e marcações limpas! A página será recarregada.");
            location.reload();
        }
    });
});