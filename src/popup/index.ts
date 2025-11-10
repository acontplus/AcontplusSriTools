// Popup principal - Migrado a TypeScript completamente

import { VERSION, DELAYS } from '@shared/constants';
import { StorageManager, onStorageChange } from '@shared/storage';
import { sendMessageWithRetry, updateBadge } from '@shared/messaging';
import { isDomainValid, esperar } from '@shared/utils';
import type { Documento, FormatoDescarga, ProgressStatus, FileInfo } from '@shared/types';

import { DataManager } from './services/data';
import { PopupUI } from './services/ui';
import { TableComponent } from './components/table';
import { ExportComponent } from './components/export';
import { NotificationComponent } from './components/notifications';
import { TabManager } from './components/tab-manager';

export class FacturasManager {
  public version = VERSION;
  public facturas: Documento[] = [];
  public selectedFacturas = new Set<string>();

  // Elementos DOM
  public tbodyEl: HTMLElement | null = null;
  public loadingEl: HTMLElement | null = null;
  public tableContainerEl: HTMLElement | null = null;
  public noDataEl: HTMLElement | null = null;
  public scanDocumentBtn: HTMLButtonElement | null = null;
  public downloadBtn: HTMLButtonElement | null = null;
  public cancelBtn: HTMLButtonElement | null = null;
  public progressFillEl: HTMLElement | null = null;
  public downloadLocationInput: HTMLInputElement | null = null;
  public savePathBtn: HTMLButtonElement | null = null;

  private downloadCancelled = false;

  // Componentes
  public dataManager: DataManager;
  public tableComponent: TableComponent;
  public exportComponent: ExportComponent;
  public notificationComponent: NotificationComponent;

  constructor() {
    this.dataManager = new DataManager(this);
    this.tableComponent = new TableComponent(this);
    this.exportComponent = new ExportComponent(this);
    this.notificationComponent = new NotificationComponent();

    this.init();
  }

  private async init(): Promise<void> {
    await this.initializeDOM();
    PopupUI.initializeBrandIdentity(this.version);
    this.setupEventListeners();
    this.dataManager.loadStoredData();
    this.loadDownloadPath();
    this.updatePopoverButtonStates();
    this.clearExtensionBadge();
    
    // Inicializar sistema de tabs
    new TabManager();
  }

  private clearExtensionBadge(): void {
    updateBadge(0).catch(console.error);
  }

  private async initializeDOM(): Promise<void> {
    try {
      this.tbodyEl = PopupUI.safeGetElement('docs-table-body');
      this.loadingEl = PopupUI.safeGetElement('loading');
      this.tableContainerEl = PopupUI.safeGetElement('table-container');
      this.scanDocumentBtn = PopupUI.safeGetElement('start-process') as HTMLButtonElement;
      this.downloadBtn = PopupUI.safeGetElement('download-btn') as HTMLButtonElement;
      this.cancelBtn = PopupUI.safeGetElement('cancel-download-btn') as HTMLButtonElement;
      this.downloadLocationInput = PopupUI.safeGetElement('download-location') as HTMLInputElement;
      this.savePathBtn = PopupUI.safeGetElement('save-download-path') as HTMLButtonElement;

      this.tableComponent.initialize(this.tbodyEl);
    } catch (error) {
      this.showNotification('Error inicializando interfaz', 'error');
    }
  }

