// barra/barra.js (VERSÃO FINAL - LIMPA TUDO, INCLUINDO MARCAÇÕES)

document.addEventListener("DOMContentLoaded", () => {
    const barraEstudo = document.querySelector(".barra-estudo");
    const mainContent = document.querySelector("main");

    if (!barraEstudo || !mainContent) {
        console.error("Elemento .barra-estudo ou main não encontrado.");
        return;
    }

    const menuContainer = document.createElement("div");
    menuContainer.className = "menu-barra";
    menuContainer.innerHTML = `<button class="btn-limpar-cache">Limpar Todas as Anotações</button>`;

    mainContent.prepend(menuContainer);
    
    const btnLimparCache = menuContainer.querySelector(".btn-limpar-cache");

    barraEstudo.style.cursor = "pointer";
    barraEstudo.addEventListener("click", () => {
        menuContainer.classList.toggle("ativa");
    });

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
            // ===== A CORREÇÃO ESTÁ AQUI =====
            // Filtra chaves que começam com "c-" (comentário), "r-" (resposta IA),
            // ou "paragrafo-" (marcações em parágrafos gerais),
            // ou que contenham "-pg-" (marcações em parágrafos de perguntas).
            // Isso cobre todos os tipos de cache do projeto.
            Object.keys(localStorage)
                .filter(key => /^(c-|r-|paragrafo-)|-pg-/.test(key)) 
                .forEach(key => localStorage.removeItem(key));
            
            alert("Anotações e marcações limpas! A página será recarregada.");
            location.reload();
        }
    });
});