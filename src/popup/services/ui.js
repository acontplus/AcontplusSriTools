// Servicios de UI para el popup de Acontplus SRI Tools v1.4.1
// Utilidades para manipulación segura del DOM

class PopupUI {
  static safeGetElement(id) {
    const element = document.getElementById(id);
    if (!element) {
      console.warn('Elemento no encontrado: ' + id);
      return null;
    }
    return element;
  }

  static safeSetText(element, text) {
    if (element && element.textContent !== undefined) {
      element.textContent = text;
    } else {
      console.warn('No se pudo establecer texto en elemento:', element);
    }
  }

  static safeSetHTML(element, html) {
    if (element && element.innerHTML !== undefined) {
      element.innerHTML = html;
    } else {
      console.warn('No se pudo establecer HTML en elemento:', element);
    }
  }

  static showState(states, state) {
    const stateElements = {
      loading: states.loading,
      table: states.table,
      'no-data': states['no-data']
    };

    Object.values(stateElements).forEach(el => {
      if (el) el.style.display = 'none';
    });

    if (stateElements[state]) {
      stateElements[state].style.display = state === 'table' ? 'flex' : 'block';
    } else {
      console.error('❌ Estado no encontrado:', state);
    }
  }

  static formatTimestamp(date) {
    return date.toLocaleString('es-EC', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  static initializeBrandIdentity(version) {
    document.title = 'Acontplus SRI Tools v' + version;

    const versionElements = document.querySelectorAll('.version-number, .tagline');
    versionElements.forEach(el => {
      if (el.textContent.includes('v1.')) {
        this.safeSetText(el, el.textContent.replace(/v1\.\d+\.\d+.*/, 'v' + version));
      }
    });

    const extractionTimestamp = document.getElementById('extraction-timestamp');
    if (extractionTimestamp) {
      this.safeSetText(extractionTimestamp, this.formatTimestamp(new Date()));
    }
  }
}

// Exportar para uso global
window.PopupUI = PopupUI;