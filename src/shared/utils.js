// Utilidades compartidas para Acontplus SRI Tools v1.4.1
// Funciones de ayuda comunes

class SRIUtils {
  static extraerTextoCelda(celda) {
    return celda ? (celda.textContent || '').trim() : '';
  }

  static extraerNumeroCelda(celda) {
    if (!celda || !celda.textContent) return 0;
    const numero = parseFloat(celda.textContent.trim().replace(/[^\d.-]/g, '').replace(',', '.'));
    return isNaN(numero) ? 0 : Math.abs(numero);
  }

  static separarRucRazonSocial(texto) {
    if (!texto) return ['', ''];
    const lineas = texto.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0);
    if (lineas.length >= 2 && /^\d{10,13}$/.test(lineas[0])) return [lineas[0], lineas.slice(1).join(' ').trim()];
    const match = texto.match(/(\d{10,13})\s+(.+)/);
    if (match) return [match[1].trim(), match[2].trim()];
    const rucMatch = texto.match(/\d{10,13}/);
    if (rucMatch) return [rucMatch[0], texto.replace(rucMatch[0], '').trim()];
    return ['', texto.trim()];
  }

  static separarTipoSerie(texto) {
    if (!texto) return ['', '', ''];
    const match = texto.match(/([^0-9]+)\s*(\d{1,3}-\d{1,3}-\d+)/);
    if (match) {
      const partes = match[2].split('-');
      if (partes.length >= 3) return [match[1].trim(), `${partes[0]}-${partes[1]}`, partes.slice(2).join('')];
    }
    return [texto.trim(), '', ''];
  }

  static formatearFecha(fechaTexto) {
    if (!fechaTexto) return '';
    const match = fechaTexto.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
    return fechaTexto;
  }

  static formatearFechaHora(fechaTexto) {
    if (!fechaTexto) return '';
    const match = fechaTexto.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/);
    if (match) {
        return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')} ${match[4].padStart(2, '0')}:${match[5].padStart(2, '0')}:${match[6].padStart(2, '0')}`;
    }
    return this.formatearFecha(fechaTexto);
  }

  static esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Exportar para uso en otros módulos
window.SRIUtils = SRIUtils;