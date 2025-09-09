// ============================================
// Text Processor Module - Pipeline de Processamento
// ============================================

const TextProcessor = {
  
  // Pipeline principal de processamento
  process(texto) {
    if (!texto || !texto.trim()) {
      throw new Error('Texto vazio ou inválido');
    }

    // Debug: mostra o texto recebido
    console.log('Texto recebido para processar:', texto.substring(0, 200) + '...');
    
    // Etapa 1: Remover índice
    const textoAposEtapa1 = this.removerIndice(texto);
    console.log('Após remover índice:', textoAposEtapa1.substring(0, 200) + '...');
    
    // Etapa 2: Formatar nome do livro
    const textoAposEtapa2 = this.formatarNomeDoLivro(textoAposEtapa1);
    console.log('Após formatar nome:', textoAposEtapa2.substring(0, 200) + '...');
    
    // Etapa 3: Converter para JSON
    const resultado = this.converterTextoParaJson(textoAposEtapa2);
    
    return resultado;
  },

  // Etapa 1: Remove o índice do início do livro
  removerIndice(texto) {
    const marcador = 'Conteúdo do livro';
    const posMarcador = texto.indexOf(marcador);
    
    if (posMarcador === -1) {
      console.log('Marcador "Conteúdo do livro" não encontrado, retornando texto original');
      return texto;
    }

    // Procura pelo primeiro capítulo após o índice
    const regexInicioTexto = /(^Capítulo\s+\d+[\s\r\n]+^\s*\d+\s)/m;
    const match = texto.match(regexInicioTexto);
    
    if (!match) {
      console.log('Padrão de início de capítulo não encontrado');
      // Tenta um padrão mais flexível
      const regexAlternativo = /Capítulo\s+1\s/i;
      const matchAlt = texto.match(regexAlternativo);
      if (matchAlt) {
        const posInicioTexto = matchAlt.index;
        const cabecalho = texto.substring(0, posMarcador);
        const corpo = texto.substring(posInicioTexto);
        return (cabecalho + '\n\n' + corpo).replace(/\n{3,}/g, '\n\n').trim();
      }
      return texto;
    }

    const posInicioTexto = match.index;
    const cabecalho = texto.substring(0, posMarcador);
    const corpo = texto.substring(posInicioTexto);
    
    return (cabecalho + '\n\n' + corpo).replace(/\n{3,}/g, '\n\n').trim();
  },

  // Etapa 2: Formata o nome do livro no padrão esperado
  formatarNomeDoLivro(texto) {
    // Procura por *WTS5; seguido do nome do livro
    const regex = /^\*?WTS5;[\s\r\n]*([^\r\n]+)/;
    const match = texto.match(regex);
    
    if (!match) {
      console.log('Padrão WTS5 não encontrado');
      // Tenta extrair o nome do livro de outras formas
      const linhas = texto.split('\n');
      const primeiraLinha = linhas[0].trim();
      
      // Se a primeira linha parece ser o nome do livro
      if (primeiraLinha && !primeiraLinha.includes('Capítulo')) {
        const restoDoTexto = linhas.slice(1).join('\n');
        return `nome do livro: ${primeiraLinha}\n${restoDoTexto}`;
      }
      
      return texto;
    }

    // Extrai o nome do livro e limpa
    let nomeDoLivro = match[1].trim();
    
    // Remove possíveis artefatos do RTF (como Latha;Arial;Arial;)
    nomeDoLivro = nomeDoLivro.replace(/^[^;]+;[^;]+;[^;]+;/, '').trim();
    
    // Remove caracteres especiais e normaliza
    nomeDoLivro = nomeDoLivro
      .replace(/[^\w\s\u00C0-\u00FFÀ-ÿ]/g, '') // Mantém letras, números, espaços e acentos
      .trim();
    
    // Remove o cabeçalho WTS5 do texto
    const restoDoTexto = texto.replace(regex, '').trim();
    
    return `nome do livro: ${nomeDoLivro}\n${restoDoTexto}`;
  },

  // Etapa 3: Converte o texto formatado para JSON estruturado
  converterTextoParaJson(texto) {
    const linhas = texto.split('\n');
    
    // Procura pelo nome do livro
    const nomeLivroMatch = linhas[0].match(/nome do livro:\s*(.+)/i);
    if (!nomeLivroMatch) {
      throw new Error("Formato inválido. Esperado: 'nome do livro: [Nome]'");
    }

    const resultado = {
      nome_do_livro: nomeLivroMatch[1].trim(),
      capitulos: []
    };
    
    // Divide o texto em capítulos
    const textoSemNome = linhas.slice(1).join('\n');
    const blocosCapitulos = textoSemNome.split(/Capítulo\s+/i).filter(b => b.trim());
    
    console.log(`Encontrados ${blocosCapitulos.length} capítulos`);

    for (const bloco of blocosCapitulos) {
      const linhasCapitulo = bloco.trim().split('\n');
      
      // Extrai o número do capítulo
      const primeiraLinha = linhasCapitulo[0];
      const numCapituloMatch = primeiraLinha.match(/^(\d+)/);
      
      if (!numCapituloMatch) {
        console.log('Capítulo sem número, pulando:', primeiraLinha);
        continue;
      }
      
      const numCapitulo = parseInt(numCapituloMatch[1], 10);
      
      const capituloAtual = {
        capitulo: numCapitulo,
        versiculos: []
      };

      // Junta o conteúdo do capítulo (remove a primeira linha que é o número)
      const conteudoCapitulo = linhasCapitulo.slice(1).join('\n').trim();
      
      // Processa versículos com lógica stateful
      this.processarVersiculos(conteudoCapitulo, capituloAtual);
      
      if (capituloAtual.versiculos.length > 0) {
        resultado.capitulos.push(capituloAtual);
      }
    }
    
    return resultado;
  },

  // Processa os versículos de um capítulo
  processarVersiculos(conteudoCapitulo, capituloAtual) {
    if (!conteudoCapitulo) return;
    
    let expectedVerse = 1;
    let lastRealVerseObject = null;
    
    // Divide em parágrafos
    const paragrafos = conteudoCapitulo.split(/\n\s*\n/);
    
    for (const paragrafo of paragrafos) {
      if (!paragrafo.trim()) continue;
      
      let isFirstVerseInParagraph = true;
      
      // Regex para encontrar versículos (número seguido de espaço não-quebrável ou espaço normal)
      // Aceita tanto \u00A0 quanto espaço normal
      const regexVersiculos = /(\d+)[\s\u00A0]+([\s\S]*?)(?=\d+[\s\u00A0]+|$)/g;
      const versiculosEncontrados = [...paragrafo.matchAll(regexVersiculos)];
      
      // Se não encontrou com o padrão acima, tenta padrões alternativos
      if (versiculosEncontrados.length === 0) {
        // Tenta encontrar apenas números no início de linhas
        const linhas = paragrafo.split('\n');
        for (const linha of linhas) {
          const matchInicio = linha.match(/^(\d+)\s+(.+)/);
          if (matchInicio) {
            const currentVerseNum = parseInt(matchInicio[1], 10);
            const currentVerseText = matchInicio[2].trim();
            
            if (currentVerseNum === expectedVerse) {
              const newVerse = {
                verso: currentVerseNum,
                texto: currentVerseText,
                novo_paragrafo: isFirstVerseInParagraph
              };
              capituloAtual.versiculos.push(newVerse);
              lastRealVerseObject = newVerse;
              expectedVerse++;
              isFirstVerseInParagraph = false;
            } else if (lastRealVerseObject) {
              // É continuação do verso anterior
              lastRealVerseObject.texto += ' ' + linha.trim();
            }
          } else if (lastRealVerseObject && linha.trim()) {
            // Linha sem número, adiciona ao verso anterior
            lastRealVerseObject.texto += ' ' + linha.trim();
          }
        }
      } else {
        // Processa versículos encontrados com o regex principal
        for (const match of versiculosEncontrados) {
          const currentVerseNum = parseInt(match[1], 10);
          const currentVerseText = match[2].trim().replace(/\s+/g, ' ');

          if (currentVerseNum === expectedVerse) {
            const newVerse = {
              verso: currentVerseNum,
              texto: currentVerseText,
              novo_paragrafo: isFirstVerseInParagraph
            };
            capituloAtual.versiculos.push(newVerse);
            lastRealVerseObject = newVerse;
            expectedVerse++;
            isFirstVerseInParagraph = false;
          } else {
            // Se não for o verso esperado, é continuação do texto anterior
            if (lastRealVerseObject) {
              lastRealVerseObject.texto += ' ' + match[0].trim();
            }
          }
        }
      }
    }
  }
};

// Export para uso em outros módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TextProcessor;
}