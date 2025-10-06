// Servicio de gestión de datos para el popup de Acontplus SRI Tools v1.4.1
// Manejo del estado de facturas y comunicación con background

class DataManager {
  constructor(manager) {
    this.manager = manager;
    this.facturas = [];
    this.selectedFacturas = new Set();
    this.paginationInfo = { current: 1, total: 1 };
  }

  loadStoredData() {
    chrome.storage.local.get(['facturasData', 'lastExtraction', 'lastVerification']).then(result => {
      if (result.facturasData && result.facturasData.length > 0) {
        this.facturas = result.facturasData;
        this.manager.facturas = this.facturas; // SINCRONIZAR con manager principal
        this.manager.updateDisplay();

        if (result.lastExtraction) {
          const extractionDate = new Date(result.lastExtraction);
          const extractionTimestamp = document.getElementById('extraction-timestamp');
          if (extractionTimestamp) PopupUI.safeSetText(extractionTimestamp, PopupUI.formatTimestamp(extractionDate));
        }

        if (result.lastVerification && (Date.now() - result.lastVerification.timestamp < 10000)) {
            this.handleVerificationComplete(result.lastVerification.foundIds, result.lastVerification.total);
            chrome.storage.local.remove('lastVerification');
        }

        console.log('✅ Datos cargados del almacenamiento:', this.facturas.length, 'documentos');
      } else {
        this.manager.updateDisplay();
      }
    });
  }

  handleVerificationComplete(foundIds, total) {
    const foundSet = new Set(foundIds);
    
    // Actualizar el estado de verificación en cada factura
    this.facturas.forEach(factura => {
        factura.verificado = foundSet.has(factura.id);
    });
    
    // Sincronizar con el manager principal
    this.manager.facturas = this.facturas;
    
    // Forzar re-renderizado completo de la tabla
    this.manager.renderTable();
    
    console.log('✅ Verificación completada:', {
      encontrados: foundIds.length,
      total: total,
      faltantes: total - foundIds.length
    });
  }

  updateSelectionCount() {
    this.manager.updateCounts();

    if (this.manager.exportBtn) {
      this.manager.exportBtn.disabled = this.selectedFacturas.size === 0;
    }
    if (this.manager.downloadBtn) {
      this.manager.downloadBtn.disabled = this.selectedFacturas.size === 0;
    }
    if (this.manager.verifyBtn) {
      this.manager.verifyBtn.disabled = false; // Always enabled
    }

    const masterCheckbox = document.getElementById('select-all');
    if (masterCheckbox) {
      masterCheckbox.checked = this.selectedFacturas.size === this.facturas.length && this.facturas.length > 0;
      masterCheckbox.indeterminate = this.selectedFacturas.size > 0 && this.selectedFacturas.size < this.facturas.length;
    }
  }

  toggleSelectAll() {
    const masterCheckbox = document.getElementById('select-all');
    const shouldSelectAll = masterCheckbox ? masterCheckbox.checked : this.selectedFacturas.size === 0;

    if (shouldSelectAll) {
      this.facturas.forEach(factura => this.selectedFacturas.add(factura.id));
    } else {
      this.selectedFacturas.clear();
    }

    this.manager.renderTable();
    this.updateSelectionCount();
  }

  handleRowSelection(checkbox) {
    const facturaId = checkbox.closest('tr').dataset.id;

    if (checkbox.checked) {
      this.selectedFacturas.add(facturaId);
      checkbox.closest('tr').classList.add('selected');
    } else {
      this.selectedFacturas.delete(facturaId);
      checkbox.closest('tr').classList.remove('selected');
    }

    this.updateSelectionCount();
  }

  seleccionarFaltantes() {
    if (!this.manager.tbodyEl) {
        this.manager.showNotification('No hay documentos en la tabla para seleccionar.', 'warning');
        return;
    }

    const rows = this.manager.tbodyEl.querySelectorAll('tr');
    let seleccionados = 0;

    rows.forEach(row => {
        const verificadoCell = row.querySelector('.verificado-col');
        const checkbox = row.querySelector('input[type="checkbox"]');

        if (verificadoCell && checkbox && verificadoCell.innerHTML.trim() === '') {
            const facturaId = row.dataset.id;
            if (facturaId && !this.selectedFacturas.has(facturaId)) {
                this.selectedFacturas.add(facturaId);
                checkbox.checked = true;
                row.classList.add('selected');
                seleccionados++;
            }
        }
    });

    this.updateSelectionCount();

    if (seleccionados > 0) {
        this.manager.showNotification(`${seleccionados} documentos faltantes han sido seleccionados.`, 'info');
    } else {
        this.manager.showNotification('No se encontraron documentos faltantes para seleccionar.', 'info');
    }
  }

  handleSearchComplete(progress) {
    console.log('✅ Búsqueda completa finalizada:', progress);

    this.facturas = progress.allDocuments || [];
    this.manager.facturas = this.facturas; // SINCRONIZAR con manager principal
    this.paginationInfo = progress.paginationInfo || { current: progress.totalPages || 1, total: progress.totalPages || 1 };

    console.log('📦 Datos sincronizados:', {
      dataManagerFacturas: this.facturas.length,
      managerFacturas: this.manager.facturas.length,
      primerosDocumentos: this.facturas.slice(0, 2)
    });

    this.manager.updateDisplay();
    this.selectedFacturas.clear();
    this.updateSelectionCount();

    const totalDocuments = this.facturas.length;
    const totalPages = this.paginationInfo.total;
    const optimization = progress.optimization;

    let message = '✅ Búsqueda completada: ' + totalDocuments + ' documentos encontrados';
    if (totalPages > 1) {
      message += ' en ' + totalPages + ' página(s)';
    }
    if (optimization && optimization.optimized) {
      message += ' (Optimización aplicada)';
    }

    this.manager.showNotification(message, 'success');

    if (this.manager.newSearchBtn) {
      this.manager.newSearchBtn.disabled = false;
      PopupUI.safeSetHTML(this.manager.newSearchBtn, '<span class="btn-text">Buscar</span>');
    }

    if (totalDocuments > 0) {
      PopupUI.showState({
        loading: this.manager.loadingEl,
        table: this.manager.tableContainerEl,
        'no-data': this.manager.noDataEl
      }, 'table');
      console.log('📊 Mostrando ' + totalDocuments + ' documentos en tabla');
    } else {
      PopupUI.showState({
        loading: this.manager.loadingEl,
        table: this.manager.tableContainerEl,
        'no-data': this.manager.noDataEl
      }, 'no-data');
      console.log('📭 No se encontraron documentos');
    }

    console.log('📈 Resumen final:', {
      documentos: totalDocuments,
      páginas: totalPages,
      optimización: optimization?.optimized || false
    });
  }
}

// Exportar para uso global
window.DataManager = DataManager;