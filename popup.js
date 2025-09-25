// Popup Script para Acontplus SRI Tools v1.4.1 - Final
// Búsqueda automática completa con interfaz optimizada y limpia

class FacturasManager {
  constructor() {
    this.version = '1.4.1-Final';
    this.facturas = [];
    this.selectedFacturas = new Set();
    this.paginationInfo = { current: 1, total: 1 };
    
    // Elementos DOM
    this.tbodyEl = null;
    this.loadingEl = null;
    this.tableContainerEl = null;
    this.noDataEl = null;
    this.newSearchBtn = null;
    this.exportBtn = null;
    this.downloadBtn = null;
    this.verifyBtn = null;
    this.changePathBtn = null;
    this.pathDisplayEl = null;
    this.progressFillEl = null;
    this.paginationProgressEl = null;
    this.currentPageEl = null;
    this.totalPagesEl = null;
    
    this.init();
  }

  async init() {
    console.log('🚀 Inicializando Acontplus SRI Tools v' + this.version);
    
    await this.initializeDOM();
    this.initializeBrandIdentity();
    this.setupEventListeners();
    this.loadStoredData();
  }

  async initializeDOM() {
    try {
      this.tbodyEl = this.safeGetElement('facturas-tbody');
      this.loadingEl = this.safeGetElement('loading');
      this.tableContainerEl = this.safeGetElement('table-container');
      this.noDataEl = this.safeGetElement('no-data');
      this.newSearchBtn = this.safeGetElement('new-search');
      this.exportBtn = this.safeGetElement('export-selected');
      this.downloadBtn = this.safeGetElement('download-selected');
      this.verifyBtn = this.safeGetElement('verify-downloads');
      this.changePathBtn = this.safeGetElement('change-download-path');
      this.pathDisplayEl = this.safeGetElement('download-path-display');
      this.paginationProgressEl = this.safeGetElement('pagination-progress');
      this.currentPageEl = this.safeGetElement('current-page');
      this.totalPagesEl = this.safeGetElement('total-pages');
      
      this.createMissingProgressElements();
      console.log('✅ Elementos DOM inicializados correctamente');
    } catch (error) {
      console.error('Error inicializando elementos:', error);
      this.showNotification('Error inicializando interfaz', 'error');
    }
  }

