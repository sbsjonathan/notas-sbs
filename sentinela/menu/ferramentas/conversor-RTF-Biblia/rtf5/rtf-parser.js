// ============================================
// RTF Parser Module
// ============================================

const RTFParser = {
  // Converte RTF para texto plano preservando quebras de linha
  parse(rtf) {
    if (!rtf || !rtf.trim()) return '';
    
    // Se não é RTF válido, retorna como texto plano
    if (!rtf.trim().startsWith('{\\rtf')) {
      return rtf;
    }
    
    // Usa a função completa de conversão RTF para HTML
    const html = this.rtfToHtml(rtf);
    
    // Converte o HTML para texto plano preservando quebras
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Preserva quebras de linha convertendo <br> e <p> em \n
    const brs = temp.getElementsByTagName('br');
    for (let i = brs.length - 1; i >= 0; i--) {
      brs[i].replaceWith('\n');
    }
    
    const ps = temp.getElementsByTagName('p');
    for (let i = 0; i < ps.length; i++) {
      ps[i].innerHTML = ps[i].innerHTML + '\n';
    }
    
    let text = temp.textContent || temp.innerText || '';
    
    // Limpa múltiplas quebras de linha consecutivas
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.replace(/^\n+|\n+$/g, ''); // Remove quebras no início e fim
    
    return text;
  },

  rtfToHtml(rtf) {
    if (!rtf || !rtf.trim()) return '';
    
    // Se não parece RTF, trata como texto plano
    if (!rtf.trim().startsWith('{\\rtf')) {
      return `<pre style="white-space:pre-wrap;">${this.escapeHtml(rtf)}</pre>`;
    }
    
    let i = 0, len = rtf.length;
    let paragraphs = [];
    let buf = '';
    let bold = false, italic = false, underline = false;
    let uc = 1;
    let skipNextChar = 0;

    const openTags = () => { 
      let s = ''; 
      if (bold) s += '<b>'; 
      if (italic) s += '<i>'; 
      if (underline) s += '<u>'; 
      return s; 
    };
    
    const closeTags = () => { 
      let s = ''; 
      if (underline) s += '</u>'; 
      if (italic) s += '</i>'; 
      if (bold) s += '</b>'; 
      return s; 
    };
    
    const pushParagraph = () => { 
      if (buf.trim() || buf.includes('\n')) { 
        // Preserva quebras de linha dentro do parágrafo
        const lines = buf.split('\n');
        const content = lines.join('<br>');
        paragraphs.push(`<p>${content}</p>`); 
      } 
      buf = ''; 
    };
    
    const stack = [];
    
    const pushState = () => { 
      stack.push({ bold, italic, underline, uc }); 
    };
    
    const popState = () => { 
      const s = stack.pop(); 
      if (!s) return; 
      bold = s.bold; 
      italic = s.italic; 
      underline = s.underline; 
      uc = s.uc; 
    };
    
    while (i < len) {
      if (skipNextChar > 0) {
        skipNextChar--;
        i++;
        continue;
      }
      
      const ch = rtf[i];
      
      if (ch === '{') {
        const look = rtf.slice(i + 1, i + 60);
        const m = look.match(/^\s*\\\*?([A-Za-z]+)/);
        if (m && this.shouldSkipGroup(m[1])) {
          let depth = 1; 
          i++;
          while (i < len && depth > 0) { 
            if (rtf[i] === '{') depth++; 
            else if (rtf[i] === '}') depth--; 
            i++; 
          }
          continue;
        }
        pushState(); 
        i++; 
        continue;
      }
      
      if (ch === '}') {
        buf += closeTags(); 
        popState(); 
        buf += openTags(); 
        i++; 
        continue;
      }
      
      if (ch === '\\') {
        i++; 
        const next = rtf[i];
        
        if (next === '\\' || next === '{' || next === '}') { 
          buf += this.escapeHtml(next); 
          i++; 
          continue; 
        }
        
        const wordMatch = rtf.slice(i).match(/^([A-Za-z]+)(-?\d+)?/);
        if (wordMatch) {
          const word = wordMatch[1]; 
          const numStr = wordMatch[2];
          i += word.length + (numStr ? numStr.length : 0);
          
          // Pula espaço após comando se existir
          if (rtf[i] === ' ') i++;
          
          switch (word) {
            case 'par': 
            case 'pard':
              // Quebra de parágrafo - preserva a quebra
              buf += closeTags(); 
              pushParagraph(); 
              buf += openTags(); 
              break;
            case 'line':
              // Quebra de linha simples
              buf += '\n'; 
              break;
            case 'tab': 
              buf += '&emsp;'; 
              break;
            case 'b': 
              buf += closeTags(); 
              bold = (numStr === undefined || numStr !== '0'); 
              buf += openTags(); 
              break;
            case 'i': 
              buf += closeTags(); 
              italic = (numStr === undefined || numStr !== '0'); 
              buf += openTags(); 
              break;
            case 'ul': 
              buf += closeTags(); 
              underline = (numStr === undefined || numStr !== '0'); 
              buf += openTags(); 
              break;
            case 'plain': 
              buf += closeTags(); 
              bold = false; 
              italic = false; 
              underline = false; 
              buf += openTags(); 
              break;
            case 'fs': 
              // Ignora tamanho de fonte
              break;
            case 'uc': 
              if (numStr) uc = Math.max(0, parseInt(numStr, 10)); 
              break;
            case 'u': 
              if (numStr) { 
                let code = parseInt(numStr, 10); 
                if (code < 0) code = 65536 + code; 
                buf += this.escapeHtml(String.fromCodePoint(code)); 
                // Pula os próximos caracteres de acordo com uc
                skipNextChar = uc;
              } 
              break;
            default: 
              break;
          }
          continue;
        }
        
        // Caracteres hexadecimais \'XX
        if (next === "'") {
          i++; 
          const hex = rtf.slice(i, i + 2);
          if (/^[0-9a-fA-F]{2}$/.test(hex)) {
            const code = parseInt(hex, 16);
            buf += this.escapeHtml(this.cp1252(code)); 
            i += 2;
          }
          continue;
        }
        continue;
      }
      
      // Caractere normal
      buf += this.escapeHtml(ch); 
      i++;
    }
    
    if (buf.trim() || buf.includes('\n')) pushParagraph();
    return paragraphs.join('');
  },

  shouldSkipGroup(name) {
    const n = (name || '').toLowerCase();
    const skipList = [
      'fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 
      'header', 'footer', 'object', 'filetbl', 'revtbl', 
      'generator', 'xmlopen', 'xmlclose', 'themedata', 'latentstyles',
      'colorschememapping', 'datastore', 'defchp', 'defpap',
      'factoidname', 'latentStyles', 'pgdsctbl', 'listoverridetable',
      'listtable', 'lsdlockedexcept', 'background', 'shp', 'sp'
    ];
    return skipList.includes(n);
  },

  // Codificação Windows-1252
  cp1252(byte) {
    const map = {
      128: '\u20AC', 130: '\u201A', 131: '\u0192', 132: '\u201E',
      133: '\u2026', 134: '\u2020', 135: '\u2021', 136: '\u02C6',
      137: '\u2030', 138: '\u0160', 139: '\u2039', 140: '\u0152',
      142: '\u017D', 145: '\u2018', 146: '\u2019', 147: '\u201C',
      148: '\u201D', 149: '\u2022', 150: '\u2013', 151: '\u2014',
      152: '\u02DC', 153: '\u2122', 154: '\u0161', 155: '\u203A',
      156: '\u0153', 158: '\u017E', 159: '\u0178'
    };
    if (byte in map) return map[byte];
    return String.fromCharCode(byte);
  },

  escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },

  // Método simplificado de fallback
  stripRtf(rtf) {
    return String(rtf || '')
      .replace(/\{\\(?:fonttbl|colortbl|stylesheet|info|pict)[\s\S]*?\}/gi, '')
      .replace(/\\'[0-9a-fA-F]{2}/g, s => { 
        const h = s.slice(2); 
        return this.cp1252(parseInt(h, 16)); 
      })
      .replace(/\\u(-?\d+)(?:\'?\w)?/g, (_, n) => { 
        let code = parseInt(n, 10); 
        if (code < 0) code = 65536 + code; 
        return String.fromCodePoint(code); 
      })
      .replace(/\\par\d?/g, '\n')
      .replace(/\\line/g, '\n')
      .replace(/\\tab/g, '\t')
      .replace(/\\[A-Za-z]+-?\d* ?/g, '')
      .replace(/[{}]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
};

// Export para uso em outros módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RTFParser;
}