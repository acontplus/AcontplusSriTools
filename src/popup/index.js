// Popup principal modular para Acontplus SRI Tools v1.4.1 - Final
// Punto de entrada que integra todos los componentes

class FacturasManager {
  constructor() {
    this.version = '1.4.1-Final';
    this.facturas = [];
    this.selectedFacturas = new Set();

    // Elementos DOM
    this.tbodyEl = null;
    this.loadingEl = null;
    this.tableContainerEl = null;
    this.noDataEl = null;
    this.scanDocumentBtn = null;
    this.downloadBtn = null;
    this.cancelBtn = null;

    // Inicializar DownloadCounter
    this.initDownloadCounter();
    this.selectMissingBtn = null;
    this.progressFillEl = null;
    this.downloadLocationInput = null;
    this.savePathBtn = null;

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
    this.loadDownloadPath(); // Cargar la ruta de descarga guardada
    this.updatePopoverButtonStates(); // Initialize button states
  }

  initDownloadCounter() {
    try {
      // Verificar si DownloadCounter está disponible
      if (typeof DownloadCounter !== 'undefined') {
        if (!window.downloadCounter) {
          window.downloadCounter = new DownloadCounter();
        }
      } else {
        setTimeout(() => {
          if (typeof DownloadCounter !== 'undefined' && !window.downloadCounter) {
            window.downloadCounter = new DownloadCounter();
          }
        }, 1000);
      }
    } catch (error) {
      console.error('❌ Error inicializando DownloadCounter:', error)
    }
  }

  async initializeDOM() {
    try {
      this.tbodyEl = PopupUI.safeGetElement('docs-table-body');
      this.loadingEl = PopupUI.safeGetElement('loading');
      this.tableContainerEl = PopupUI.safeGetElement('table-container');
      this.scanDocumentBtn = PopupUI.safeGetElement('start-process');
      this.downloadBtn = PopupUI.safeGetElement('download-btn');
      this.cancelBtn = PopupUI.safeGetElement('cancel-download-btn');
      this.downloadLocationInput = PopupUI.safeGetElement('download-location');
      this.savePathBtn = PopupUI.safeGetElement('save-download-path');

      this.tableComponent.initialize(this.tbodyEl);
    } catch (error) {
      this.showNotification('Error inicializando interfaz', 'error');
    }
  }

