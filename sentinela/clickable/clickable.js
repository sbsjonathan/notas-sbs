// clickable/clickable.js (VERSÃO COMPLETA COM OBJETIVO)

function initClickable() {
  const estudoId = window.estudoId || "0";
  const triggers = document.querySelectorAll("p.pergunta, .lista-recapitulacao li");

  triggers.forEach((triggerElement, index) => {
    const isRecapQuestion = triggerElement.tagName === 'LI';

    if (isRecapQuestion) {
      // Lógica para recapitulação (continua a mesma)
      const recapIndex = Array.from(triggerElement.parentElement.children).indexOf(triggerElement) + 1;
      const idPergunta = `p-rcp-${recapIndex}-${estudoId}`;
      const idRespostaIA = `r-rcp-${recapIndex}-${estudoId}`;
      const idComentario = `c-rcp-${recapIndex}-${estudoId}`;
      triggerElement.id = idPergunta;

      const anotacaoContainer = document.createElement("div");
      anotacaoContainer.className = "anotacao";
      const iaWrapper = document.createElement("div");
      iaWrapper.className = "ia-wrapper";
      const respostaIADiv = document.createElement("div");
      respostaIADiv.className = "clickable";
      respostaIADiv.id = idRespostaIA;
      respostaIADiv.contentEditable = "false";
      const btnGerarIA = document.createElement("button");
      btnGerarIA.textContent = "✨";
      btnGerarIA.title = "Gerar Resposta com IA (Análise Global)";
      btnGerarIA.className = "btn-gerar-ia";
      
      iaWrapper.appendChild(respostaIADiv);
      iaWrapper.appendChild(btnGerarIA);
      anotacaoContainer.appendChild(iaWrapper);

      const comentariosDiv = document.createElement("div");
      comentariosDiv.className = "comentarios";
      comentariosDiv.contentEditable = "true";
      comentariosDiv.id = idComentario;
      
      triggerElement.appendChild(anotacaoContainer);
      triggerElement.appendChild(comentariosDiv);
      
      if (window.CacheAnotacao) {
        comentariosDiv.innerHTML = window.CacheAnotacao.carregar(idComentario);
        respostaIADiv.innerHTML = window.CacheAnotacao.carregar(idRespostaIA) || '<span style="color: #9ca3af;">Clique no ícone ✨ para gerar uma resposta.</span>';
        comentariosDiv.addEventListener('input', () => {
          window.CacheAnotacao.salvar(idComentario, comentariosDiv.innerHTML);
        });
      }

      btnGerarIA.onclick = () => gerarRespostaIA_Recap(idPergunta, iaWrapper, idRespostaIA);

      triggerElement.style.cursor = "pointer";
      const toggleAIView = (e) => {
        if (e.target.closest('.btn-gerar-ia, .comentarios, a')) return;
        anotacaoContainer.classList.toggle("ativa");
        e.preventDefault();
      };
      triggerElement.addEventListener('click', toggleAIView);

    } else {
      // Lógica para perguntas numeradas (simplificada)
      const spanNumero = triggerElement.querySelector("span");
      if (!spanNumero) return;

      let numeroParagrafo = spanNumero.textContent.trim().replace('.', '');
      const idPergunta = `p-${estudoId}-${numeroParagrafo}`;
      
      const idContainerIA = `ia-${estudoId}-${numeroParagrafo}`;
      const idComentario = `c-${estudoId}-${numeroParagrafo}`;
      const idRespostaIA = `r-${estudoId}-${numeroParagrafo}`;
      
      triggerElement.id = idPergunta;

      // ---- TAREFA PRINCIPAL DESTE SCRIPT ----
      // Encontra os parágrafos e dá a eles seus IDs permanentes.
      const paragrafosAssociados = [];
      let elementoAtual = triggerElement.parentElement.nextElementSibling;
      while (elementoAtual && (elementoAtual.classList.contains('paragrafo') || elementoAtual.matches('[class^="imagem"]'))) {
          if(elementoAtual.classList.contains('paragrafo')) {
            paragrafosAssociados.push(elementoAtual);
            elementoAtual.setAttribute('data-question-id', idPergunta);
          }
          elementoAtual = elementoAtual.nextElementSibling;
      }
      
      paragrafosAssociados.forEach((p, index) => {
          p.id = `${idPergunta}-pg-${index}`;
      });
      // ----------------------------------------

      const anotacaoContainer = document.createElement("div");
      anotacaoContainer.className = "anotacao";
      const iaWrapper = document.createElement("div");
      iaWrapper.className = "ia-wrapper";
      const respostaIADiv = document.createElement("div");
      respostaIADiv.className = "clickable";
      respostaIADiv.id = idRespostaIA;
      respostaIADiv.contentEditable = "false";
      const btnGerarIA = document.createElement("button");
      btnGerarIA.textContent = "✨";
      btnGerarIA.title = "Gerar Resposta com IA";
      btnGerarIA.className = "btn-gerar-ia";
      
      iaWrapper.appendChild(respostaIADiv);
      iaWrapper.appendChild(btnGerarIA);
      anotacaoContainer.appendChild(iaWrapper);

      const comentariosDiv = document.createElement("div");
      comentariosDiv.className = "comentarios";
      comentariosDiv.contentEditable = "true";
      comentariosDiv.id = idComentario;
      
      const iaContainer = document.createElement('div');
      iaContainer.id = idContainerIA;
      
      const parentOfQuestion = triggerElement.parentElement;
      parentOfQuestion.parentNode.insertBefore(iaContainer, parentOfQuestion);

      iaContainer.appendChild(parentOfQuestion);
      iaContainer.appendChild(anotacaoContainer);
      iaContainer.appendChild(comentariosDiv);
      
      let elementoParaMover = iaContainer.nextElementSibling;
      while(elementoParaMover && (paragrafosAssociados.includes(elementoParaMover) || elementoParaMover.matches('[class^="imagem"]'))){
          const proximo = elementoParaMover.nextElementSibling;
          iaContainer.appendChild(elementoParaMover);
          elementoParaMover = proximo;
      }
      
      btnGerarIA.onclick = () => gerarRespostaIA(idPergunta, iaWrapper, idRespostaIA);

      if (window.CacheAnotacao) {
        comentariosDiv.innerHTML = window.CacheAnotacao.carregar(idComentario);
        respostaIADiv.innerHTML = window.CacheAnotacao.carregar(idRespostaIA) || '<span style="color: #9ca3af;">Clique no ícone ✨ para gerar uma resposta.</span>';
        comentariosDiv.addEventListener('input', () => {
          window.CacheAnotacao.salvar(idComentario, comentariosDiv.innerHTML);
        });
      }

      triggerElement.style.cursor = "pointer";
      const toggleAIView = (e) => {
          if (!e.target.closest('.bbl, a')) {
              anotacaoContainer.classList.toggle("ativa");
              e.preventDefault();
          }
      };
      triggerElement.addEventListener('click', toggleAIView);
    }
  });

  // ========== NOVO: SUPORTE PARA OBJETIVO ==========
  const objetivoElement = document.querySelector('.objetivo');
  if (objetivoElement) {
    const idObjetivo = `obj-${estudoId}`;
    const idRespostaObjetivo = `r-obj-${estudoId}`;
    
    objetivoElement.id = idObjetivo;

    // Cria o container da anotação
    const anotacaoContainer = document.createElement("div");
    anotacaoContainer.className = "anotacao";
    
    // Cria o wrapper da IA
    const iaWrapper = document.createElement("div");
    iaWrapper.className = "ia-wrapper";
    
    // Cria a div de resposta da IA
    const respostaIADiv = document.createElement("div");
    respostaIADiv.className = "clickable";
    respostaIADiv.id = idRespostaObjetivo;
    respostaIADiv.contentEditable = "false";
    respostaIADiv.style.minHeight = "120px"; // Altura mínima
    respostaIADiv.style.maxHeight = "400px"; // Altura máxima
    respostaIADiv.style.overflowY = "auto";  // Scroll vertical
    
    // Cria o botão de gerar IA
    const btnGerarIA = document.createElement("button");
    btnGerarIA.textContent = "✨";
    btnGerarIA.title = "Gerar Visão Geral do Artigo";
    btnGerarIA.className = "btn-gerar-ia";
    
    // Monta a estrutura
    iaWrapper.appendChild(respostaIADiv);
    iaWrapper.appendChild(btnGerarIA);
    anotacaoContainer.appendChild(iaWrapper);
    
    // Insere apenas o container da anotação após o elemento objetivo
    objetivoElement.parentNode.insertBefore(anotacaoContainer, objetivoElement.nextSibling);
    
    // Carrega dados do cache se disponível
    if (window.CacheAnotacao) {
      respostaIADiv.innerHTML = window.CacheAnotacao.carregar(idRespostaObjetivo) || 
        '<span style="color: #9ca3af;">Clique no ícone ✨ para gerar uma visão geral completa do artigo.</span>';
    }

    // Configura o evento do botão da IA
    btnGerarIA.onclick = () => gerarRespostaIA_Objetivo(idObjetivo, iaWrapper, idRespostaObjetivo);

    // Torna o objetivo clicável
    objetivoElement.style.cursor = "pointer";
    objetivoElement.addEventListener('click', (e) => {
      // Não abre se clicou no botão da IA
      if (!e.target.closest('.btn-gerar-ia, a')) {
        anotacaoContainer.classList.toggle("ativa");
        e.preventDefault();
      }
    });
  }
  // ========== FIM DA ADIÇÃO OBJETIVO ==========
}

// Volta a rodar quando o DOM está pronto, sem esperar sinal
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initClickable);
} else {
    initClickable();
}