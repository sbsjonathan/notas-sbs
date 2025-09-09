// imagem.js (Versão MODIFICADA para aceitar imagens sem legenda)

document.addEventListener('DOMContentLoaded', () => {
    const placeholders = document.querySelectorAll('[class^="imagem"]');

    placeholders.forEach(placeholder => {
        const id = placeholder.className.replace('imagem', '');
        if (!id || isNaN(id)) {
            console.error('Placeholder de imagem com ID inválido:', placeholder);
            return;
        }

        const imgPath = `imagem/imgleg/img${id}.png`;
        const legPath = `imagem/imgleg/leg${id}.txt`;

        // Passo 1: Tentamos buscar a legenda, mas sem tratar a falha como um erro fatal.
        fetch(legPath)
            .then(response => {
                // Se a resposta for 'ok' (HTTP 200), significa que a legenda existe.
                if (response.ok) {
                    return response.text(); 
                }
                // Se não for 'ok' (ex: 404 Not Found), retornamos uma string vazia.
                // Isso sinaliza que a imagem não tem legenda.
                return ''; 
            })
            .then(legendaText => {
                // Passo 2: Construímos a imagem, que sempre existirá.
                const figure = document.createElement('figure');
                figure.className = 'figura-container';

                const img = document.createElement('img');
                img.src = imgPath;
                
                // O `alt` da imagem usa o texto da legenda para acessibilidade.
                // Se a legenda estiver vazia, o `alt` também ficará vazio.
                img.alt = legendaText.trim();

                // Conectamos o zoom para TODAS as imagens, com ou sem legenda.
                img.addEventListener('click', () => {
                    if (typeof window.abrirZoom === 'function') {
                        window.abrirZoom(img);
                    }
                });

                figure.appendChild(img);

                // Passo 3: SÓ criamos a legenda se o texto dela não for vazio.
                if (legendaText && legendaText.trim() !== '') {
                    const figcaption = document.createElement('figcaption');
                    figcaption.className = 'figura-legenda';
                    figcaption.textContent = legendaText.trim();
                    figure.appendChild(figcaption);
                }
                
                // Finalmente, substituímos o placeholder pelo nosso elemento <figure> completo.
                placeholder.replaceWith(figure);
            })
            .catch(error => {
                // Este .catch agora só pegará erros de rede reais, não mais um 404.
                console.error('Erro de rede ao carregar recursos da imagem:', error);
                placeholder.innerHTML = `<div class="figura-erro">Erro de rede ao carregar imagem ${id}</div>`;
            });
    });
});