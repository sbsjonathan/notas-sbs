// ============================================
// Main Controller - Gerencia UI e coordena módulos
// ============================================

(function() {
  'use strict';

  // --- Elementos DOM ---
  const elements = {
    fileInput: document.getElementById('file'),
    inputArea: document.getElementById('inputArea'),
    outputArea: document.getElementById('outputArea'),
    processBtn: document.getElementById('processBtn'),
    copyTextBtn: document.getElementById('copyTextBtn'),
    copyJsonBtn: document.getElementById('copyJsonBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    statusText: document.getElementById('statusText')
  };

  // --- Estado da Aplicação ---
  const appState = {
    currentJsonData: null,
    currentFileName: '',
    isProcessing: false
  };

  // ============================================
  // INICIALIZAÇÃO
  // ============================================

  function init() {
    setupEventListeners();
    updateStatus('Aguardando arquivo RTF...', 'info');
    
    // Verifica se os módulos estão carregados
    if (typeof RTFParser === 'undefined') {
      console.error('RTFParser não encontrado. Certifique-se de incluir rtf-parser.js');
    }
    if (typeof TextProcessor === 'undefined') {
      console.error('TextProcessor não encontrado. Certifique-se de incluir text-processor.js');
    }
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================

  function setupEventListeners() {
    // Input de arquivo
    elements.fileInput.addEventListener('change', handleFileSelect);
    
    // Botões
    elements.processBtn.addEventListener('click', processText);
    elements.copyTextBtn.addEventListener('click', () => copyToClipboard(elements.inputArea.value, 'Texto copiado!'));
    elements.copyJsonBtn.addEventListener('click', () => copyToClipboard(elements.outputArea.value, 'JSON copiado!'));
    elements.downloadBtn.addEventListener('click', downloadJson);
    
    // Monitora mudanças nos textareas
    elements.inputArea.addEventListener('input', handleInputChange);
    elements.outputArea.addEventListener('input', handleOutputChange);
    
    // Atalhos de teclado
    document.addEventListener('keydown', handleKeyboardShortcuts);
  }

  function handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + Enter para processar
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (!elements.processBtn.disabled) {
        processText();
      }
    }
    
    // Ctrl/Cmd + S para baixar JSON
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      if (!elements.downloadBtn.disabled) {
        e.preventDefault();
        downloadJson();
      }
    }
  }

  function handleInputChange() {
    const hasText = elements.inputArea.value.trim().length > 0;
    elements.processBtn.disabled = !hasText || appState.isProcessing;
    elements.copyTextBtn.disabled = !hasText;
    
    if (hasText) {
      updateStatus('Texto pronto para processar', 'info');
    }
  }

  function handleOutputChange() {
    const hasContent = elements.outputArea.value.trim().length > 0;
    elements.copyJsonBtn.disabled = !hasContent;
    elements.downloadBtn.disabled = !hasContent;
    
    // Tenta atualizar currentJsonData se for JSON válido
    if (hasContent) {
      try {
        appState.currentJsonData = JSON.parse(elements.outputArea.value);
        updateStatus('JSON válido', 'success');
      } catch (e) {
        updateStatus('JSON inválido', 'warning');
      }
    }
  }

  // ============================================
  // LEITURA DE ARQUIVO RTF
  // ============================================

  function handleFileSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    // Valida tipo de arquivo
    if (!file.name.toLowerCase().endsWith('.rtf')) {
      showToast('Por favor, selecione um arquivo .rtf', 'error');
      return;
    }

    appState.currentFileName = file.name.replace(/\.rtf$/i, '');
    updateStatus('Lendo arquivo...', 'info');

    const reader = new FileReader();
    
    // Tenta diferentes encodings
    const encoding = detectEncoding(file.name);
    reader.readAsText(file, encoding);

    reader.onload = function() {
      try {
        const rtfContent = String(reader.result || '');
        console.log('Arquivo RTF lido, tamanho:', rtfContent.length);
        console.log('Primeiros caracteres:', rtfContent.substring(0, 100));
        
        // Usa o parser RTF
        const extractedText = RTFParser.parse(rtfContent);
        
        if (extractedText) {
          elements.inputArea.value = extractedText;
          elements.inputArea.scrollTop = 0;
          handleInputChange();
          updateStatus('Arquivo carregado com sucesso!', 'success');
          showToast('RTF carregado! Clique em "Processar" para converter.', 'success');
        } else {
          throw new Error('Não foi possível extrair texto do RTF');
        }
      } catch (error) {
        console.error('Erro ao processar RTF:', error);
        updateStatus('Erro ao processar arquivo RTF', 'error');
        showToast('Erro ao ler arquivo RTF', 'error');
        
        // Tenta método alternativo
        reader.readAsText(file, 'utf-8');
      }
    };

    reader.onerror = function() {
      updateStatus('Erro ao ler o arquivo', 'error');
      showToast('Não foi possível ler o arquivo', 'error');
    };
  }

  function detectEncoding(filename) {
    // Tenta detectar o encoding baseado no nome ou conteúdo
    // Por padrão, usa Windows-1252 para RTFs
    return 'windows-1252';
  }

  // ============================================
  // PROCESSAMENTO DE TEXTO
  // ============================================

  function processText() {
    const textoOriginal = elements.inputArea.value.trim();
    
    if (!textoOriginal) {
      showToast('Não há texto para processar', 'error');
      return;
    }

    if (appState.isProcessing) {
      showToast('Processamento em andamento...', 'info');
      return;
    }

    appState.isProcessing = true;
    elements.processBtn.disabled = true;
    updateStatus('Processando texto...', 'info');

    // Usa setTimeout para não bloquear a UI
    setTimeout(() => {
      try {
        // Usa o processador de texto
        appState.currentJsonData = TextProcessor.process(textoOriginal);
        
        // Exibe JSON formatado
        elements.outputArea.value = JSON.stringify(appState.currentJsonData, null, 2);
        elements.outputArea.scrollTop = 0;
        
        // Atualiza UI
        handleOutputChange();
        updateStatus('Processamento concluído com sucesso!', 'success');
        showToast('Texto convertido para JSON!', 'success');
        
        // Log para debug
        console.log('JSON gerado:', appState.currentJsonData);
        console.log(`Total de capítulos: ${appState.currentJsonData.capitulos.length}`);
        
      } catch (error) {
        console.error('Erro no processamento:', error);
        elements.outputArea.value = `Erro ao processar: ${error.message}\n\nVerifique o formato do texto de entrada.`;
        updateStatus('Erro no processamento', 'error');
        showToast(error.message || 'Erro ao processar o texto', 'error');
      } finally {
        appState.isProcessing = false;
        elements.processBtn.disabled = false;
      }
    }, 100);
  }

  // ============================================
  // FUNÇÕES UTILITÁRIAS
  // ============================================

  function copyToClipboard(text, successMessage) {
    if (!text || !text.trim()) {
      showToast('Nada para copiar', 'error');
      return;
    }

    // Tenta usar a API moderna
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => showToast(successMessage, 'success'))
        .catch(() => fallbackCopy(text, successMessage));
    } else {
      fallbackCopy(text, successMessage);
    }
  }

  function fallbackCopy(text, successMessage) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    
    try {
      textarea.select();
      textarea.setSelectionRange(0, text.length);
      const success = document.execCommand('copy');
      showToast(success ? successMessage : 'Erro ao copiar', success ? 'success' : 'error');
    } catch (err) {
      showToast('Erro ao copiar', 'error');
    } finally {
      document.body.removeChild(textarea);
    }
  }

  // ===== ÚNICA ALTERAÇÃO: fluxo de download/export no iOS =====
  function downloadJson() {
    if (!appState.currentJsonData) {
      showToast('Não há JSON para baixar', 'error');
      return;
    }

    try {
      // Extrai e limpa o nome do livro
      const nomeDoLivro = appState.currentJsonData.nome_do_livro || appState.currentFileName || 'documento';
      const nomeArquivoBase = sanitizeFilename(nomeDoLivro);
      const nomeArquivo = `${nomeArquivoBase}.json`;

      const jsonString = JSON.stringify(appState.currentJsonData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });

      // iOS primeiro: Share Sheet com arquivo
      const podeCompartilharArquivo = (() => {
        try {
          if (!navigator.share || !navigator.canShare) return false;
          const testeFile = new File([blob], nomeArquivo, { type: 'application/json' });
          return navigator.canShare({ files: [testeFile] });
        } catch (_) {
          return false;
        }
      })();

      if (podeCompartilharArquivo) {
        const file = new File([blob], nomeArquivo, { type: 'application/json' });
        navigator.share({ files: [file], title: nomeArquivo, text: 'JSON exportado' })
          .then(() => {
            showToast(`Arquivo "${nomeArquivo}" exportado`, 'success');
            updateStatus(`Exportado via Compartilhar: ${nomeArquivo}`, 'success');
          })
          .catch(() => {
            // Se usuário cancelar ou der erro, cair para download/aba nova
            fallbackDownload(blob, nomeArquivo);
          });
        return;
      }

      // Fallback: <a download> ou abrir em nova aba (Safari antigo)
      fallbackDownload(blob, nomeArquivo);

    } catch (err) {
      console.error('Erro ao baixar arquivo:', err);
      showToast('Erro ao exportar o arquivo', 'error');
    }
  }

  // Helper de fallback para navegadores que não respeitam download
  function fallbackDownload(blob, nomeArquivo) {
    const url = URL.createObjectURL(blob);

    // Tenta <a download>
    if ('download' in HTMLAnchorElement.prototype) {
      const link = document.createElement('a');
      link.href = url;
      link.download = nomeArquivo;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);

      showToast(`Arquivo "${nomeArquivo}" baixado!`, 'success');
      updateStatus(`Download concluído: ${nomeArquivo}`, 'success');
    } else {
      // Safari/iOS antigo: abrir em nova aba e usar Compartilhar → Salvar em Arquivos
      window.open(url, '_blank');
      showToast('Abrindo o JSON — use “Compartilhar” → “Salvar em Arquivos”.', 'info');
      updateStatus('Aguardando ação do usuário no iOS', 'info');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  }

  function sanitizeFilename(name) {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9]/g, '_')      // Substitui caracteres especiais
      .replace(/_+/g, '_')              // Remove underscores múltiplos
      .replace(/^_|_$/g, '')            // Remove underscores no início e fim
      .substring(0, 100);               // Limita o tamanho
  }

  // ============================================
  // UI FEEDBACK
  // ============================================

  function updateStatus(message, type = 'info') {
    elements.statusText.textContent = message;
    
    const colors = {
      success: 'var(--success)',
      error: 'var(--danger)',
      warning: 'var(--warning)',
      info: 'var(--info)',
      default: 'var(--muted)'
    };
    
    elements.statusText.style.color = colors[type] || colors.default;
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) {
      console.warn('Toast container não encontrado');
      return;
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Anima entrada
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });
    
    // Remove após 3 segundos
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ============================================
  // INICIALIZA A APLICAÇÃO
  // ============================================

  // Aguarda o DOM carregar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();