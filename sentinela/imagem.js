// imagem.js (Versão FINAL com caminhos dinâmicos por semana)

document.addEventListener('DOMContentLoaded', () => {
    // Pega a variável global definida no HTML.
    // Se não existir, usa 'default' para evitar quebrar e mostra um aviso.
    const semana = window.semanaAtual;
    if (!semana) {
        console.warn('A variável global "window.semanaAtual" não foi encontrada. Verifique o <script> no seu HTML. As imagens não serão carregadas corretamente.');
        return; // Interrompe a execução se a semana não for definida.
    }

    const placeholders = document.querySelectorAll('[class^="imagem"]');

    placeholders.forEach(placeholder => {
        const id = placeholder.className.replace('imagem', '');
        if (!id || isNaN(id)) {
            console.error('Placeholder de imagem com ID inválido:', placeholder);
            return;
        }

        // --- A MUDANÇA PRINCIPAL ESTÁ AQUI ---
        // Constrói o caminho dinamicamente usando a variável 'semana'.
        const basePath = `imagem/semanas/${semana}/`;
        const imgPath = `${basePath}img${id}.png`;
        const legPath = `${basePath}leg${id}.txt`;

        // O resto do código permanece o mesmo, pois agora ele usa os caminhos corretos.
        fetch(legPath)
            .then(response => {
                if (response.ok) {
                    return response.text(); 
                }
                return ''; 
            })
            .then(legendaText => {
                const figure = document.createElement('figure');
                figure.className = 'figura-container';

                const img = document.createElement('img');
                img.src = imgPath;
                img.alt = legendaText.trim();
                
                // Adiciona um listener de erro para a imagem, caso ela não seja encontrada
                img.onerror = () => {
                    console.error(`Erro: A imagem não foi encontrada no caminho: ${imgPath}`);
                    placeholder.innerHTML = `<div class="figura-erro">Imagem para '${semana}' (img${id}.png) não encontrada.</div>`;
                };

                img.addEventListener('click', () => {
                    if (typeof window.abrirZoom === 'function') {
                        window.abrirZoom(img);
                    } else {
                        console.error('Função de zoom (abrirZoom) não encontrada.');
                    }
                });

                figure.appendChild(img);

                if (legendaText && legendaText.trim() !== '') {
                    const figcaption = document.createElement('figcaption');
                    figcaption.className = 'figura-legenda';
                    figcaption.textContent = legendaText.trim();
                    figure.appendChild(figcaption);
                }
                
                placeholder.replaceWith(figure);
            })
            .catch(error => {
                console.error('Erro de rede ao carregar recursos da imagem:', error);
                placeholder.innerHTML = `<div class="figura-erro">Erro de rede ao carregar imagem ${id}</div>`;
            });
    });
});