  private setupEventListeners(): void {
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

    // Modal de configuración de descargas
    this.setupDownloadSettingsModal();

    // Popover de opciones
    this.setupOptionsPopover();

    // Botón de análisis
    if (this.scanDocumentBtn) {
      this.scanDocumentBtn.addEventListener('click', () => this.startNewSearchRobusta());
    }

    // Botones de descarga
    if (this.downloadBtn) {
      this.downloadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.descargarSeleccionados();
      });
    }

    if (this.cancelBtn) {
      this.cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.cancelDownload();
      });
    }

    // Búsqueda
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.handleSearch((e.target as HTMLInputElement).value);
      });
    }

    // Botones del popover
    this.setupPopoverButtons();

    // Tabla
    if (this.tbodyEl) {
      this.tbodyEl.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.type === 'checkbox') {
          this.dataManager.handleRowSelection(target);
        }
      });

      this.tbodyEl.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('pdf-icon')) {
          const facturaId = target.dataset.facturaId;
          if (facturaId) this.openPdfFile(facturaId);
        }
      });
    }

    // Checkbox maestro
    const masterCheckbox = document.getElementById('select-all') as HTMLInputElement;
    if (masterCheckbox) {
      masterCheckbox.addEventListener('change', () => this.dataManager.toggleSelectAll());
    }

    // Mensajes del runtime
    chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
      if (message.action === 'updateDownloadProgress') {
        this.updateDownloadButtonProgress(message.current, message.total);
      } else if (message.action === 'descargaFinalizada') {
        this.handleDownloadComplete(message.exitosos, message.fallidos, message.total);
      } else if (message.action === 'hideCancelButton') {
        this.hideCancelButton();
      } else if (message.action === 'sessionLost') {
        this.hideCancelButton();
        const hasSelections = this.dataManager.selectedFacturas.size > 0;
        PopupUI.enableButtonsAfterOperation(hasSelections);
        this.showNotification(message.message, 'error');
      }
    });

    // Storage changes
    onStorageChange((changes) => {
      if (changes.progressStatus) {
        const progress = changes.progressStatus.newValue;
        if (progress) {
          if (progress.completed) {
            this.dataManager.handleSearchComplete(progress);
          } else {
            this.updateProgressDisplay(progress);
          }
        }
      }
    });
  }

  private setupDownloadSettingsModal(): void {
    const downloadSettingsModal = document.getElementById('download-settings-modal');
    const downloadSettingsContent = document.getElementById('download-settings-content');
    const closeDownloadSettings = document.getElementById('close-download-settings');

    const openDownloadSettings = () => {
      if (downloadSettingsModal) {
        downloadSettingsModal.classList.remove('hidden');
        requestAnimationFrame(() => {
          downloadSettingsModal.classList.remove('opacity-0');
          downloadSettingsContent?.classList.remove('scale-95');
          downloadSettingsContent?.classList.add('scale-100');
        });
      }
    };

    const closeDownloadSettingsModal = () => {
      if (downloadSettingsModal) {
        downloadSettingsModal.classList.add('opacity-0');
        downloadSettingsContent?.classList.remove('scale-100');
        downloadSettingsContent?.classList.add('scale-95');
        setTimeout(() => downloadSettingsModal.classList.add('hidden'), 300);
      }
    };

    if (closeDownloadSettings) {
      closeDownloadSettings.addEventListener('click', closeDownloadSettingsModal);
    }

    if (downloadSettingsModal) {
      downloadSettingsModal.addEventListener('click', (e) => {
        if (e.target === downloadSettingsModal || (e.target as HTMLElement).id === 'modal-backdrop') {
          closeDownloadSettingsModal();
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !downloadSettingsModal.classList.contains('hidden')) {
          closeDownloadSettingsModal();
        }
      });
    }

    (window as any).openDownloadSettings = openDownloadSettings;
  }

  private setupOptionsPopover(): void {
    const optionsToggleBtn = document.getElementById('options-toggle-popover');
    const optionsPopover = document.getElementById('options-popover');

    if (!optionsToggleBtn || !optionsPopover) return;

    const showOptionsPopover = () => {
      optionsPopover.classList.remove('hidden');
      optionsPopover.offsetHeight;
      optionsPopover.classList.remove('opacity-0', 'scale-95', 'translate-y-2');
    };

    const hideOptionsPopover = () => {
      optionsPopover.classList.add('opacity-0', 'scale-95', 'translate-y-2');
      setTimeout(() => optionsPopover.classList.add('hidden'), 300);
    };

    optionsToggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (optionsPopover.classList.contains('hidden')) {
        showOptionsPopover();
      } else {
        hideOptionsPopover();
      }
    });

    document.addEventListener('click', (e) => {
      if (
        !optionsToggleBtn.contains(e.target as Node) &&
        !optionsPopover.contains(e.target as Node)
      ) {
        if (!optionsPopover.classList.contains('hidden')) {
          hideOptionsPopover();
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !optionsPopover.classList.contains('hidden')) {
        hideOptionsPopover();
      }
    });
  }

  private setupPopoverButtons(): void {
    const exportExcelBtn = document.querySelector('[data-action="export_excel"]');
    const configRutaBtn = document.querySelector('[data-action="config_ruta"]');
    const verificarDescargasBtn = document.querySelector('[data-action="verificar_descargas"]');

    if (exportExcelBtn) {
      exportExcelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.dataManager.selectedFacturas.size > 0) {
          this.exportComponent.exportSelected();
          this.hideOptionsPopover();
        }
      });
    }

    if (configRutaBtn) {
      configRutaBtn.addEventListener('click', (e) => {
        e.preventDefault();
        (window as any).openDownloadSettings();
        this.hideOptionsPopover();
      });
    }

    if (verificarDescargasBtn) {
      verificarDescargasBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.dataManager.selectedFacturas.size > 0) {
          this.verifyDownloadsManual(true);
          this.hideOptionsPopover();
        }
      });
    }
  }

  private hideOptionsPopover(): void {
    const optionsPopover = document.getElementById('options-popover');
    if (optionsPopover) {
      optionsPopover.classList.add('opacity-0', 'scale-95', 'translate-y-2');
      setTimeout(() => optionsPopover.classList.add('hidden'), 300);
    }
  }

  private async loadDownloadPath(): Promise<void> {
    try {
      const path = await StorageManager.getDownloadPath();
      if (path && this.downloadLocationInput) {
        this.downloadLocationInput.value = path;
      }
    } catch (error) {
      console.error('Error cargando la ruta de descarga:', error);
    }
  }

  private async saveDownloadPath(): Promise<void> {
    if (!this.downloadLocationInput) return;

    const newPath = this.downloadLocationInput.value.trim();
    try {
      await StorageManager.saveDownloadPath(newPath);
      
      // Cerrar el modal
      this.closeDownloadSettingsModal();
      
      // Mostrar notificación de éxito
      const message = newPath 
        ? `✅ Ruta de descarga configurada: ${newPath}` 
        : '✅ Ruta de descarga restablecida a la carpeta predeterminada';
      this.showNotification(message, 'success');
    } catch (error) {
      console.error('Error guardando la ruta de descarga:', error);
      this.showNotification('❌ No se pudo guardar la ruta de descarga', 'error');
    }
  }

  private closeDownloadSettingsModal(): void {
    const downloadSettingsModal = document.getElementById('download-settings-modal');
    const downloadSettingsContent = document.getElementById('download-settings-content');
    
    if (downloadSettingsModal) {
      downloadSettingsModal.classList.add('opacity-0');
      downloadSettingsContent?.classList.remove('scale-100');
      downloadSettingsContent?.classList.add('scale-95');
      setTimeout(() => downloadSettingsModal.classList.add('hidden'), 300);
    }
  }

  public showNotification(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    this.notificationComponent.showNotification(message, type);
  }

  public updateCounts(): void {
    this.tableComponent.updateCounts();
  }

  public renderTable(): void {
    this.tableComponent.renderTable();
  }

  public updateDisplay(): void {
    this.updateCounts();
    this.renderTable();
    this.updatePopoverButtonStates();
    this.updateSearchVisibility();

    if (this.dataManager.facturas.length > 0) {
      this.tableComponent.applyTheme();
    }
  }

  private updateSearchVisibility(): void {
    const searchContainer = document.getElementById('search-container');
    if (searchContainer) {
      searchContainer.style.display = this.dataManager.facturas.length > 0 ? 'block' : 'none';
    }
  }

  public updatePopoverButtonStates(): void {
    const hasSelections = this.dataManager.selectedFacturas.size > 0;
    PopupUI.updateSelectionDependentButtons(hasSelections);
  }

  public handleSearch(searchTerm: string): void {
    if (!this.tbodyEl) return;

    const rows = this.tbodyEl.querySelectorAll<HTMLElement>('tr[data-id]');
    const searchLower = searchTerm.toLowerCase().trim();

    if (!searchTerm.trim()) {
      rows.forEach((row) => (row.style.display = ''));
    } else {
      rows.forEach((row) => {
        const cells = row.querySelectorAll('td');
        let matchFound = false;

        for (let i = 2; i <= 4; i++) {
          if (cells[i] && cells[i].textContent?.toLowerCase().includes(searchLower)) {
            matchFound = true;
            break;
          }
        }

        row.style.display = matchFound ? '' : 'none';
      });
    }

    this.tableComponent.renderTotals();
  }

  private async verifyDownloadsManual(selectedOnly: boolean = false): Promise<void> {
    const facturasToCheck = selectedOnly
      ? this.dataManager.facturas.filter((f) => this.dataManager.selectedFacturas.has(f.id))
      : this.dataManager.facturas;

    if (facturasToCheck.length === 0) {
      this.showNotification('No hay documentos para verificar.', 'warning');
      return;
    }

    try {
      this.dataManager.fileInfo.clear();

      // Buscar descargas completadas que AÚN EXISTEN en el disco
      const downloads = await new Promise<chrome.downloads.DownloadItem[]>((resolve, reject) => {
        chrome.downloads.search(
          { 
            state: 'complete',
            exists: true  // Solo archivos que existen físicamente
          }, 
          (results) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(results);
            }
          }
        );
      });

      if (downloads.length === 0) {
        this.showNotification('❌ No se encontraron descargas existentes en el historial', 'warning');
        return;
      }

      // Crear un mapa de archivos descargados con su información completa
      const downloadMap = new Map<string, chrome.downloads.DownloadItem>();
      downloads.forEach((download) => {
        const fileName = download.filename.split(/[/\\]/).pop();
        if (fileName) {
          downloadMap.set(fileName, download);
        }
      });

      const foundXmlIds: string[] = [];
      const foundPdfIds: string[] = [];
      let xmlDeleted = 0;
      let pdfDeleted = 0;

      // Verificar cada factura
      for (const factura of facturasToCheck) {
        const baseFileName = factura.numero.replace(/ /g, '_');
        const xmlFileName = `${baseFileName}.xml`;
        const pdfFileName = `${baseFileName}.pdf`;

        const xmlDownload = downloadMap.get(xmlFileName);
        const pdfDownload = downloadMap.get(pdfFileName);

        // Verificar XML
        if (xmlDownload && xmlDownload.exists !== false) {
          foundXmlIds.push(factura.id);
        } else if (!xmlDownload) {
          // Buscar en historial completo (incluyendo eliminados)
          const allDownloads = await new Promise<chrome.downloads.DownloadItem[]>((resolve) => {
            chrome.downloads.search({ state: 'complete' }, (results) => {
              resolve(results || []);
            });
          });
          const wasDownloaded = allDownloads.some(
            (d) => d.filename.split(/[/\\]/).pop() === xmlFileName
          );
          if (wasDownloaded) xmlDeleted++;
        }

        // Verificar PDF
        if (pdfDownload && pdfDownload.exists !== false) {
          foundPdfIds.push(factura.id);
        } else if (!pdfDownload) {
          const allDownloads = await new Promise<chrome.downloads.DownloadItem[]>((resolve) => {
            chrome.downloads.search({ state: 'complete' }, (results) => {
              resolve(results || []);
            });
          });
          const wasDownloaded = allDownloads.some(
            (d) => d.filename.split(/[/\\]/).pop() === pdfFileName
          );
          if (wasDownloaded) pdfDeleted++;
        }

        // Guardar información de archivos encontrados
        const fileData: FileInfo = {};
        if (xmlDownload) {
          fileData.xml = { downloadId: xmlDownload.id };
        }
        if (pdfDownload) {
          fileData.pdf = { downloadId: pdfDownload.id };
        }
        if (xmlDownload || pdfDownload) {
          this.dataManager.fileInfo.set(factura.id, fileData);
        }
      }

      // Actualizar la UI con los resultados
      this.dataManager.handleVerificationComplete(
        foundXmlIds,
        foundPdfIds,
        facturasToCheck.length,
        selectedOnly
      );

      // Mensaje detallado
      let mensaje = `✅ Verificación completada: ${foundXmlIds.length} XML, ${foundPdfIds.length} PDF encontrados`;
      if (xmlDeleted > 0 || pdfDeleted > 0) {
        mensaje += ` (${xmlDeleted + pdfDeleted} archivos fueron eliminados del disco)`;
      }
      
      const hasFiles = foundXmlIds.length > 0 || foundPdfIds.length > 0;
      this.showNotification(mensaje, hasFiles ? 'success' : 'warning');
    } catch (error: any) {
      console.error('Error al verificar descargas:', error);
      this.showNotification(`Error: ${error.message}`, 'error');
    }
  }

  private updateDownloadButtonProgress(current: number, total: number): void {
    if (this.downloadBtn) {
      this.downloadBtn.innerHTML = `<span class="btn-text">${current}/${total}...</span>`;
    }
    if (this.cancelBtn && !this.downloadCancelled) {
      this.cancelBtn.style.display = 'flex';
    }

    const downloadedDocsEl = PopupUI.safeGetElement('downloaded-docs');
    if (downloadedDocsEl) {
      downloadedDocsEl.textContent = current.toString();
    }
  }

  private handleDownloadComplete(exitosos: number, fallidos: number, total: number): void {
    if (this.downloadBtn) {
      this.downloadBtn.disabled = false;
      this.downloadBtn.innerHTML = '<span class="btn-text">Descargar</span>';
    }

    const hasSelections = this.dataManager.selectedFacturas.size > 0;
    PopupUI.enableButtonsAfterOperation(hasSelections);

    let message = `Descarga finalizada. ${exitosos} de ${total} archivos descargados.`;
    let type: 'success' | 'warning' | 'error' = 'success';
    if (fallidos > 0) {
      message += ` ${fallidos} fallaron.`;
      type = fallidos === total ? 'error' : 'warning';
    }
    this.showNotification(message, type);

    this.hideCancelButton();

    if (exitosos > 0) {
      setTimeout(() => this.verifyDownloadsManual(true), 1000);
    }
  }

  private hideCancelButton(): void {
    if (this.cancelBtn) {
      this.cancelBtn.style.display = 'none';
    }
  }

  private async descargarSeleccionados(): Promise<void> {
    if (this.dataManager.selectedFacturas.size === 0) {
      this.showNotification('Selecciona al menos un documento para descargar', 'warning');
      return;
    }

    const formato = (document.getElementById('doc-type') as HTMLSelectElement)?.value as FormatoDescarga;

    const visibleRows = this.tbodyEl
      ? Array.from(this.tbodyEl.querySelectorAll<HTMLElement>('tr[data-id]')).filter(
          (row) => row.style.display !== 'none'
        )
      : [];

    let facturasParaDescargar: Documento[];

    if (visibleRows.length > 0 && visibleRows.length < this.dataManager.facturas.length) {
      const visibleIds = new Set(visibleRows.map((row) => row.dataset.id));
      facturasParaDescargar = this.dataManager.facturas.filter(
        (f) => this.dataManager.selectedFacturas.has(f.id) && visibleIds.has(f.id)
      );
    } else {
      facturasParaDescargar = this.dataManager.facturas.filter((f) =>
        this.dataManager.selectedFacturas.has(f.id)
      );
    }

    if (facturasParaDescargar.length === 0) {
      this.showNotification('No hay documentos seleccionados visibles para descargar', 'warning');
      return;
    }

    PopupUI.disableButtonsForOperation();
    this.showCancelButton();
    this.downloadCancelled = false;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) throw new Error('No se pudo encontrar la pestaña activa.');

      let isLoaded = false;
      try {
        const pingResponse = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
        isLoaded = pingResponse && pingResponse.success;
      } catch (e) {
        isLoaded = false;
      }

      if (!isLoaded) {
        throw new Error(
          'La extensión no está cargada. Recarga la página del SRI y busca documentos primero.'
        );
      }

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (facturas, formato) => {
          if ((window as any).sriExtractorInstance) {
            (window as any).sriExtractorInstance.descargarDocumentosSeleccionados(facturas, formato);
          } else {
            console.error('Instancia del extractor no encontrada.');
            chrome.runtime.sendMessage({
              action: 'descargaFinalizada',
              exitosos: 0,
              fallidos: facturas.length,
              total: facturas.length,
            });
          }
        },
        args: [facturasParaDescargar, formato],
      });
    } catch (error: any) {
      console.error('Error al iniciar la descarga:', error);
      this.showNotification(`Error: ${error.message}`, 'error');
      const hasSelections = this.dataManager.selectedFacturas.size > 0;
      PopupUI.enableButtonsAfterOperation(hasSelections);
      this.handleDownloadComplete(0, facturasParaDescargar.length, facturasParaDescargar.length);
    }
  }

  private async startNewSearchRobusta(): Promise<void> {
    PopupUI.disableButtonsForOperation();

    if (this.tableContainerEl) this.tableContainerEl.style.display = 'none';
    if (this.loadingEl) this.loadingEl.style.display = 'block';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        throw new Error('No se pudo obtener la pestaña activa');
      }

      if (!isDomainValid(tab.url || '')) {
        throw new Error('Navega a una página del SRI (*.sri.gob.ec)');
      }

      let pingResponse = null;
      try {
        pingResponse = await sendMessageWithRetry(tab.id, { action: 'ping' }, 1);
      } catch (pingError) {
        throw new Error('No se pudo hacer ping, content script no está cargado');
      }

      if (!pingResponse || !pingResponse.success) {
        // Inyectar scripts
        try {
          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ['assets/css/content.css'],
          }).catch(() => console.log('CSS ya inyectado'));

          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['vendors.js', 'shared.js', 'content/index.js'],
          });

          await esperar(DELAYS.AUTO_SYNC_DELAY);

          pingResponse = null;
          for (let i = 0; i < 3; i++) {
            try {
              pingResponse = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
              if (pingResponse && pingResponse.success) break;
            } catch (e) {
              await esperar(500);
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

      const response = await sendMessageWithRetry(
        tab.id,
        {
          action: 'buscarTodasLasPaginasRobusta',
          config: {
            optimizarPaginacion: true,
            extraerTodos: true,
            mostrarProgreso: true,
          },
        },
        3
      );

      if (!response || !response.success) {
        throw new Error(response.error || 'Error desconocido iniciando búsqueda');
      }
    } catch (error: any) {
      console.error('Error iniciando búsqueda completa:', error);

      let errorMessage = 'Error desconocido';
      if (error.message.includes('Could not establish connection')) {
        errorMessage =
          'La extensión no puede conectar con esta página. Asegúrate de estar en el portal del SRI y recarga la página.';
      } else if (error.message.includes('Receiving end does not exist')) {
        errorMessage = 'Recarga la página del SRI y vuelve a intentar.';
      } else {
        errorMessage = error.message;
      }

      this.showNotification(errorMessage, 'error');

      if (this.tableContainerEl) this.tableContainerEl.style.display = 'block';
      if (this.loadingEl) this.loadingEl.style.display = 'none';

      const hasSelections = this.dataManager.selectedFacturas.size > 0;
      PopupUI.enableButtonsAfterOperation(hasSelections);
    }
  }

  private updateProgressDisplay(progress: ProgressStatus): void {
    if (this.progressFillEl && progress.currentPage && progress.totalPages) {
      const percentage = (progress.currentPage / progress.totalPages) * 100;
      this.progressFillEl.style.width = `${percentage}%`;
    }

    if (progress.documentosEncontrados !== undefined) {
      const totalCountEl = document.getElementById('total-docs');
      if (totalCountEl) {
        totalCountEl.textContent = progress.documentosEncontrados.toString();
      }
    }
  }

  private cancelDownload(): void {
    this.downloadCancelled = true;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'cancelDownload' });
      }
    });

    this.hideCancelButton();
    const hasSelections = this.dataManager.selectedFacturas.size > 0;
    PopupUI.enableButtonsAfterOperation(hasSelections);
  }

  private showCancelButton(): void {
    if (this.cancelBtn) {
      this.cancelBtn.style.display = 'flex';
    }
    if (this.downloadBtn) {
      this.downloadBtn.disabled = true;
      this.downloadBtn.innerHTML = '<i class="fa-solid fa-download" aria-hidden="true"></i>';
    }
  }

  private async openPdfFile(facturaId: string): Promise<void> {
    try {
      const fileInfo = this.dataManager.fileInfo.get(facturaId);
      if (!fileInfo || !fileInfo.pdf) {
        this.showNotification('Información del archivo PDF no encontrada.', 'error');
        return;
      }

      if (fileInfo.pdf.downloadId) {
        chrome.downloads.open(fileInfo.pdf.downloadId);
      } else {
        this.showNotification('No se puede determinar cómo abrir el PDF.', 'error');
      }
    } catch (error) {
      console.error('Error abriendo PDF:', error);
      this.showNotification('Error al abrir el PDF.', 'error');
    }
  }
}

// Estilos adicionales
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeInRow {
    from {
      opacity: 0;
      transform: translateY(5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .progress-bar {
    position: relative;
    overflow: hidden;
  }
  .progress-fill {
    transition: width 0.5s ease-in-out;
  }
  .pdf-icon {
    display: inline-block;
    transition: all 0.2s ease;
  }
  .pdf-icon:hover {
    background-color: #f3f4f6;
    border-radius: 4px;
    transform: scale(1.1);
  }
`;
document.head.appendChild(style);

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
  (window as unknown).facturasManager = new FacturasManager();
});