  setupEventListeners() {
    const closeBtn = document.getElementById('close-panel-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.sendMessage({ action: 'closePanel' });
      });
    }

    if (this.savePathBtn) {
        this.savePathBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.saveDownloadPath();
        });
    }

    // Event listener for download settings modal toggle with CSS animations
    const downloadSettingsModal = document.getElementById('download-settings-modal');
    const downloadSettingsContent = document.getElementById('download-settings-content');
    const closeDownloadSettings = document.getElementById('close-download-settings');

    // --- Función para abrir ---
    function openDownloadSettings() {
        if (downloadSettingsModal) {
            downloadSettingsModal.classList.remove("hidden");
            requestAnimationFrame(() => {
                downloadSettingsModal.classList.remove("opacity-0");
                downloadSettingsContent.classList.remove("scale-95");
                downloadSettingsContent.classList.add("scale-100");
            });

            // Si tienes esta función ya implementada:
            if (typeof loadDownloadPath === "function") loadDownloadPath();
        }
    }

    // --- Función para cerrar ---
    function closeDownloadSettingsModal() {
        if (downloadSettingsModal) {
            downloadSettingsModal.classList.add("opacity-0");
            downloadSettingsContent.classList.remove("scale-100");
            downloadSettingsContent.classList.add("scale-95");
            setTimeout(() => downloadSettingsModal.classList.add("hidden"), 300);
        }
    }

    // Event listeners for modal (siempre activos)
    if (downloadSettingsModal) {
        // --- Cerrar con el botón ❌ ---
        if (closeDownloadSettings) {
            closeDownloadSettings.addEventListener("click", closeDownloadSettingsModal);
        }

        // --- Cerrar al hacer clic en el fondo ---
        downloadSettingsModal.addEventListener("click", (e) => {
            if (e.target === downloadSettingsModal || e.target.id === 'modal-backdrop') {
                closeDownloadSettingsModal();
            }
        });

        // --- Cerrar con la tecla Escape ---
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && !downloadSettingsModal.classList.contains('hidden')) {
                closeDownloadSettingsModal();
            }
        });
    }

    // --- Exportar función si la usas desde otro script ---
    window.openDownloadSettings = openDownloadSettings;

    // Event listener for options popover toggle with CSS animations
    const optionsToggleBtn = document.getElementById('options-toggle-popover');
    const optionsPopover = document.getElementById('options-popover');

    if (optionsToggleBtn && optionsPopover) {
        const showOptionsPopover = () => {
            optionsPopover.classList.remove('hidden');
            // Trigger animation by forcing reflow
            optionsPopover.offsetHeight;
            optionsPopover.classList.remove('opacity-0', 'scale-95', 'translate-y-2');
        };

        const hideOptionsPopover = () => {
            optionsPopover.classList.add('opacity-0', 'scale-95', 'translate-y-2');
            setTimeout(() => {
                optionsPopover.classList.add('hidden');
            }, 300);
        };

        optionsToggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (optionsPopover.classList.contains('hidden')) {
                showOptionsPopover();
            } else {
                hideOptionsPopover();
            }
        });

        // Close popover when clicking outside
        document.addEventListener('click', (e) => {
            if (!optionsToggleBtn.contains(e.target) && !optionsPopover.contains(e.target)) {
                if (!optionsPopover.classList.contains('hidden')) {
                    hideOptionsPopover();
                }
            }
        });

        // Close popover on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !optionsPopover.classList.contains('hidden')) {
                hideOptionsPopover();
            }
        });
    }

    if (this.scanDocumentBtn) {
        this.scanDocumentBtn.addEventListener('click', () => this.startNewSearchRobusta());
        
        // Add hover effects for analyze button
        this.scanDocumentBtn.addEventListener('mouseover', () => {
            this.scanDocumentBtn.style.backgroundColor = '#B8145F';
            this.scanDocumentBtn.style.borderColor = '#B8145F';
        });
        
        this.scanDocumentBtn.addEventListener('mouseout', () => {
            this.scanDocumentBtn.style.backgroundColor = '#D61672';
            this.scanDocumentBtn.style.borderColor = '#D61672';
        });
    }
    if (this.downloadBtn) this.downloadBtn.addEventListener('click', (e) => { e.preventDefault(); this.descargarSeleccionados(); });
    if (this.cancelBtn) this.cancelBtn.addEventListener('click', (e) => { e.preventDefault(); this.cancelDownload(); });

    // Search functionality
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });
    }

    // Event listeners for options popover buttons
    const exportExcelBtn = document.querySelector('[data-action="export_excel"]');
    const configRutaBtn = document.querySelector('[data-action="config_ruta"]');
    const verificarDescargasBtn = document.querySelector('[data-action="verificar_descargas"]');

    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (this.dataManager.selectedFacturas.size > 0) {
                this.exportComponent.exportSelected();
                // Hide popover after action
                const optionsPopover = document.getElementById('options-popover');
                if (optionsPopover) {
                    optionsPopover.classList.add('opacity-0', 'scale-95', 'translate-y-2');
                    setTimeout(() => {
                        optionsPopover.classList.add('hidden');
                    }, 300);
                }
            }
        });
    }

    if (configRutaBtn) {
        configRutaBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Show download settings modal
            openDownloadSettings();
            // Hide options popover
            const optionsPopover = document.getElementById('options-popover');
            if (optionsPopover) {
                optionsPopover.classList.add('opacity-0', 'scale-95', 'translate-y-2');
                setTimeout(() => {
                    optionsPopover.classList.add('hidden');
                }, 300);
            }
        });
    }

    if (verificarDescargasBtn) {
        verificarDescargasBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (this.dataManager.selectedFacturas.size > 0) {
                this.verifyDownloadsManual(true);
                // Hide popover after action
                const optionsPopover = document.getElementById('options-popover');
                if (optionsPopover) {
                    optionsPopover.classList.add('opacity-0', 'scale-95', 'translate-y-2');
                    setTimeout(() => {
                        optionsPopover.classList.add('hidden');
                    }, 300);
                }
            }
        });
    }

    if (this.tbodyEl) {
      this.tbodyEl.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') this.dataManager.handleRowSelection(e.target);
      });

      // Event listener for PDF icon clicks
      this.tbodyEl.addEventListener('click', (e) => {
        if (e.target.classList.contains('pdf-icon')) {
          const facturaId = e.target.dataset.facturaId;
          this.openPdfFile(facturaId);
        }
      });
    }

    const masterCheckbox = document.getElementById('select-all');
    if (masterCheckbox) masterCheckbox.addEventListener('change', () => this.dataManager.toggleSelectAll());

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'updateDownloadProgress') this.updateDownloadButtonProgress(message.current, message.total);
        else if (message.action === 'descargaFinalizada') this.handleDownloadComplete(message.exitosos, message.fallidos, message.total);
        else if (message.action === 'verificationError') this.showNotification(`Error de verificación: ${message.error}`, 'error');
        else if (message.action === 'hideCancelButton') this.hideCancelButton();
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

  async loadDownloadPath() {
    try {
        const result = await chrome.storage.local.get('downloadPath');
        if (result.downloadPath && this.downloadLocationInput) {
            this.downloadLocationInput.value = result.downloadPath;
        }
    } catch (error) {
        console.error('Error cargando la ruta de descarga:', error);
    }
  }

  async saveDownloadPath() {
    if (!this.downloadLocationInput) return;

    const newPath = this.downloadLocationInput.value.trim();
    try {
        await chrome.storage.local.set({ downloadPath: newPath });
        this.showNotification('Ruta de descarga guardada.', 'success');
    } catch (error) {
        console.error('Error guardando la ruta de descarga:', error);
        this.showNotification('No se pudo guardar la ruta.', 'error');
    }
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
    this.updatePopoverButtonStates();
    this.updateSearchVisibility();

    if (this.dataManager.facturas.length > 0) {
      console.log('✅ Mostrando tabla con', this.dataManager.facturas.length, 'documentos');
      this.tableComponent.applyTheme();
    }
  }

  updateSearchVisibility() {
    const searchContainer = document.getElementById('search-container');
    if (searchContainer) {
      // Show search only when there are documents
      searchContainer.style.display = this.dataManager.facturas.length > 0 ? 'block' : 'none';
    }
  }

  updatePopoverButtonStates() {
    const hasSelections = this.dataManager.selectedFacturas.size > 0;
    PopupUI.updateSelectionDependentButtons(hasSelections);
  }

  handleSearch(searchTerm) {
    if (!this.tbodyEl) return;

    const rows = this.tbodyEl.querySelectorAll('tr[data-id]');
    const searchLower = searchTerm.toLowerCase().trim();

    if (!searchTerm.trim()) {
      // Show all rows if search is empty
      rows.forEach(row => {
        row.style.display = '';
      });
    } else {
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        let matchFound = false;

        // Search in relevant columns (Nro Comprobante, RUC, Razón Social)
        for (let i = 2; i <= 4; i++) { // Columns 3, 4, 5 (0-indexed: 2, 3, 4)
          if (cells[i] && cells[i].textContent.toLowerCase().includes(searchLower)) {
            matchFound = true;
            break;
          }
        }

        row.style.display = matchFound ? '' : 'none';
      });
    }

    // Recalculate totals after filtering
    this.tableComponent.renderTotals();
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

        // Verificar si realmente hay descargas en el historial
        if (downloads.length === 0) {
            // No hay descargas en historial - limpiar estado guardado
            localStorage.removeItem('sri_export_hash');
            localStorage.removeItem('sri_export_date');
            chrome.storage.local.remove(['lastExportHash', 'lastExportDate']);
            
            this.showNotification('❌ No se encontraron descargas previas en el historial', 'warning');
            return;
        }

        // Crear un Set con los nombres de archivos descargados
        const downloadedFiles = new Set(downloads.map(d => d.filename.split(/[/\\]/).pop()));

        const foundIds = [];
        const foundPdfIds = [];

        // Verificar cada factura seleccionada
        for (const factura of facturasToCheck) {
            const xmlFileName = `${factura.numero.replace(/ /g, '_')}.xml`;
            const pdfFileName = `${factura.numero.replace(/ /g, '_')}.pdf`;

            const hasXml = downloadedFiles.has(xmlFileName);
            const hasPdf = downloadedFiles.has(pdfFileName);

            if (hasXml || hasPdf) {
                foundIds.push(factura.id);
                if (hasPdf) foundPdfIds.push(factura.id);
    
                // Store download IDs for opening later (for backward compatibility)
                const fileData = {};
                if (hasXml) {
                    const xmlDownload = downloads.find(d => d.filename.split(/[/\\]/).pop() === xmlFileName);
                    if (xmlDownload) fileData.xml = { downloadId: xmlDownload.id };
                }
                if (hasPdf) {
                    const pdfDownload = downloads.find(d => d.filename.split(/[/\\]/).pop() === pdfFileName);
                    if (pdfDownload) fileData.pdf = { downloadId: pdfDownload.id };
                }
                this.dataManager.fileInfo.set(factura.id, fileData);
            }
        }

        // Si no se encontraron archivos, limpiar estado guardado
        if (foundIds.length === 0) {
            localStorage.removeItem('sri_export_hash');
            localStorage.removeItem('sri_export_date');
            chrome.storage.local.remove(['lastExportHash', 'lastExportDate']);
        }

        // Actualizar la UI con los resultados
        this.dataManager.handleVerificationComplete(foundIds, foundPdfIds, facturasToCheck.length, selectedOnly);

    } catch(error) {
        console.error("Error al verificar descargas:", error);
        // Limpiar estado en caso de error
        localStorage.removeItem('sri_export_hash');
        localStorage.removeItem('sri_export_date');
        chrome.storage.local.remove(['lastExportHash', 'lastExportDate']);
        this.showNotification(`Error: ${error.message}`, 'error');
    }
  }

  updateDownloadButtonProgress(current, total) {
    if (this.downloadBtn) {
        PopupUI.safeSetHTML(this.downloadBtn, `<span class="btn-text">${current}/${total}...</span>`);
    }
    // Solo mostrar botón cancelar si no se ha cancelado
    if (this.cancelBtn && !this.downloadCancelled) {
        this.cancelBtn.style.display = 'flex';
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

    // Re-enable buttons after download completion
    const hasSelections = this.dataManager.selectedFacturas.size > 0;
    PopupUI.enableButtonsAfterOperation(hasSelections);

    let message = `Descarga finalizada. ${exitosos} de ${total} archivos descargados.`;
    let type = 'success';
    if(fallidos > 0) {
        message += ` ${fallidos} fallaron.`;
        type = fallidos === total ? 'error' : 'warning';
    }
    this.showNotification(message, type);

    // Incrementar contador de descargas y verificar si mostrar modal de feedback
    if (exitosos > 0 && window.downloadCounter) {
        console.log('🚀 Llamando downloadCounter.incrementDownload()...')
        window.downloadCounter.incrementDownload().then(modalShown => {
            if (modalShown) {
                console.log('🎯 Modal de feedback mostrado automáticamente');
            } else {
                console.log('📊 Modal no mostrado - aún no se alcanza el trigger');
            }
        }).catch(error => {
            console.error('❌ Error con contador de descargas:', error);
        });
    } else {
        if (exitosos === 0) {
            console.log('⚠️ No se incrementa contador - no hubo descargas exitosas')
        }
        if (!window.downloadCounter) {
            console.error('❌ window.downloadCounter no está disponible')
        }
    }

    // Ocultar botón cancelar al finalizar
    this.hideCancelButton();

    // Ejecutar verificación automática después de la descarga
    if (exitosos > 0) {
        setTimeout(() => this.verifyDownloads(true), 1000); // Esperar un segundo para que las descargas se completen
    }
  }

  hideCancelButton() {
    if (this.cancelBtn) {
        this.cancelBtn.style.display = 'none';
    }
  }

  async descargarSeleccionados() {
    if (this.dataManager.selectedFacturas.size === 0) {
      this.showNotification('Selecciona al menos un documento para descargar', 'warning');
      return;
    }

    const formato = document.getElementById('doc-type').value;
    const facturasParaDescargar = this.dataManager.facturas.filter(f => this.dataManager.selectedFacturas.has(f.id));

    // Disable buttons during download operation
    PopupUI.disableButtonsForOperation();

    // Mostrar botón de cancelar
    this.showCancelButton();
    this.downloadCancelled = false;

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

        // Verificar estado de sesión antes de descargar
        console.log('Verificando estado de sesión antes de descargar...');
        const sessionCheck = await this.sendMessageWithRetry(tab.id, { action: 'checkSession' }, 2);

        if (!sessionCheck.success) {
          throw new Error('Error al verificar sesión antes de descarga: ' + sessionCheck.error);
        }

        if (!sessionCheck.sessionActive) {
          // Restaurar UI y mostrar mensaje de sesión expirada
          this.hideCancelButton();
          // Re-enable buttons after session error
          const hasSelections = this.dataManager.selectedFacturas.size > 0;
          PopupUI.enableButtonsAfterOperation(hasSelections);

          this.showNotification('Ha perdido la sesión en el SRI. Por favor, recargue la página del SRI e inicie sesión nuevamente.', 'error');
          return; // Salir sin continuar
        }

        console.log('✅ Sesión activa confirmada antes de descarga:', sessionCheck.message);

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
        // Re-enable buttons after download error
        const hasSelections = this.dataManager.selectedFacturas.size > 0;
        PopupUI.enableButtonsAfterOperation(hasSelections);
        this.handleDownloadComplete(0, facturasParaDescargar.length, facturasParaDescargar.length);
    }
  }

  async startNewSearchRobusta() {
    // Disable buttons during scan operation
    PopupUI.disableButtonsForOperation();

    // Ocultar tabla y mostrar loader
    if (this.tableContainerEl) this.tableContainerEl.style.display = 'none';
    if (this.loadingEl) this.loadingEl.style.display = 'block';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        throw new Error('No se pudo obtener la pestaña activa');
      }

      if (!this.isDomainValid(tab.url)) {
        throw new Error('Navega a una página del SRI (*.sri.gob.ec)');
      }

      // Verificar estado de sesión antes de proceder
      console.log('Verificando estado de sesión en SRI...');
      const sessionCheck = await this.sendMessageWithRetry(tab.id, { action: 'checkSession' }, 2);

      if (!sessionCheck.success) {
        throw new Error('Error al verificar sesión: ' + sessionCheck.error);
      }

      if (!sessionCheck.sessionActive) {
        // Restaurar UI y mostrar mensaje de sesión expirada
        if (this.tableContainerEl) this.tableContainerEl.style.display = 'block';
        if (this.loadingEl) this.loadingEl.style.display = 'none';
        // Re-enable buttons after failed scan
        const hasSelections = this.dataManager.selectedFacturas.size > 0;
        PopupUI.enableButtonsAfterOperation(hasSelections);

        this.showNotification('Ha perdido la sesión en el SRI. Por favor, recargue la página del SRI e inicie sesión nuevamente.', 'error');
        return; // Salir sin continuar
      }

      console.log('✅ Sesión activa confirmada:', sessionCheck.message);
      // Verificar si el content script está cargado, si no, inyectarlo
      let pingResponse = null;
      try {
        pingResponse = await this.sendMessageWithRetry(tab.id, { action: 'ping' }, 1);
      } catch (pingError) {
        throw new Error('No se pudo hacer ping, content script no está cargado');
      }

      if (!pingResponse || !pingResponse.success) {

        // Inyectar los scripts en orden
        try {
          // Inyectar CSS primero
          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ['assets/css/content.css']
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

        if (response.paginationInfo) {
          this.paginationInfo = response.paginationInfo;
        }
      } else {
        throw new Error(response.error || 'Error desconocido iniciando búsqueda');
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
      
      // Restaurar vista de tabla cuando hay error
      if (this.tableContainerEl) this.tableContainerEl.style.display = 'block';
      if (this.loadingEl) this.loadingEl.style.display = 'none';

      // Re-enable buttons after error
      const hasSelections = this.dataManager.selectedFacturas.size > 0;
      PopupUI.enableButtonsAfterOperation(hasSelections);
    }
  }

  isDomainValid(url) {
    // URL específica requerida para la funcionalidad
    const requiredUrl = 'https://srienlinea.sri.gob.ec/comprobantes-electronicos-internet/pages/consultas/recibidos/comprobantesRecibidos.jsf';

    // Verificar si la URL contiene la ruta específica
    return url.includes(requiredUrl) || url.includes('srienlinea.sri.gob.ec');
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

    if (progress.documentosEncontrados !== undefined) {
      const totalCountEl = document.getElementById('total-docs');
      if (totalCountEl) {
        PopupUI.safeSetText(totalCountEl, progress.documentosEncontrados.toString());
      }
    }

    const porcentaje = progress.porcentaje || Math.round((progress.currentPage / progress.totalPages) * 100);
  }

  cancelDownload() {
    this.downloadCancelled = true;
    
    // Enviar mensaje de cancelación al content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'cancelDownload' });
      }
    });
    
    this.showNotification('Descarga cancelada por el usuario', 'warning');
    this.hideCancelButton();
    // Re-enable buttons after cancellation
    const hasSelections = this.dataManager.selectedFacturas.size > 0;
    PopupUI.enableButtonsAfterOperation(hasSelections);
  }

  showCancelButton() {
    if (this.cancelBtn) {
      this.cancelBtn.style.display = 'flex';
    }
    if (this.downloadBtn) {
      this.downloadBtn.disabled = true;
      this.downloadBtn.innerHTML = `
        <i class="fa-solid fa-download" aria-hidden="true"></i>
      `;
    }
  }

  hideCancelButton() {
    if (this.cancelBtn) {
      this.cancelBtn.style.display = 'none';
    }
    if (this.downloadBtn) {
      this.downloadBtn.disabled = false;
      this.downloadBtn.innerHTML = `
        <i class="fa-solid fa-download" aria-hidden="true"></i>
      `;
    }
  }

  // Nueva funcionalidad: Verificación manual con acceso directo a carpeta
  async verifyDownloadsManual(selectedOnly = false) {
    const facturasToCheck = selectedOnly ? this.dataManager.facturas.filter(f => this.dataManager.selectedFacturas.has(f.id)) : this.dataManager.facturas;

    if (facturasToCheck.length === 0) {
        this.showNotification('No hay documentos para verificar.', 'warning');
        return;
    }

    try {
        // Usar solo chrome.downloads API
        console.log('Verificando descargas usando chrome.downloads API');
        await this.verifyWithChromeDownloadsAPI(facturasToCheck, selectedOnly);

    } catch (error) {
        console.error("Error al verificar descargas:", error);
        this.showNotification(`Error: ${error.message}`, 'error');
    }
  }

  // Método moderno con File System Access API
  async verifyWithFileSystemAccess(facturasToCheck, selectedOnly) {
    this.showNotification('Selecciona la carpeta de Descargas para verificar archivos...', 'info');

    // Solicitar acceso directo a la carpeta de descargas
    const dirHandle = await window.showDirectoryPicker({
        mode: 'read',
        startIn: 'downloads' // Sugerir carpeta de descargas
    });

    console.log('Acceso concedido a la carpeta:', dirHandle.name);

    // Escanear archivos en la carpeta seleccionada (incluyendo subcarpetas)
    const downloadedFiles = new Map(); // filename -> {size, hash}

    await this.scanDirectoryRecursively(dirHandle, downloadedFiles, '');

    console.log(`Total archivos escaneados: ${downloadedFiles.size}`);

    const foundIds = [];
    const foundPdfIds = [];
    const missingFiles = [];

    // Verificar cada factura
    for (const factura of facturasToCheck) {
        const xmlFileName = `${factura.numero.replace(/ /g, '_')}.xml`;
        const pdfFileName = `${factura.numero.replace(/ /g, '_')}.pdf`;

        const xmlInfo = downloadedFiles.get(xmlFileName);
        const pdfInfo = downloadedFiles.get(pdfFileName);

        let hasValidXml = false;
        let hasValidPdf = false;

        if (xmlInfo) {
            // Verificar integridad básica: tamaño > 0
            hasValidXml = xmlInfo.size > 0;
            if (!hasValidXml) {
                console.warn(`Archivo XML corrupto o vacío: ${xmlFileName}`);
            }
        }

        if (pdfInfo) {
            hasValidPdf = pdfInfo.size > 0;
            if (!hasValidPdf) {
                console.warn(`Archivo PDF corrupto o vacío: ${pdfFileName}`);
            }
        }

        if (hasValidXml || hasValidPdf) {
            foundIds.push(factura.id);
            if (hasValidPdf) foundPdfIds.push(factura.id);

            // Store file information for opening later
            const fileData = {};
            if (hasValidXml && xmlInfo) {
                const xmlDownload = await this.findDownloadByFilename(xmlFileName);
                fileData.xml = { downloadId: xmlDownload?.id, path: xmlInfo.fullPath };
            }
            if (hasValidPdf && pdfInfo) {
                const pdfDownload = await this.findDownloadByFilename(pdfFileName);
                fileData.pdf = { downloadId: pdfDownload?.id, path: pdfInfo.fullPath };
            }
            this.dataManager.fileInfo.set(factura.id, fileData);

            console.log(`Factura ${factura.id}: encontrada (${hasValidXml ? 'XML' : ''}${hasValidXml && hasValidPdf ? '+' : ''}${hasValidPdf ? 'PDF' : ''})`);
        } else {
            missingFiles.push(factura.numero);
            console.log(`Factura ${factura.id}: no encontrada o corrupta`);
        }
    }

    // Actualizar la UI con los resultados
    this.dataManager.handleVerificationComplete(foundIds, foundPdfIds, facturasToCheck.length, selectedOnly);

    const encontrados = foundIds.length;
    const total = facturasToCheck.length;
    const faltantes = total - encontrados;

    let mensaje = `✅ Verificación completada: ${encontrados} de ${total} archivos verificados.`;
    if (faltantes > 0) {
        mensaje += ` ${faltantes} faltantes o corruptos.`;
    }

    this.showNotification(mensaje, encontrados > 0 ? 'success' : 'warning');

    if (missingFiles.length > 0) {
        console.log('Archivos faltantes:', missingFiles);
    }
  }

  // Método alternativo usando chrome.downloads API
  async verifyWithChromeDownloadsAPI(facturasToCheck, selectedOnly) {
    this.showNotification('Verificando descargas desde historial de Chrome...', 'info');

    // Limpiar datos guardados para forzar verificación fresca
    this.dataManager.fileInfo.clear();

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

    // Verificar si realmente hay descargas en el historial
    if (downloads.length === 0) {
        this.showNotification('❌ No se encontraron descargas en el historial de Chrome', 'warning');
        return;
    }

    console.log(`📋 Verificando contra ${downloads.length} descargas en el historial`);

    // Crear un Set con los nombres de archivos descargados
    const downloadedFiles = new Set(downloads.map(d => d.filename.split(/[/\\]/).pop()));

    const foundXmlIds = [];
    const foundPdfIds = [];

    // Verificar cada factura seleccionada
    for (const factura of facturasToCheck) {
        const xmlFileName = `${factura.numero.replace(/ /g, '_')}.xml`;
        const pdfFileName = `${factura.numero.replace(/ /g, '_')}.pdf`;

        const hasXml = downloadedFiles.has(xmlFileName);
        const hasPdf = downloadedFiles.has(pdfFileName);

        // Agregar a foundXmlIds si tiene XML
        if (hasXml) {
            foundXmlIds.push(factura.id);
        }
        
        // Agregar a foundPdfIds si tiene PDF
        if (hasPdf) {
            foundPdfIds.push(factura.id);
        }

        // Store download IDs for opening later
        const fileData = {};
        if (hasXml) {
            const xmlDownload = downloads.find(d => d.filename.split(/[/\\]/).pop() === xmlFileName);
            if (xmlDownload) fileData.xml = { downloadId: xmlDownload.id };
        }
        if (hasPdf) {
            const pdfDownload = downloads.find(d => d.filename.split(/[/\\]/).pop() === pdfFileName);
            if (pdfDownload) fileData.pdf = { downloadId: pdfDownload.id };
        }
        if (hasXml || hasPdf) {
            this.dataManager.fileInfo.set(factura.id, fileData);
        }
        
        console.log(`✅ Factura ${factura.numero}: XML=${hasXml}, PDF=${hasPdf}`);
    }

    // Actualizar la UI con los resultados
    this.dataManager.handleVerificationComplete(foundXmlIds, foundPdfIds, facturasToCheck.length, selectedOnly);

    const encontradosXml = foundXmlIds.length;
    const encontradosPdf = foundPdfIds.length;
    const total = facturasToCheck.length;

    let mensaje = `✅ Verificación completada: ${encontradosXml} XML, ${encontradosPdf} PDF de ${total} archivos.`;

    this.showNotification(mensaje, (encontradosXml > 0 || encontradosPdf > 0) ? 'success' : 'warning');
  }

  // Método auxiliar para escanear directorio recursivamente
  async scanDirectoryRecursively(dirHandle, fileMap, path = '') {
    try {
        for await (const [name, handle] of dirHandle.entries()) {
            const fullPath = path ? `${path}/${name}` : name;

            if (handle.kind === 'file') {
                try {
                    const file = await handle.getFile();
                    const size = file.size;
                    const hash = await this.computeFileHash(file);
                    fileMap.set(name, { size, hash, fullPath }); // Usar solo nombre para búsqueda, pero guardar path completo
                    console.log(`Archivo encontrado: ${fullPath}, tamaño: ${size} bytes, hash: ${hash ? hash.substring(0, 16) + '...' : 'N/A'}`);
                } catch (fileError) {
                    console.warn(`Error al procesar archivo ${fullPath}:`, fileError);
                }
            } else if (handle.kind === 'directory') {
                // Escanear subcarpetas recursivamente
                console.log(`Escaneando subcarpeta: ${fullPath}`);
                await this.scanDirectoryRecursively(handle, fileMap, fullPath);
            }
        }
    } catch (error) {
        console.warn(`Error escaneando directorio ${path}:`, error);
    }
  }

  // Método auxiliar para encontrar descarga por nombre de archivo
  async findDownloadByFilename(filename) {
    try {
        const downloads = await new Promise((resolve, reject) => {
            chrome.downloads.search({ filenameRegex: filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$' }, (results) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(results);
                }
            });
        });
        return downloads.find(d => d.filename.split(/[/\\]/).pop() === filename);
    } catch (error) {
        console.warn('Error buscando descarga:', error);
        return null;
    }
  }

  // Método auxiliar para calcular hash SHA-256 de un archivo
  async computeFileHash(file) {
    try {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
        console.warn('Error calculando hash:', error);
        return null;
    }
  }

  // Método para abrir archivo PDF
  async openPdfFile(facturaId) {
    try {
        console.log('Intentando abrir PDF para factura:', facturaId);
        console.log('fileInfo disponible:', this.dataManager.fileInfo);
        const fileInfo = this.dataManager.fileInfo.get(facturaId);
        console.log('fileInfo para esta factura:', fileInfo);
        if (!fileInfo || !fileInfo.pdf) {
            this.showNotification('Información del archivo PDF no encontrada.', 'error');
            return;
        }

        if (fileInfo.pdf.downloadId) {
            // Usar chrome.downloads API (preferido)
            console.log('Abriendo PDF con downloadId:', fileInfo.pdf.downloadId);
            chrome.downloads.open(fileInfo.pdf.downloadId, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error abriendo PDF con downloadId:', fileInfo.pdf.downloadId, chrome.runtime.lastError);
                    // Intentar con path como fallback
                    if (fileInfo.pdf.path) {
                        const fileUrl = `file://${fileInfo.pdf.path}`;
                        chrome.tabs.create({ url: fileUrl }, (tab) => {
                            if (chrome.runtime.lastError) {
                                this.showNotification(`Error al abrir el PDF: ${chrome.runtime.lastError.message}`, 'error');
                            } else {
                                this.showNotification('PDF abierto exitosamente.', 'success');
                            }
                        });
                    } else {
                        this.showNotification(`Error al abrir el PDF: ${chrome.runtime.lastError.message}`, 'error');
                    }
                } else {
                    this.showNotification('PDF abierto exitosamente.', 'success');
                }
            });
        } else if (fileInfo.pdf.path) {
            // Fallback: intentar abrir con file:// URL
            const fileUrl = `file://${fileInfo.pdf.path}`;
            chrome.tabs.create({ url: fileUrl }, (tab) => {
                if (chrome.runtime.lastError) {
                    console.error('Error abriendo PDF:', chrome.runtime.lastError);
                    this.showNotification('Error al abrir el PDF. Verifica los permisos de archivo.', 'error');
                } else {
                    console.log('PDF abierto en nueva pestaña:', tab.id);
                }
            });
        } else {
            this.showNotification('No se puede determinar cómo abrir el PDF.', 'error');
        }
    } catch (error) {
        console.error('Error abriendo PDF:', error);
        this.showNotification('Error al abrir el PDF.', 'error');
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
  '}' +

  '.pdf-icon {' +
    'display: inline-block;' +
    'transition: all 0.2s ease;' +
  '}' +

  '.pdf-icon:hover {' +
    'background-color: #f3f4f6;' +
    'border-radius: 4px;' +
    'transform: scale(1.1);' +
  '}';

const style = document.createElement('style');
style.textContent = additionalCSS;
document.head.appendChild(style);

// Inicializar el manager cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.facturasManager = new FacturasManager();
});