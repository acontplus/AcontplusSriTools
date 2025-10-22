// Servicios de UI para el popup de Acontplus SRI Tools v1.4.2
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

  /**
   * Centralized button state management for operations
   * @param {boolean} enabled - Whether buttons should be enabled or disabled
   * @param {string[]} buttonSelectors - Array of CSS selectors for buttons to affect
   * @param {Object} options - Additional options
   * @param {boolean} options.onlySelectionDependent - Only affect buttons that depend on selection
   */
  static setButtonsState(enabled, buttonSelectors = [], options = {}) {
    const { onlySelectionDependent = false } = options;

    // Buttons that are always disabled during operations (scan/download)
    const operationButtons = [
      '#start-process', // Scan button
    ];

    // Buttons that depend on selection
    const selectionDependentButtons = [
      '#download-btn', // Download button
      '[data-action="export_excel"]', // Export Excel
      '[data-action="verificar_descargas"]' // Verify downloads
    ];

    let targetSelectors = [];
    
    if (onlySelectionDependent) {
      targetSelectors = selectionDependentButtons;
    } else {
      targetSelectors = [...operationButtons, ...selectionDependentButtons, ...buttonSelectors];
    }

    targetSelectors.forEach(selector => {
      const buttons = document.querySelectorAll(selector);
      buttons.forEach(button => {
        if (enabled) {
          // Enable button
          button.disabled = false;
          button.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
          button.removeAttribute('disabled');
        } else {
          // Disable button
          button.disabled = true;
          button.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
          button.setAttribute('disabled', 'true');
        }
      });
    });
  }

  /**
   * Convenience method to disable buttons during operations
   * @param {string[]} additionalSelectors - Additional button selectors to disable
   */
  static disableButtonsForOperation(additionalSelectors = []) {
    this.setButtonsState(false, additionalSelectors);
  }

  /**
   * Convenience method to enable buttons after operations
   * @param {boolean} hasSelections - Whether there are selected items (for selection-dependent buttons)
   */
  static enableButtonsAfterOperation(hasSelections = false) {
    // Always enable operation buttons (like scan)
    const operationButtons = ['#start-process'];
    operationButtons.forEach(selector => {
      const buttons = document.querySelectorAll(selector);
      buttons.forEach(button => {
        button.disabled = false;
        button.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
        button.removeAttribute('disabled');
      });
    });

    // Enable selection-dependent buttons only if there are selections
    const selectionButtons = ['#download-btn', '[data-action="export_excel"]', '[data-action="verificar_descargas"]'];
    selectionButtons.forEach(selector => {
      const buttons = document.querySelectorAll(selector);
      buttons.forEach(button => {
        if (hasSelections) {
          button.disabled = false;
          button.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
          button.removeAttribute('disabled');
        } else {
          button.disabled = true;
          button.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
          button.setAttribute('disabled', 'true');
        }
      });
    });
  }

  /**
   * Update selection-dependent buttons based on current selection state
   * @param {boolean} hasSelections - Whether there are selected items
   */
  static updateSelectionDependentButtons(hasSelections) {
    // Update main Download button with specific CSS handling
    const downloadBtn = document.getElementById('download-btn');
    if (downloadBtn) {
      if (hasSelections) {
        downloadBtn.disabled = false;
        downloadBtn.removeAttribute('disabled');
        downloadBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
      } else {
        downloadBtn.disabled = true;
        downloadBtn.setAttribute('disabled', 'true');
        downloadBtn.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
      }
    }

    // Update Exportar en Excel button
    const exportExcelBtn = document.querySelector('[data-action="export_excel"]');
    if (exportExcelBtn) {
      if (hasSelections) {
        exportExcelBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
        exportExcelBtn.removeAttribute('disabled');
      } else {
        exportExcelBtn.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
        exportExcelBtn.setAttribute('disabled', 'true');
      }
    }

    // Update Verificar Descargas button
    const verificarDescargasBtn = document.querySelector('[data-action="verificar_descargas"]');
    if (verificarDescargasBtn) {
      if (hasSelections) {
        verificarDescargasBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
        verificarDescargasBtn.removeAttribute('disabled');
      } else {
        verificarDescargasBtn.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
        verificarDescargasBtn.setAttribute('disabled', 'true');
      }
    }
  }
}

// Exportar para uso global
window.PopupUI = PopupUI;