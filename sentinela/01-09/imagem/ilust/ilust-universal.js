// imagem/ilust/ilust-universal.js
// Sistema universal para carregar todas as ilustrações

document.addEventListener("DOMContentLoaded", () => {
    // Carrega o CSS global das ilustrações uma única vez
    const cssLink = document.createElement("link");
    cssLink.rel = "stylesheet";
    cssLink.href = "imagem/ilust/styles.css";
    document.head.appendChild(cssLink);

    // Encontra todos os placeholders de ilustração (.ilust1, .ilust2, etc.)
    const placeholders = document.querySelectorAll('[class^="ilust"]');
    
    placeholders.forEach(placeholder => {
        const className = placeholder.className;
        const match = className.match(/ilust(\d+)/);
        
        if (!match) {
            console.warn('Placeholder com classe inválida:', className);
            return;
        }
        
        const numero = match[1];
        const htmlPath = `imagem/ilust/ilust${numero}/ilust${numero}.html`;
        
        // Carrega o arquivo HTML correspondente
        fetch(htmlPath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Arquivo não encontrado: ${htmlPath}`);
                }
                return response.text();
            })
            .then(htmlCompleto => {
                // Extrai apenas o conteúdo do body
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlCompleto, 'text/html');
                const bodyContent = doc.body.innerHTML;
                
                // Cria um wrapper para a ilustração
                const wrapper = document.createElement('div');
                wrapper.className = `ilust-wrapper ilust${numero}-wrapper`;
                wrapper.innerHTML = bodyContent;
                
                // Substitui o placeholder pelo conteúdo
                placeholder.replaceWith(wrapper);
                
                // Ativa os links bíblicos na ilustração recém-carregada
                if (typeof window.ativarLinksBiblicos === 'function') {
                    window.ativarLinksBiblicos(wrapper);
                }
                
                console.log(`Ilustração ${numero} carregada com sucesso`);
            })
            .catch(error => {
                console.error(`Erro ao carregar ilustração ${numero}:`, error);
                placeholder.innerHTML = `
                    <div class="ilust-erro">
                        <p>Erro ao carregar ilustração ${numero}</p>
                        <small>${error.message}</small>
                    </div>
                `;
            });
    });
});