  setupEventListeners() {
    if (this.newSearchBtn) this.newSearchBtn.addEventListener('click', () => this.startNewSearchRobusta());
    if (this.exportBtn) this.exportBtn.addEventListener('click', () => this.exportSelected());
    if (this.downloadBtn) this.downloadBtn.addEventListener('click', () => this.descargarSeleccionados());
    if (this.verifyBtn) this.verifyBtn.addEventListener('click', () => this.verifyDownloads());
    if (this.changePathBtn) this.changePathBtn.addEventListener('click', () => this.changeDownloadPath());

    if (this.tbodyEl) {
      this.tbodyEl.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') this.handleRowSelection(e.target);
      });
    }

    const masterCheckbox = document.getElementById('master-checkbox');
    if (masterCheckbox) masterCheckbox.addEventListener('change', () => this.toggleSelectAll());

    // Listener para mensajes directos (descargas, etc.)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'updateDownloadProgress') this.updateDownloadButtonProgress(message.current, message.total);
        else if (message.action === 'descargaFinalizada') this.handleDownloadComplete(message.exitosos, message.fallidos, message.total);
        else if (message.action === 'verificationError') this.showNotification(`Error de verificación: ${message.error}`, 'error');
        else if (message.action === 'pathSelected') this.updatePathDisplay(message.path);
    });

    // NUEVO: Listener para cambios en el storage (progreso de búsqueda)
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.progressStatus) {
            const progress = changes.progressStatus.newValue;
            if (progress) {
                if (progress.completed) {
                    this.handleSearchComplete(progress);
                } else {
                    this.updateProgressDisplay(progress);
                }
            }
        }
    });
  }

  async changeDownloadPath() {
      try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab || !tab.id) throw new Error('No se pudo encontrar la pestaña activa.');
          
          this.showNotification('Abriendo selector de carpetas... El popup se cerrará.', 'info');

          await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => {
                  if (window.sriExtractorInstance) {
                      window.sriExtractorInstance.solicitarYGuardarUbicacionDescarga();
                  }
              }
          });
      } catch (error) {
          console.error("Error al iniciar el cambio de ruta:", error);
          this.showNotification('Error al cambiar la ubicación.', 'error');
      }
  }
  
  updatePathDisplay(path) {
      if (this.pathDisplayEl) {
          this.pathDisplayEl.value = path || "Descargas del Navegador (Predeterminado)";
      }
  }

  async verifyDownloads() {
      if (this.selectedFacturas.size === 0) {
          this.showNotification('Seleccione al menos un documento para verificar', 'warning');
          return;
      }
      
      const facturasParaVerificar = this.facturas.filter(f => this.selectedFacturas.has(f.id));

      try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab || !tab.id) throw new Error('No se pudo encontrar la pestaña activa.');
          
          this.showNotification('Abriendo selector de carpetas... El popup se cerrará.', 'info');
          
          await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (facturas) => {
                  if (window.sriExtractorInstance) {
                      window.sriExtractorInstance.verificarDescargasEnPagina(facturas);
                  }
              },
              args: [facturasParaVerificar]
          });
      } catch(error) {
          console.error("Error al iniciar la verificación:", error);
          this.showNotification('Error al iniciar la verificación.', 'error');
      }
  }
  
  handleVerificationComplete(foundIds, total) {
      foundIds.forEach(facturaId => {
          const verificadoCell = document.querySelector(`td[data-verified-id="${facturaId}"]`);
          if (verificadoCell) {
              verificadoCell.innerHTML = '✔️';
          }
      });
      this.showNotification(`Resultados de verificación aplicados: ${foundIds.length} de ${total} encontrados.`, 'success');
  }

  updateDownloadButtonProgress(current, total) {
    if (this.downloadBtn) {
        this.safeSetHTML(this.downloadBtn, `<span class="btn-text">Descargando ${current}/${total}...</span>`);
    }
  }
  
  handleDownloadComplete(exitosos, fallidos, total) {
    if (this.downloadBtn) {
        this.downloadBtn.disabled = false;
        this.safeSetHTML(this.downloadBtn, '<span class="btn-text">Descargar</span>');
    }
    this.exportBtn.disabled = this.selectedFacturas.size === 0;
    
    let message = `Descarga finalizada. ${exitosos} de ${total} archivos descargados.`;
    let type = 'success';
    if(fallidos > 0) {
        message += ` ${fallidos} fallaron.`;
        type = fallidos === total ? 'error' : 'warning';
    }
    this.showNotification(message, type);
  }

  async descargarSeleccionados() {
    if (this.selectedFacturas.size === 0) {
      this.showNotification('Selecciona al menos un documento para descargar', 'warning');
      return;
    }

    const formato = document.getElementById('download-format').value;
    const facturasParaDescargar = this.facturas.filter(f => this.selectedFacturas.has(f.id));

    this.downloadBtn.disabled = true;
    this.exportBtn.disabled = true;
    this.safeSetHTML(this.downloadBtn, '<span class="btn-text">Iniciando...</span>');

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) throw new Error('No se pudo encontrar la pestaña activa.');

        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (facturas, formato) => {
                if (window.sriExtractorInstance) {
                    window.sriExtractorInstance.descargarDocumentosSeleccionados(facturas, formato);
                } else {
                    console.error("Instancia del extractor no encontrada.");
                }
            },
            args: [facturasParaDescargar, formato],
        });

    } catch (error) {
        console.error('Error al iniciar la descarga:', error);
        this.showNotification(`Error: ${error.message}. Recargue la página del SRI.`, 'error');
        this.handleDownloadComplete(0, facturasParaDescargar.length, facturasParaDescargar.length);
    }
  }

  // Búsqueda usando técnicas robustas integradas
  async startNewSearchRobusta() {
    console.log('🔍 Iniciando búsqueda completa automática...');
    
    if (this.newSearchBtn) {
      this.newSearchBtn.disabled = true;
      this.safeSetHTML(this.newSearchBtn, '<span class="btn-text">Conectando...</span>');
    }
    
    this.showState('loading');
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.id) {
        throw new Error('No se pudo obtener la pestaña activa');
      }

      if (!this.isDomainValid(tab.url)) {
        throw new Error('Navega a una página del SRI (*.sri.gob.ec)');
      }

      console.log('Pestaña activa encontrada:', tab.url);

      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            return window.SRIExtractorLoaded || false;
          }
        });
      } catch (injectionError) {
        console.log('Inyectando content script...');
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          await this.sleep(2000);
        } catch (scriptError) {
          console.error('Error inyectando script:', scriptError);
          throw new Error('No se pudo cargar el script en la página');
        }
      }

      this.safeSetHTML(this.newSearchBtn, '<span class="btn-text">Iniciando...</span>');
      
      const response = await this.sendMessageWithRetry(tab.id, { 
        action: 'buscarTodasLasPaginasRobusta',
        config: {
          optimizarPaginacion: true,
          extraerTodos: true,
          mostrarProgreso: true
        }
      }, 3);
      
      if (response && response.success) {
        this.showNotification('🔍 Búsqueda iniciada en todas las páginas disponibles', 'info');
        this.safeSetHTML(this.newSearchBtn, '<span class="btn-text">Procesando...</span>');
        
        if (response.paginationInfo) {
          this.paginationInfo = response.paginationInfo;
        }
        
      } else {
        throw new Error(response ? response.error : 'No se pudo iniciar la búsqueda');
      }
      
    } catch (error) {
      console.error('Error iniciando búsqueda completa:', error);
      
      let errorMessage = 'Error desconocido';
      if (error.message.includes('Could not establish connection')) {
        errorMessage = 'La extensión no puede conectar con esta página. Asegúrate de estar en el portal del SRI y recarga la página.';
      } else if (error.message.includes('Receiving end does not exist')) {
        errorMessage = 'Recarga la página del SRI y vuelve a intentar.';
      } else {
        errorMessage = error.message;
      }
      
      this.showNotification(errorMessage, 'error');
      this.showState('no-data');
      
    }
  }

  isDomainValid(url) {
    const validDomains = [
      'sri.gob.ec',
      'comprobantes-electronicos-internet',
      'srienlinea.sri.gob.ec'
    ];
    
    return validDomains.some(domain => url.includes(domain));
  }

  async sendMessageWithRetry(tabId, message, maxRetries) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log('Intento ' + attempt + '/' + maxRetries + ' enviando mensaje...');
        
        const response = await chrome.tabs.sendMessage(tabId, message);
        console.log('Respuesta recibida:', response);
        return response;
        
      } catch (error) {
        console.warn('Intento ' + attempt + ' fallido:', error.message);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        await this.sleep(1000);
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  handleSearchComplete(progress) {
    console.log('✅ Búsqueda completa finalizada:', progress);
    
    this.facturas = progress.allDocuments || [];
    this.paginationInfo = progress.paginationInfo || { current: progress.totalPages || 1, total: progress.totalPages || 1 };
    
    this.updateDisplay();
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

    this.showNotification(message, 'success');

    if (this.newSearchBtn) {
      this.newSearchBtn.disabled = false;
      this.safeSetHTML(this.newSearchBtn, '<span class="btn-text">Buscar</span>');
    }

    if (totalDocuments > 0) {
      this.showState('table');
      console.log('📊 Mostrando ' + totalDocuments + ' documentos en tabla');
    } else {
      this.showState('no-data');
      console.log('📭 No se encontraron documentos');
    }

    console.log('📈 Resumen final:', {
      documentos: totalDocuments,
      páginas: totalPages,
      optimización: optimization?.optimized || false
    });
  }

  updateProgressDisplay(progress) {
    if (this.progressFillEl && progress.currentPage && progress.totalPages) {
      const percentage = (progress.currentPage / progress.totalPages) * 100;
      this.progressFillEl.style.width = percentage + '%';
    }

    if (this.currentPageEl) {
      this.safeSetText(this.currentPageEl, (progress.currentPage || 1).toString());
    }

    if (this.totalPagesEl) {
      this.safeSetText(this.totalPagesEl, (progress.totalPages || 1).toString());
    }

    if (this.paginationProgressEl) {
      this.paginationProgressEl.style.display = 'block';
    }

    if (progress.documentosEncontrados !== undefined) {
      const totalCountEl = document.getElementById('total-count');
      if (totalCountEl) {
        this.safeSetText(totalCountEl, progress.documentosEncontrados.toString());
      }
    }

    if (this.newSearchBtn && progress.mensaje) {
      this.safeSetHTML(this.newSearchBtn, '<span class="btn-text">' + progress.mensaje + '</span>');
    }

    const porcentaje = progress.porcentaje || Math.round((progress.currentPage / progress.totalPages) * 100);
    console.log('📊 Progreso: ' + porcentaje + '% - Página ' + progress.currentPage + '/' + progress.totalPages + ' - ' + (progress.documentosEncontrados || 0) + ' documentos');
  }

  createMissingProgressElements() {
    if (this.paginationProgressEl && !this.progressFillEl) {
      const progressBar = this.paginationProgressEl.querySelector('.progress-bar');
      if (progressBar) {
        const progressFill = document.createElement('div');
        progressFill.id = 'progress-fill';
        progressFill.className = 'progress-fill';
        progressBar.appendChild(progressFill);
        this.progressFillEl = progressFill;
        console.log('Elemento progress-fill creado dinámicamente');
      }
    }
  }

  safeGetElement(id) {
    const element = document.getElementById(id);
    if (!element) {
      console.warn('Elemento no encontrado: ' + id);
      return null;
    }
    return element;
  }

  safeSetText(element, text) {
    if (element && element.textContent !== undefined) {
      element.textContent = text;
    } else {
      console.warn('No se pudo establecer texto en elemento:', element);
    }
  }

  safeSetHTML(element, html) {
    if (element && element.innerHTML !== undefined) {
      element.innerHTML = html;
    } else {
      console.warn('No se pudo establecer HTML en elemento:', element);
    }
  }

  initializeBrandIdentity() {
    document.title = 'Acontplus SRI Tools v' + this.version;
    
    const versionElements = document.querySelectorAll('.version-number, .tagline');
    versionElements.forEach(el => {
      if (el.textContent.includes('v1.')) {
        this.safeSetText(el, el.textContent.replace(/v1\.\d+\.\d+.*/, 'v' + this.version));
      }
    });

    const extractionTimestamp = document.getElementById('extraction-timestamp');
    if (extractionTimestamp) {
      this.safeSetText(extractionTimestamp, this.formatTimestamp(new Date()));
    }
  }

  loadStoredData() {
    chrome.storage.local.get(['facturasData', 'lastExtraction', 'lastVerification', 'downloadPathName']).then(result => {
      if (result.facturasData && result.facturasData.length > 0) {
        this.facturas = result.facturasData;
        this.updateDisplay();
        
        if (result.lastExtraction) {
          const extractionDate = new Date(result.lastExtraction);
          const extractionTimestamp = document.getElementById('extraction-timestamp');
          if (extractionTimestamp) this.safeSetText(extractionTimestamp, this.formatTimestamp(extractionDate));
        }
        
        // Cargar y aplicar resultados de verificación
        if (result.lastVerification && (Date.now() - result.lastVerification.timestamp < 10000)) {
            this.handleVerificationComplete(result.lastVerification.foundIds, result.lastVerification.total);
            chrome.storage.local.remove('lastVerification');
        }

        // Mostrar la ruta de descarga guardada
        this.updatePathDisplay(result.downloadPathName);
        
        console.log('✅ Datos cargados del almacenamiento:', this.facturas.length, 'documentos');
      } else {
        this.updateDisplay();
      }
    });
  }

  updateDisplay() {
    this.updateCounts();
    this.renderTable();
    
    if (this.facturas.length > 0) {
      this.showState('table');
      this.applyTheme();
    } else {
      this.showState('no-data');
    }
  }

  showState(state) {
    const states = {
      loading: this.loadingEl,
      table: this.tableContainerEl,
      'no-data': this.noDataEl
    };

    Object.values(states).forEach(el => {
      if (el) el.style.display = 'none';
    });

    if (states[state]) {
      states[state].style.display = state === 'table' ? 'flex' : 'block';
    }
  }

  updateCounts() {
    const totalCountEl = document.getElementById('total-count');
    const selectedCountEl = document.getElementById('selected-count');

    if (totalCountEl) {
      this.safeSetText(totalCountEl, this.facturas.length.toString());
    }

    if (selectedCountEl) {
      this.safeSetText(selectedCountEl, this.selectedFacturas.size.toString());
    }
  }

  toggleSelectAll() {
    const masterCheckbox = document.getElementById('master-checkbox');
    const shouldSelectAll = masterCheckbox ? masterCheckbox.checked : this.selectedFacturas.size === 0;

    if (shouldSelectAll) {
      this.facturas.forEach(factura => this.selectedFacturas.add(factura.id));
    } else {
      this.selectedFacturas.clear();
    }

    this.renderTable();
    this.updateSelectionCount();
  }

  handleRowSelection(checkbox) {
    const facturaId = checkbox.closest('tr').dataset.id;
    
    if (checkbox.checked) {
      this.selectedFacturas.add(facturaId);
    } else {
      this.selectedFacturas.delete(facturaId);
    }
    
    this.updateSelectionCount();
  }

  updateSelectionCount() {
    this.updateCounts();
    
    if (this.exportBtn) {
      this.exportBtn.disabled = this.selectedFacturas.size === 0;
    }
    if (this.downloadBtn) {
      this.downloadBtn.disabled = this.selectedFacturas.size === 0;
    }

    const masterCheckbox = document.getElementById('master-checkbox');
    if (masterCheckbox) {
      masterCheckbox.checked = this.selectedFacturas.size === this.facturas.length && this.facturas.length > 0;
      masterCheckbox.indeterminate = this.selectedFacturas.size > 0 && this.selectedFacturas.size < this.facturas.length;
    }
  }

  exportSelected() {
    if (this.selectedFacturas.size === 0) {
      this.showNotification('Selecciona al menos un documento para exportar', 'warning');
      return;
    }

    const facturasSeleccionadas = this.facturas.filter(f => this.selectedFacturas.has(f.id));
    this.exportToExcel(facturasSeleccionadas);
  }

  exportToExcel(facturas) {
    const tipoTexto = this.detectDocumentType(facturas);
    
    const data = facturas.map((factura, index) => ({
      'Nro': index + 1,
      'RUC': factura.ruc || '',
      'Razon Social': factura.razonSocial || '',
      'Tipo Comprobante': factura.tipoComprobante || '',
      'Serie': factura.serie || '',
      'Numero': factura.numeroComprobante || '',
      'Fecha Emision': factura.fechaEmision || '',
      'Fecha Autorizacion': factura.fechaAutorizacion || '',
      'Clave de Acceso': factura.claveAcceso || '',
      'Subtotal': factura.valorSinImpuestos || 0,
      'IVA': factura.iva || 0,
      'Total': factura.importeTotal || 0
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    ws['!cols'] = [
      { width: 8 }, { width: 15 }, { width: 35 }, { width: 15 },
      { width: 12 }, { width: 15 }, { width: 12 }, { width: 12 },
      { width: 50 }, { width: 12 }, { width: 12 }, { width: 12 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Comprobantes ' + tipoTexto);

    wb.Props = {
      Title: 'Comprobantes Electronicos SRI - ' + tipoTexto,
      Subject: 'Extraccion de Comprobantes SRI',
      Author: 'Acontplus S.A.S.',
      Company: 'Acontplus S.A.S.',
      Comments: 'Generado por Acontplus SRI Tools v' + this.version + ' - Páginas: ' + this.paginationInfo.current + '/' + this.paginationInfo.total,
      CreatedDate: new Date()
    };

    const fecha = new Date().toISOString().split('T')[0];
    const hora = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
    const paginaInfo = this.paginationInfo.total > 1 ? '_Pags' + this.paginationInfo.current + '-' + this.paginationInfo.total : '';
    const filename = 'Acontplus_SRI_' + tipoTexto.charAt(0).toUpperCase() + tipoTexto.slice(1) + '_' + fecha + '_' + hora + paginaInfo + '.xlsx';

    XLSX.writeFile(wb, filename);
    
    console.log('Excel exportado: ' + filename);
  }

  detectDocumentType(facturas) {
    if (facturas.length === 0) return 'documentos';
    
    const tipos = facturas.map(f => (f.tipoComprobante || '').toLowerCase());
    const facturaCount = tipos.filter(t => t.includes('factura')).length;
    const retencionCount = tipos.filter(t => t.includes('retencion')).length;
    
    if (facturaCount > retencionCount) return 'facturas';
    if (retencionCount > 0) return 'retenciones';
    return 'documentos';
  }

  applyTheme() {
    const tipoTexto = this.detectDocumentType(this.facturas);
    const themeClass = tipoTexto.includes('recibidos') ? 'theme-received' : 'theme-issued';
    document.body.classList.remove('theme-received', 'theme-issued');
    document.body.classList.add(themeClass);
  }

  formatTimestamp(date) {
    return date.toLocaleString('es-EC', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  convertirTipoDocumento(tipoOriginal) {
    const conversiones = {
      'factura': 'F',
      'comprobante de retencion': 'CR',
      'liquidacion de compra': 'LC', 
      'nota de credito': 'NC',
      'nota de debito': 'ND'
    };
    
    const tipoLower = tipoOriginal.toLowerCase();
    for (const key in conversiones) {
      if (tipoLower.includes(key.split(' ')[0])) {
        return conversiones[key];
      }
    }
    
    return tipoOriginal.substring(0, 2).toUpperCase();
  }

  getDocumentTypeClass(tipo) {
    const typeMap = {
      'F': 'doc-type-f',
      'CR': 'doc-type-cr', 
      'LC': 'doc-type-lc',
      'NC': 'doc-type-nc',
      'ND': 'doc-type-nd'
    };
    
    return typeMap[tipo] || 'doc-type-f';
  }

  renderTable() {
    if (!this.tbodyEl) {
      console.warn('No se puede renderizar tabla: tbody no encontrado');
      return;
    }

    if (this.facturas.length === 0) {
      this.safeSetHTML(this.tbodyEl, 
        '<tr>' +
          '<td colspan="9" class="text-center text-muted" style="padding: 40px;">' + 
            '<div style="color: #D61672; font-size: 24px; margin-bottom: 8px;">📄</div>' +
            '<div style="font-weight: 600; margin-bottom: 4px;">No se encontraron documentos electronicos</div>' +
            '<div style="font-size: 11px; color: #6c757d;">Utiliza "Buscar" para analizar todas las paginas disponibles</div>' +
          '</td>' +
        '</tr>'
      );
      return;
    }

    console.log('DEBUGGING: Iniciando renderizado de ' + this.facturas.length + ' registros de ' + this.paginationInfo.total + ' páginas');

    const tableHTML = this.facturas.map((factura, index) => {
      const contador = index + 1;
      
      return `<tr class="${(this.selectedFacturas.has(factura.id) ? 'selected' : '')}" 
            data-id="${factura.id}" 
            data-row-index="${index}" 
            style="animation: fadeInRow 0.3s ease-out ${index * 0.01}s both;">
          <td class="checkbox-col">
            <input type="checkbox" ${(this.selectedFacturas.has(factura.id) ? 'checked' : '')} data-id="${factura.id}">
          </td>
          <td class="counter-col">${contador}</td>
          <td class="numero-col">${factura.numero || ''}</td>
          <td class="ruc-col">${factura.ruc || ''}</td>
          <td class="razon-col">${factura.razonSocial || ''}</td>
          <td class="fecha-col">${factura.fechaEmision || ''}</td>
          <td class="amount-col">$${(factura.importeTotal || 0).toFixed(2)}</td>
          <td class="verificado-col" data-verified-id="${factura.id}"></td>
        </tr>`;
    }).join('');

    this.safeSetHTML(this.tbodyEl, tableHTML);

    const totalAmount = this.facturas.reduce((sum, f) => sum + (f.importeTotal || 0), 0);
    const totalAmountEl = document.querySelector('.total-amount');
    if (totalAmountEl) {
      this.safeSetText(totalAmountEl, '$' + totalAmount.toFixed(2));
    }

    const totalsEl = document.getElementById('facturas-totals');
    if (totalsEl) {
      totalsEl.style.display = this.facturas.length > 0 ? 'table-footer-group' : 'none';
    }
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'notification notification-' + type;
    
    const icons = {
      info: 'ℹ️',
      success: '✅', 
      warning: '⚠️',
      error: '❌'
    };
    
    this.safeSetHTML(notification,
      '<span style="margin-right: 8px; font-size: 16px;">' + (icons[type] || icons.info) + '</span>' +
      '<span>' + message + '</span>'
    );
    
    document.body.appendChild(notification);
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 12px 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: Inter, sans-serif;
      font-size: 13px;
      max-width: 300px;
      transform: translateX(120%);
      transition: all 0.3s ease;
    `;
    
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
      notification.style.transform = 'translateX(120%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 5000);
  }
}

// Estilos adicionales para animaciones
const additionalCSS = 
  '@keyframes fadeInRow {' +
    'from {' +
      'opacity: 0;' +
      'transform: translateY(5px);' +
    '}' +
    'to {' +
      'opacity: 1;' +
      'transform: translateY(0);' +
    '}' +
  '}' +
  
  '.progress-bar {' +
    'position: relative;' +
    'overflow: hidden;' +
  '}' +
  
  '.progress-fill {' +
    'transition: width 0.5s ease-in-out;' +
  '}';

const style = document.createElement('style');
style.textContent = additionalCSS;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => {
  window.facturasManager = new FacturasManager();
});