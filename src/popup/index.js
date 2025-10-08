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

    await this.initializeDOM();
    PopupUI.initializeBrandIdentity(this.version);
    this.setupEventListeners();
    this.dataManager.loadStoredData();
  }

  async initializeDOM() {
    try {
      this.tbodyEl = PopupUI.safeGetElement('docs-table-body');
      this.loadingEl = PopupUI.safeGetElement('loading');
      this.tableContainerEl = PopupUI.safeGetElement('table-container');
      this.newSearchBtn = PopupUI.safeGetElement('start-process');
      this.exportBtn = PopupUI.safeGetElement('export-excel-btn');
      this.downloadBtn = PopupUI.safeGetElement('download-btn');
      this.verifyBtn = PopupUI.safeGetElement('verify-btn');
      this.paginationProgressEl = PopupUI.safeGetElement('pagination-progress');
      this.currentPageEl = PopupUI.safeGetElement('current-page');
      this.totalPagesEl = PopupUI.safeGetElement('total-pages');

      this.tableComponent.initialize(this.tbodyEl);
      this.createMissingProgressElements();
    } catch (error) {
      console.error('Error inicializando elementos:', error);
      this.showNotification('Error inicializando interfaz', 'error');
    }
  }

  setupEventListeners() {
    if (this.newSearchBtn) this.newSearchBtn.addEventListener('click', () => this.startNewSearchRobusta());
    if (this.exportBtn) this.exportBtn.addEventListener('click', (e) => { e.preventDefault(); this.exportComponent.exportSelected(); });
    if (this.downloadBtn) this.downloadBtn.addEventListener('click', (e) => { e.preventDefault(); this.descargarSeleccionados(); });
    if (this.verifyBtn) this.verifyBtn.addEventListener('click', (e) => { e.preventDefault(); this.verifyDownloads(true); });

    if (this.tbodyEl) {
      this.tbodyEl.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') this.dataManager.handleRowSelection(e.target);
      });
    }

    const masterCheckbox = document.getElementById('select-all');
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
      console.log('✅ Mostrando tabla con', this.dataManager.facturas.length, 'documentos');
      this.tableComponent.applyTheme();
    }
  }

  // Resto de métodos delegados o implementados directamente
  async verifyDownloads(selectedOnly = false) {
    const facturasToCheck = selectedOnly ? this.dataManager.facturas.filter(f => this.dataManager.selectedFacturas.has(f.id)) : this.dataManager.facturas;

    if (facturasToCheck.length === 0) {
        this.showNotification('No hay documentos para verificar.', 'warning');
        return;
    }

    try {
        this.showNotification('Verificando descargas en carpeta de Downloads...', 'info');

        // Obtener todas las descargas completadas usando chrome.downloads API
        const downloads = await new Promise((resolve, reject) => {
            chrome.downloads.search({ state: 'complete' }, (results) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(results);
                }
            });
        });

        console.log('DEBUG: Total downloads found:', downloads.length);
        console.log('DEBUG: Sample downloads:', downloads.slice(0, 5).map(d => ({ filename: d.filename, url: d.url })));

        // Crear un Set con los nombres de archivos descargados
        const downloadedFiles = new Set(downloads.map(d => d.filename.split(/[/\\]/).pop()));

        console.log('DEBUG: Archivos descargados encontrados:', Array.from(downloadedFiles));

        const foundIds = [];
        const foundPdfIds = [];

        // Verificar cada factura seleccionada
        for (const factura of facturasToCheck) {
            const xmlFileName = `${factura.numero.replace(/ /g, '_')}.xml`;
            const pdfFileName = `${factura.numero.replace(/ /g, '_')}.pdf`;

            console.log(`DEBUG: Verificando factura ${factura.id} - numero: ${factura.numero}, expected XML: ${xmlFileName}, expected PDF: ${pdfFileName}`);

            const hasXml = downloadedFiles.has(xmlFileName);
            const hasPdf = downloadedFiles.has(pdfFileName);

            if (hasXml || hasPdf) {
                foundIds.push(factura.id);
                if (hasPdf) foundPdfIds.push(factura.id);
                console.log(`DEBUG: Encontrado archivo para factura ${factura.id}`);
            } else {
                console.log(`DEBUG: NO encontrado archivo para factura ${factura.id}`);
            }
        }

        // Actualizar la UI con los resultados
        this.dataManager.handleVerificationComplete(foundIds, foundPdfIds, facturasToCheck.length, selectedOnly);

        // const noEncontrados = facturasToCheck.length - foundIds.length;
        // const mensaje = `✅ Verificación completada:\n${foundIds.length} encontrados, ${noEncontrados} faltantes`;

        // this.showNotification(mensaje, foundIds.length > 0 ? 'success' : 'warning');
    } catch(error) {
        console.error("Error al verificar descargas:", error);
        this.showNotification(`Error: ${error.message}`, 'error');
    }
  }

  updateDownloadButtonProgress(current, total) {
    if (this.downloadBtn) {
        PopupUI.safeSetHTML(this.downloadBtn, `<span class="btn-text">Descargando ${current}/${total}...</span>`);
    }
    const downloadedDocsEl = PopupUI.safeGetElement('downloaded-docs');
    if (downloadedDocsEl) {
        PopupUI.safeSetText(downloadedDocsEl, current.toString());
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

    // Ejecutar verificación automática después de la descarga
    if (exitosos > 0) {
        setTimeout(() => this.verifyDownloads(true), 1000); // Esperar un segundo para que las descargas se completen
    }
  }

  async descargarSeleccionados() {
    if (this.dataManager.selectedFacturas.size === 0) {
      this.showNotification('Selecciona al menos un documento para descargar', 'warning');
      return;
    }

    const formato = document.getElementById('doc-type').value;
    const facturasParaDescargar = this.dataManager.facturas.filter(f => this.dataManager.selectedFacturas.has(f.id));

    this.downloadBtn.disabled = true;
    this.exportBtn.disabled = true;
    PopupUI.safeSetHTML(this.downloadBtn, '<span class="btn-text">Iniciando...</span>');

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) throw new Error('No se pudo encontrar la pestaña activa.');

        // Verificar que el content script esté cargado
        let isLoaded = false;
        try {
          const pingResponse = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
          isLoaded = pingResponse && pingResponse.success;
        } catch (e) {
          isLoaded = false;
        }

        if (!isLoaded) {
          throw new Error('La extensión no está cargada. Recarga la página del SRI y busca documentos primero.');
        }

        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (facturas, formato) => {
                if (window.sriExtractorInstance) {
                    window.sriExtractorInstance.descargarDocumentosSeleccionados(facturas, formato);
                } else {
                    console.error("Instancia del extractor no encontrada.");
                    chrome.runtime.sendMessage({
                      action: 'descargaFinalizada',
                      exitosos: 0,
                      fallidos: facturas.length,
                      total: facturas.length
                    });
                }
            },
            args: [facturasParaDescargar, formato],
        });

    } catch (error) {
        console.error('Error al iniciar la descarga:', error);
        this.showNotification(`Error: ${error.message}`, 'error');
        this.handleDownloadComplete(0, facturasParaDescargar.length, facturasParaDescargar.length);
    }
  }

  async startNewSearchRobusta() {
    if (this.newSearchBtn) {
      this.newSearchBtn.disabled = true;
      PopupUI.safeSetHTML(this.newSearchBtn, '<span class="btn-text">Conectando...</span>');
    }

    if (this.loadingEl) this.loadingEl.style.display = 'block';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        throw new Error('No se pudo obtener la pestaña activa');
      }

      if (!this.isDomainValid(tab.url)) {
        throw new Error('Navega a una página del SRI (*.sri.gob.ec)');
      }
      // Verificar si el content script está cargado, si no, inyectarlo
      let pingResponse = null;
      try {
        pingResponse = await this.sendMessageWithRetry(tab.id, { action: 'ping' }, 1);
      } catch (pingError) {
        console.log('No se pudo hacer ping, content script no está cargado');
      }

      if (!pingResponse || !pingResponse.success) {
        PopupUI.safeSetHTML(this.newSearchBtn, '<span class="btn-text">Cargando módulos...</span>');
        
        // Inyectar los scripts en orden
        try {
          // Inyectar CSS primero
          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ['styles/content.css']
          }).catch(e => console.log('CSS ya inyectado o no necesario'));

          // Inyectar scripts en orden de dependencias
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['src/shared/utils.js']
          });
          
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['src/content/pagination.js']
          });
          
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['src/content/downloader.js']
          });
          
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['src/content/extractor.js']
          });
          
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['src/content/index.js']
          });
          
          // Esperar un momento para que se inicialicen
          await this.sleep(1500);

          // Verificar nuevamente con más intentos
          pingResponse = null;
          for (let i = 0; i < 3; i++) {
            try {
              pingResponse = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
              if (pingResponse && pingResponse.success) {
                break;
              }
            } catch (e) {
              await this.sleep(500);
            }
          }
          
          if (!pingResponse || !pingResponse.success) {
            throw new Error('No se pudo cargar la extensión en esta página. Recarga la página del SRI.');
          }
          
        } catch (injectError) {
          console.error('Error inyectando scripts:', injectError);
          throw new Error('Error cargando la extensión. Recarga la página del SRI y vuelve a intentar.');
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
      if (this.loadingEl) this.loadingEl.style.display = 'none';
      if (this.newSearchBtn) {
        this.newSearchBtn.disabled = false;
        PopupUI.safeSetHTML(this.newSearchBtn, '<span class="btn-text">Analizar Comprobantes</span>');
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
        const response = await chrome.tabs.sendMessage(tabId, message);
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
      const totalCountEl = document.getElementById('total-docs');
      if (totalCountEl) {
        PopupUI.safeSetText(totalCountEl, progress.documentosEncontrados.toString());
      }
    }

    if (this.newSearchBtn && progress.mensaje) {
      PopupUI.safeSetHTML(this.newSearchBtn, '<span class="btn-text">' + progress.mensaje + '</span>');
    }

    const porcentaje = progress.porcentaje || Math.round((progress.currentPage / progress.totalPages) * 100);
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