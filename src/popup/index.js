// Popup principal modular para Acontplus SRI Tools v1.4.1 - Final
// Punto de entrada que integra todos los componentes

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
    this.selectMissingBtn = null;
    this.progressFillEl = null;
    this.paginationProgressEl = null;
    this.currentPageEl = null;
    this.totalPagesEl = null;

    // Inicializar componentes
    this.dataManager = new DataManager(this);
    this.tableComponent = new TableComponent(this);
    this.exportComponent = new ExportComponent(this);
    this.notificationComponent = new NotificationComponent(this);

    this.init();
  }

  async init() {
    console.log('🚀 Inicializando Acontplus SRI Tools v' + this.version);

    await this.initializeDOM();
    PopupUI.initializeBrandIdentity(this.version);
    this.setupEventListeners();
    this.dataManager.loadStoredData();
  }

  async initializeDOM() {
    try {
      this.tbodyEl = PopupUI.safeGetElement('facturas-tbody');
      this.loadingEl = PopupUI.safeGetElement('loading');
      this.tableContainerEl = PopupUI.safeGetElement('table-container');
      this.noDataEl = PopupUI.safeGetElement('no-data');
      this.newSearchBtn = PopupUI.safeGetElement('new-search');
      this.exportBtn = PopupUI.safeGetElement('export-selected');
      this.downloadBtn = PopupUI.safeGetElement('download-selected');
      this.verifyBtn = PopupUI.safeGetElement('verify-downloads');
      this.selectMissingBtn = PopupUI.safeGetElement('select-missing');
      this.paginationProgressEl = PopupUI.safeGetElement('pagination-progress');
      this.currentPageEl = PopupUI.safeGetElement('current-page');
      this.totalPagesEl = PopupUI.safeGetElement('total-pages');

      this.tableComponent.initialize(this.tbodyEl);
      this.createMissingProgressElements();
      console.log('✅ Elementos DOM inicializados correctamente');
    } catch (error) {
      console.error('Error inicializando elementos:', error);
      this.showNotification('Error inicializando interfaz', 'error');
    }
  }

  setupEventListeners() {
    if (this.newSearchBtn) this.newSearchBtn.addEventListener('click', () => this.startNewSearchRobusta());
    if (this.exportBtn) this.exportBtn.addEventListener('click', () => this.exportComponent.exportSelected());
    if (this.downloadBtn) this.downloadBtn.addEventListener('click', () => this.descargarSeleccionados());
    if (this.verifyBtn) this.verifyBtn.addEventListener('click', () => this.verifyDownloads());
    if (this.selectMissingBtn) this.selectMissingBtn.addEventListener('click', () => this.dataManager.seleccionarFaltantes());

    if (this.tbodyEl) {
      this.tbodyEl.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') this.dataManager.handleRowSelection(e.target);
      });
    }

    const masterCheckbox = document.getElementById('master-checkbox');
    if (masterCheckbox) masterCheckbox.addEventListener('change', () => this.dataManager.toggleSelectAll());

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'updateDownloadProgress') this.updateDownloadButtonProgress(message.current, message.total);
        else if (message.action === 'descargaFinalizada') this.handleDownloadComplete(message.exitosos, message.fallidos, message.total);
        else if (message.action === 'verificationError') this.showNotification(`Error de verificación: ${message.error}`, 'error');
    });

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace !== 'local') return;
        if (changes.progressStatus) {
            const progress = changes.progressStatus.newValue;
            if (progress) {
                if (progress.completed) this.dataManager.handleSearchComplete(progress);
                else this.updateProgressDisplay(progress);
            }
        }
    });
  }

  // Delegar métodos a componentes
  showNotification(message, type = 'info') {
    this.notificationComponent.showNotification(message, type);
  }

  updateCounts() {
    this.tableComponent.updateCounts();
  }

  renderTable() {
    this.tableComponent.renderTable();
  }

  updateDisplay() {
    this.updateCounts();
    this.renderTable();

    if (this.dataManager.facturas.length > 0) {
      PopupUI.showState({
        loading: this.loadingEl,
        table: this.tableContainerEl,
        'no-data': this.noDataEl
      }, 'table');
      this.tableComponent.applyTheme();
    } else {
      PopupUI.showState({
        loading: this.loadingEl,
        table: this.tableContainerEl,
        'no-data': this.noDataEl
      }, 'no-data');
    }
  }

  // Resto de métodos delegados o implementados directamente
  async verifyDownloads() {
    if (this.dataManager.selectedFacturas.size === 0) {
        this.showNotification('Seleccione al menos un documento para verificar', 'warning');
        return;
    }

    const facturasParaVerificar = this.dataManager.facturas.filter(f => this.dataManager.selectedFacturas.has(f.id));

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

  updateDownloadButtonProgress(current, total) {
    if (this.downloadBtn) {
        PopupUI.safeSetHTML(this.downloadBtn, `<span class="btn-text">Descargando ${current}/${total}...</span>`);
    }
  }

  handleDownloadComplete(exitosos, fallidos, total) {
    if (this.downloadBtn) {
        this.downloadBtn.disabled = false;
        PopupUI.safeSetHTML(this.downloadBtn, '<span class="btn-text">Descargar</span>');
    }
    this.exportBtn.disabled = this.dataManager.selectedFacturas.size === 0;

    let message = `Descarga finalizada. ${exitosos} de ${total} archivos descargados.`;
    let type = 'success';
    if(fallidos > 0) {
        message += ` ${fallidos} fallaron.`;
        type = fallidos === total ? 'error' : 'warning';
    }
    this.showNotification(message, type);
  }

  async descargarSeleccionados() {
    if (this.dataManager.selectedFacturas.size === 0) {
      this.showNotification('Selecciona al menos un documento para descargar', 'warning');
      return;
    }

    const formato = document.getElementById('download-format').value;
    const facturasParaDescargar = this.dataManager.facturas.filter(f => this.dataManager.selectedFacturas.has(f.id));

    this.downloadBtn.disabled = true;
    this.exportBtn.disabled = true;
    PopupUI.safeSetHTML(this.downloadBtn, '<span class="btn-text">Iniciando...</span>');

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

  async startNewSearchRobusta() {
    console.log('🔍 Iniciando búsqueda completa automática...');

    if (this.newSearchBtn) {
      this.newSearchBtn.disabled = true;
      PopupUI.safeSetHTML(this.newSearchBtn, '<span class="btn-text">Conectando...</span>');
    }

    PopupUI.showState({
      loading: this.loadingEl,
      table: this.tableContainerEl,
      'no-data': this.noDataEl
    }, 'loading');

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
            files: ['src/content/index.js']
          });
          await this.sleep(2000);
        } catch (scriptError) {
          console.error('Error inyectando script:', scriptError);
          throw new Error('No se pudo cargar el script en la página');
        }
      }

      PopupUI.safeSetHTML(this.newSearchBtn, '<span class="btn-text">Iniciando...</span>');

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
        PopupUI.safeSetHTML(this.newSearchBtn, '<span class="btn-text">Procesando...</span>');

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
      PopupUI.showState({
        loading: this.loadingEl,
        table: this.tableContainerEl,
        'no-data': this.noDataEl
      }, 'no-data');
      if (this.newSearchBtn) {
        this.newSearchBtn.disabled = false;
        PopupUI.safeSetHTML(this.newSearchBtn, '<span class="btn-text">Buscar</span>');
      }
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

  updateProgressDisplay(progress) {
    if (this.progressFillEl && progress.currentPage && progress.totalPages) {
      const percentage = (progress.currentPage / progress.totalPages) * 100;
      this.progressFillEl.style.width = percentage + '%';
    }

    if (this.currentPageEl) {
      PopupUI.safeSetText(this.currentPageEl, (progress.currentPage || 1).toString());
    }

    if (this.totalPagesEl) {
      PopupUI.safeSetText(this.totalPagesEl, (progress.totalPages || 1).toString());
    }

    if (this.paginationProgressEl) {
      this.paginationProgressEl.style.display = 'block';
    }

    if (progress.documentosEncontrados !== undefined) {
      const totalCountEl = document.getElementById('total-count');
      if (totalCountEl) {
        PopupUI.safeSetText(totalCountEl, progress.documentosEncontrados.toString());
      }
    }

    if (this.newSearchBtn && progress.mensaje) {
      PopupUI.safeSetHTML(this.newSearchBtn, '<span class="btn-text">' + progress.mensaje + '</span>');
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

// Inicializar el manager cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.facturasManager = new FacturasManager();
});