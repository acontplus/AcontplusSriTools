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

  /**
   * Centralized button state management for operations
   * @param {boolean} enabled - Whether buttons should be enabled or disabled
   * @param {string[]} buttonSelectors - Array of CSS selectors for buttons to affect
   * @param {Object} options - Additional options
   * @param {boolean} options.onlySelectionDependent - Only affect buttons that depend on selection
   */
  static setButtonsState(enabled, buttonSelectors = [], options = {}) {
    const { onlySelectionDependent = false } = options;

    // Default buttons that are always managed
    const defaultSelectors = [
      '#start-process', // Scan button
      '#download-btn', // Download button
    ];

    // Combine with provided selectors
    const allSelectors = [...new Set([...defaultSelectors, ...buttonSelectors])];

    allSelectors.forEach(selector => {
      const buttons = document.querySelectorAll(selector);
      buttons.forEach(button => {
        if (enabled) {
          // Enable button
          button.disabled = false;
          button.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
          button.removeAttribute('disabled');

          // For popover buttons, also check if they should be enabled based on selection
          if (onlySelectionDependent && (selector === '[data-action="export_excel"]' || selector === '[data-action="verificar_descargas"]')) {
            // This will be handled by updatePopoverButtonStates
            return;
          }
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
   * @param {boolean} onlySelectionDependent - Only enable buttons that depend on selection state
   */
  static enableButtonsAfterOperation(onlySelectionDependent = false) {
    this.setButtonsState(true, [], { onlySelectionDependent });
  }

  /**
   * Update selection-dependent buttons based on current selection state
   * @param {boolean} hasSelections - Whether there are selected items
   */
  static updateSelectionDependentButtons(hasSelections) {
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