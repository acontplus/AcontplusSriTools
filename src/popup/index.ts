// Popup principal - Migrado a TypeScript completamente

import { VERSION, DELAYS, STORAGE_KEYS } from '@shared/constants';
import { StorageManager, onStorageChange } from '@shared/storage';
import { sendMessageWithRetry, updateBadge } from '@shared/messaging';
import { isDomainValid, esperar } from '@shared/utils';
import type { Documento, FormatoDescarga, ProgressStatus } from '@shared/types';

import { DataManager } from './services/data';
import { PopupUI } from './services/ui';
import { DownloadPathsManager } from '@services/download-paths';
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
      } else if (message.action === 'batchDownloadProgress') {
        // Progreso de descarga por lotes
        this.updateBatchDownloadProgress(message.progress);
      } else if (message.action === 'descargaFinalizada') {
        this.handleDownloadComplete(message.exitosos, message.fallidos, message.total, message.saltados);
      } else if (message.action === 'hideCancelButton') {
        this.hideCancelButton();
      } else if (message.action === 'sessionLost') {
        this.hideCancelButton();
        const hasSelections = this.dataManager.selectedFacturas.size > 0;
        PopupUI.enableButtonsAfterOperation(hasSelections);
        this.showNotification(message.message, 'error');
      } else if (message.action === 'sriSlowDetected') {
        // SRI respondiendo lento
        this.showNotification(`🐢 ${message.message}`, 'warning');
      } else if (message.action === 'sriDownDetected') {
        // SRI posiblemente caído
        this.showNotification(`🚫 ${message.message}`, 'error');
      } else if (message.action === 'sriNetworkError') {
        // Error de red con el SRI
        this.showNotification(`🌐 ${message.message}`, 'error');
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
    const configurarRutasBtn = document.querySelector('[data-action="configurar_rutas"]');
    const configBatchBtn = document.querySelector('[data-action="config_batch"]');
    const verificarDescargasBtn = document.querySelector('[data-action="verificar_descargas"]');
    const exportErrorsBtn = document.querySelector('[data-action="export_errors"]');

    if (exportExcelBtn) {
      exportExcelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.dataManager.selectedFacturas.size > 0) {
          this.exportComponent.exportSelected();
          this.hideOptionsPopover();
        }
      });
    }

    if (configurarRutasBtn) {
      configurarRutasBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.openRutasModal();
        this.hideOptionsPopover();
      });
    }

    if (configBatchBtn) {
      configBatchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.openBatchConfigModal();
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

    if (exportErrorsBtn) {
      exportErrorsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.exportFailedDownloads();
        this.hideOptionsPopover();
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

  /**
   * Abre el modal de configuración avanzada de descargas por lotes
   */
  private async openBatchConfigModal(): Promise<void> {
    const modal = document.getElementById('batch-config-modal');
    const content = document.getElementById('batch-config-content');
    
    if (!modal || !content) return;

    //  Cargar configuración actual
    await this.loadBatchConfig();

    // Configurar sliders interactivos
    this.setupBatchConfigSliders();

    // Mostrar modal
    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
      modal.classList.remove('opacity-0');
      content.classList.remove('scale-95');
      content.classList.add('scale-100');
    });

    // Event listeners
    const closeBtn = document.getElementById('close-batch-config');
    const saveBtn = document.getElementById('save-batch-config');
    const resetBtn = document.getElementById('reset-batch-config');

    const closeBatchModal = () => {
      modal.classList.add('opacity-0');
      content.classList.remove('scale-100');
      content.classList.add('scale-95');
      setTimeout(() => modal.classList.add('hidden'), 300);
    };

    closeBtn?.addEventListener('click', closeBatchModal, { once: true });
    saveBtn?.addEventListener('click', async () => {
      await this.saveBatchConfig();
      closeBatchModal();
    }, { once: true });
    resetBtn?.addEventListener('click', () => {
      this.resetBatchConfig();
    }, { once: true });

    // Cerrar con ESC o click fuera
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeBatchModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeBatchModal();
      }
    }, { once: true });
  }

  private setupBatchConfigSliders(): void {
    // Batch Size
    const batchSizeSlider = document.getElementById('batch-size-slider') as HTMLInputElement;
    const batchSizeValue = document.getElementById('batch-size-value');
    if (batchSizeSlider && batchSizeValue) {
      batchSizeSlider.addEventListener('input', () => {
        batchSizeValue.textContent = batchSizeSlider.value;
      });
    }

    // Concurrency
    const concurrencySlider = document.getElementById('concurrency-slider') as HTMLInputElement;
    const concurrencyValue = document.getElementById('concurrency-value');
    if (concurrencySlider && concurrencyValue) {
      concurrencySlider.addEventListener('input', () => {
        concurrencyValue.textContent = concurrencySlider.value;
      });
    }

    // Batch Delay
    const batchDelaySlider = document.getElementById('batch-delay-slider') as HTMLInputElement;
    const batchDelayValue = document.getElementById('batch-delay-value');
    if (batchDelaySlider && batchDelayValue) {
      batchDelaySlider.addEventListener('input', () => {
        batchDelayValue.textContent = `${batchDelaySlider.value}ms`;
      });
    }

    // Max Retries
    const maxRetriesSlider = document.getElementById('max-retries-slider') as HTMLInputElement;
    const maxRetriesValue = document.getElementById('max-retries-value');
    if (maxRetriesSlider && maxRetriesValue) {
      maxRetriesSlider.addEventListener('input', () => {
        maxRetriesValue.textContent = maxRetriesSlider.value;
      });
    }
  }

  private async loadBatchConfig(): Promise<void> {
    try {
      const config = await StorageManager.get<any>(STORAGE_KEYS.DOWNLOAD_CONFIG);
      
      const batchSizeSlider = document.getElementById('batch-size-slider') as HTMLInputElement;
      const concurrencySlider = document.getElementById('concurrency-slider') as HTMLInputElement;
      const batchDelaySlider = document.getElementById('batch-delay-slider') as HTMLInputElement;
      const maxRetriesSlider = document.getElementById('max-retries-slider') as HTMLInputElement;
      const notificationsCheck = document.getElementById('enable-notifications') as HTMLInputElement;

      if (config) {
        if (batchSizeSlider) {
          batchSizeSlider.value = config.batchSize?.toString() || '15';
          document.getElementById('batch-size-value')!.textContent = batchSizeSlider.value;
        }
        if (concurrencySlider) {
          concurrencySlider.value = config.concurrency?.toString() || '5';
          document.getElementById('concurrency-value')!.textContent = concurrencySlider.value;
        }
        if (batchDelaySlider) {
          batchDelaySlider.value = config.delayBetweenBatches?.toString() || '2000';
          document.getElementById('batch-delay-value')!.textContent = `${batchDelaySlider.value}ms`;
        }
        if (maxRetriesSlider) {
          maxRetriesSlider.value = config.maxRetries?.toString() || '3';
          document.getElementById('max-retries-value')!.textContent = maxRetriesSlider.value;
        }
        if (notificationsCheck) {
          notificationsCheck.checked = config.enableNotifications !== false;
        }
      }
    } catch (error) {
      console.error('Error cargando configuración de lotes:', error);
    }
  }

  private async saveBatchConfig(): Promise<void> {
    const batchSize = parseInt((document.getElementById('batch-size-slider') as HTMLInputElement).value);
    const concurrency = parseInt((document.getElementById('concurrency-slider') as HTMLInputElement).value);
    const delayBetweenBatches = parseInt((document.getElementById('batch-delay-slider') as HTMLInputElement).value);
    const maxRetries = parseInt((document.getElementById('max-retries-slider') as HTMLInputElement).value);
    const enableNotifications = (document.getElementById('enable-notifications') as HTMLInputElement).checked;

    const config = {
      batchSize,
      concurrency,
      delayBetweenBatches,
      maxRetries,
      retryDelay: 1000, // Fixed base retry delay
      enableNotifications,
    };

    try {
      await StorageManager.set(STORAGE_KEYS.DOWNLOAD_CONFIG, config);
      this.showNotification('✅ Configuración guardada correctamente', 'success');
    } catch (error) {
      console.error('Error guardando configuración:', error);
      this.showNotification('❌ Error guardando configuración', 'error');
    }
  }

  private resetBatchConfig(): void {
    (document.getElementById('batch-size-slider') as HTMLInputElement).value = '15';
    (document.getElementById('concurrency-slider') as HTMLInputElement).value = '5';
    (document.getElementById('batch-delay-slider') as HTMLInputElement).value = '2000';
    (document.getElementById('max-retries-slider') as HTMLInputElement).value = '3';
    (document.getElementById('enable-notifications') as HTMLInputElement).checked = true;

    // Actualizar valores mostrados
    document.getElementById('batch-size-value')!.textContent = '15';
    document.getElementById('concurrency-value')!.textContent = '5';
    document.getElementById('batch-delay-value')!.textContent = '2000ms';
    document.getElementById('max-retries-value')!.textContent = '3';

    this.showNotification('⚙️ Configuración restablecida a valores por defecto', 'info');
  }

  /**
   * Exporta documentos fallidos a archivo JSON
   */
  private async exportFailedDownloads(): Promise<void> {
    try {
      const session = await StorageManager.get<any>(STORAGE_KEYS.DOWNLOAD_SESSION);
      
      if (!session || !session.failed || session.failed.length === 0) {
        this.showNotification('No hay documentos fallidos para exportar', 'info');
        return;
      }

      const failedDocs = session.failed.map((job: any) => ({
        numero: job.documento.numero,
        ruc: job.documento.ruc,
        razonSocial: job.documento.razonSocial,
        fecha: job.documento.fecha,
        total: job.documento.total,
        formato: job.formato,
        intentos: job.retryCount,
        error: job.error || 'Desconocido',
      }));

      const jsonContent = JSON.stringify(failedDocs, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `errores_descarga_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showNotification(`✅ Exportados ${failedDocs.length} documentos fallidos`, 'success');
    } catch (error) {
      console.error('Error exportando errores:', error);
      this.showNotification('❌ Error al exportar documentos fallidos', 'error');
    }
  }

  // ===================== DOWNLOAD PATHS MANAGEMENT =====================

  /**
   * Abrir modal de gestión de rutas
   */
  private async openRutasModal(): Promise<void> {
    const modal = document.getElementById('rutas-modal');
    const content = document.getElementById('rutas-modal-content');
    
    if (!modal || !content) return;

    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
      modal.classList.remove('opacity-0');
      content.classList.remove('scale-95');
      content.classList.add('scale-100');
    });

    await this.loadSavedPaths();
    this.setupRutasModalListeners();
  }

  /**
   * Cerrar modal de rutas
   */
  private closeRutasModal(): void {
    const modal = document.getElementById('rutas-modal');
    const content = document.getElementById('rutas-modal-content');
    
    if (!modal || !content) return;

    modal.classList.add('opacity-0');
    content.classList.remove('scale-100');
    content.classList.add('scale-95');
    setTimeout(() => {
      modal.classList.add('hidden');
    }, 300);
  }

  /**
   * Cargar rutas guardadas y mostrarlas
   */
  private async loadSavedPaths(): Promise<void> {
    try {
      const pathsManager = new DownloadPathsManager();
      const config = await pathsManager.getConfig();

      // Actualizar selector de ruta activa
      const rutaActivaSelect = document.getElementById('ruta-activa-select') as HTMLSelectElement;
      if (rutaActivaSelect) {
        // Limpiar opciones dinámicas previas
        const options = Array.from(rutaActivaSelect.options);
        options.forEach((option) => {
          if (option.value !== 'default' && option.value !== 'ask') {
            option.remove();
          }
        });

        // Agregar rutas como opciones
        config.paths.forEach((path) => {
          const option = document.createElement('option');
          option.value = path.id;
          option.textContent = path.path;
          rutaActivaSelect.appendChild(option);
        });

        // Seleccionar la ruta activa
        rutaActivaSelect.value = config.activePathId;
      }

      // Renderizar lista de rutas
      this.renderPathsList(config.paths);
      this.updatePathsCount(config.paths.length);
    } catch (error) {
      console.error('Error cargando rutas:', error);
      this.showNotification('❌ Error al cargar rutas guardadas', 'error');
    }
  }

  /**
   * Renderizar lista de rutas favoritas
   */
  private renderPathsList(paths: import('@shared/types').DownloadPath[]): void {
    const rutasList = document.getElementById('rutas-list');
    if (!rutasList) return;

    if (paths.length === 0) {
      rutasList.innerHTML = `
        <p class="text-sm text-gray-500 text-center py-4">
          No hay rutas favoritas guardadas.<br/>
          Agrega una nueva ruta abajo.
        </p>
      `;
      return;
    }

    rutasList.innerHTML = paths
      .map(
        (path) => `
      <div class="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:shadow-md transition duration-200" data-path-id="${path.id}">
        <div class="flex-1">
          <div class="text-xs text-gray-500 font-mono mt-1">
            Downloads/${path.path}
          </div>
        </div>
        <button
          class="remove-path-btn px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition duration-200"
          data-path-id="${path.id}"
          title="Eliminar ruta"
        >
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `
      )
      .join('');

    // Agregar event listeners a botones de eliminar
    const removeButtons = rutasList.querySelectorAll('.remove-path-btn');
    removeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const pathId = btn.getAttribute('data-path-id');
        if (pathId) this.removePath(pathId);
      });
    });
  }

  /**
   * Actualizar contador de rutas
   */
  private updatePathsCount(count: number): void {
    const pathsCount = document.getElementById('paths-count');
    if (pathsCount) pathsCount.textContent = `${count ?? 0}`;
  }

  /**
   * Setup listeners para el modal de rutas
   */
  private setupRutasModalListeners(): void {
    const modal = document.getElementById('rutas-modal');
    
    // Close buttons
    const closeBtn = document.getElementById('close-rutas-modal');
    const closeFooterBtn = document.getElementById('close-rutas-modal-footer');

    // Remover listeners previos y agregar nuevos
    const closeFn = () => this.closeRutasModal();
    closeBtn?.removeEventListener('click', closeFn);
    closeFooterBtn?.removeEventListener('click', closeFn);
    closeBtn?.addEventListener('click', closeFn);
    closeFooterBtn?.addEventListener('click', closeFn);

    // Cerrar al hacer click en el backdrop
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeRutasModal();
      }
    });

    // Add path button
    const addBtn = document.getElementById('add-ruta-btn');
    addBtn?.addEventListener('click', () => this.addNewPath());

    // Active path selector
    const rutaActivaSelect = document.getElementById('ruta-activa-select') as HTMLSelectElement;
    rutaActivaSelect?.addEventListener('change', async () => {
      try {
        const pathsManager = new DownloadPathsManager();
        await pathsManager.setActivePath(rutaActivaSelect.value);
        this.showNotification('✅ Ruta de descarga actualizada', 'success');
      } catch (error) {
        console.error('Error actualizando ruta activa:', error);
        this.showNotification('❌ Error al actualizar ruta', 'error');
      }
    });
  }

  /**
   * Agregar nueva ruta
   */
  private async addNewPath(): Promise<void> {
    const pathInput = document.getElementById('nueva-ruta-path') as HTMLInputElement;

    if (!pathInput) return;

    const path = pathInput.value.trim();

    if (!path) {
      this.showNotification('⚠️ Por favor completa el campo', 'warning');
      return;
    }

    try {
      const pathsManager = new DownloadPathsManager();
      await pathsManager.addPath(path);

      // Limpiar inputs
      pathInput.value = '';

      // Recargar lista
      await this.loadSavedPaths();

      this.showNotification(`✅ Ruta "${name}" agregada correctamente`, 'success');
    } catch (error) {
      console.error('Error agregando ruta:', error);
      this.showNotification('❌ Error al agregar ruta', 'error');
    }
  }

  /**
   * Eliminar ruta
   */
  private async removePath(pathId: string): Promise<void> {
    if (!confirm('¿Está seguro de eliminar esta ruta?')) return;

    try {
      const pathsManager = new DownloadPathsManager();
      await pathsManager.removePath(pathId);

      // Recargar lista
      await this.loadSavedPaths();

      this.showNotification('✅ Ruta eliminada correctamente', 'success');
    } catch (error) {
      console.error('Error eliminando ruta:', error);
      this.showNotification('❌ Error al eliminar ruta', 'error');
    }
  }

  // ===================== END DOWNLOAD PATHS MANAGEMENT =====================

  public showNotification(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    this.notificationComponent.showNotification(message, type);
  }

  public async updateCounts(): Promise<void> {
    await this.tableComponent.updateCounts();
  }

  public renderTable(): void {
    this.tableComponent.renderTable();
  }

  public async updateDisplay(): Promise<void> {
    await this.updateCounts();
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
    const facturasToCheck = selectedOnly ? this.dataManager.facturas.filter((f) => this.dataManager.selectedFacturas.has(f.id)) : this.dataManager.facturas;

    console.log('Debug: selectedOnly', selectedOnly);
    console.log('facturasToCheck', facturasToCheck);

    if (facturasToCheck.length === 0) {
      this.showNotification('No hay documentos para verificar.', 'warning');
      return;
    }

    try {
      this.dataManager.fileInfo.clear();

      // FIX: Force Chrome to update file existence cache
      // The 'exists' property is often stale. The first search triggers a background check.
      // We perform a "warm-up" search and wait a bit to ensure the cache is updated.
      await new Promise<void>((resolve) => {
        chrome.downloads.search({ state: 'complete', exists: true }, () => resolve());
      });
      
      await esperar(200);

      // OPTIMIZACIÓN: Obtener TODOS los downloads una sola vez
      const [existingDownloads, allDownloads] = await Promise.all([
        // 1. Archivos que existen físicamente
        new Promise<chrome.downloads.DownloadItem[]>((resolve, reject) => {
          chrome.downloads.search(
            { 
              state: 'complete',
              exists: true  // Solo archivos que existen físicamente
            }, 
            (results) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(results || []);
              }
            }
          );
        }),
        // 2. Historial completo (para detectar eliminados)
        new Promise<chrome.downloads.DownloadItem[]>((resolve) => {
          chrome.downloads.search({ state: 'complete' }, (results) => {
            resolve(results || []);
          });
        })
      ]);

      if (existingDownloads.length === 0 && allDownloads.length === 0) {
        this.showNotification('❌ No se encontraron descargas en el historial', 'warning');
        return;
      }

      // Crear mapas para lookup rápido
      const existingFilesMap = new Map<string, chrome.downloads.DownloadItem>();
      existingDownloads.forEach((download) => {
        const fileName = download.filename.split(/[/\\]/).pop();
        if (fileName) {
          existingFilesMap.set(fileName, download);
        }
      });

      const allFilesMap = new Map<string, chrome.downloads.DownloadItem>();
      allDownloads.forEach((download) => {
        const fileName = download.filename.split(/[/\\]/).pop();
        if (fileName) {
          allFilesMap.set(fileName, download);
        }
      });

      const foundXmlIds: string[] = [];
      const foundPdfIds: string[] = [];
      let xmlDeleted = 0;
      let pdfDeleted = 0;

      // ALGORITMO SOFISTICADO: Verificar cada factura con detección precisa de estados
      for (const factura of facturasToCheck) {
        const baseFileName = factura.numero.replace(/ /g, '_');
        const xmlFileName = `${baseFileName}.xml`;
        const pdfFileName = `${baseFileName}.pdf`;

        // === ANÁLISIS SOFISTICADO DE XML ===
        const xmlInExisting = existingFilesMap.get(xmlFileName);
        const xmlInHistory = allFilesMap.get(xmlFileName);
        
        let xmlStatus: import('@shared/types').FileStatus;
        let xmlExists = false;
        let xmlWasDownloaded = false;

        if (xmlInExisting && xmlInExisting.exists !== false) {
          // ✅ Archivo existe físicamente
          xmlStatus = 'exists';
          xmlExists = true;
          xmlWasDownloaded = true;
          foundXmlIds.push(factura.id);
        } else if (xmlInHistory && !xmlInExisting) {
          // ❌ Fue descargado pero eliminado del disco
          xmlStatus = 'deleted';
          xmlExists = false;
          xmlWasDownloaded = true;
          xmlDeleted++;
        } else if (xmlInHistory && xmlInHistory.exists === false) {
          // ❌ Descargado pero marcado como no existente
          xmlStatus = 'deleted';
          xmlExists = false;
          xmlWasDownloaded = true;
          xmlDeleted++;
        } else {
          // ⚪ Nunca fue descargado
          xmlStatus = 'never_downloaded';
          xmlExists = false;
          xmlWasDownloaded = false;
        }

        // === ANÁLISIS SOFISTICADO DE PDF ===
        const pdfInExisting = existingFilesMap.get(pdfFileName);
        const pdfInHistory = allFilesMap.get(pdfFileName);
        
        let pdfStatus: import('@shared/types').FileStatus;
        let pdfExists = false;
        let pdfWasDownloaded = false;

        if (pdfInExisting && pdfInExisting.exists !== false) {
          // ✅ Archivo existe físicamente
          pdfStatus = 'exists';
          pdfExists = true;
          pdfWasDownloaded = true;
          foundPdfIds.push(factura.id);
        } else if (pdfInHistory && !pdfInExisting) {
          // ❌ Fue descargado pero eliminado del disco
          pdfStatus = 'deleted';
          pdfExists = false;
          pdfWasDownloaded = true;
          pdfDeleted++;
        } else if (pdfInHistory && pdfInHistory.exists === false) {
          // ❌ Descargado pero marcado como no existente
          pdfStatus = 'deleted';
          pdfExists = false;
          pdfWasDownloaded = true;
          pdfDeleted++;
        } else {
          // ⚪ Nunca fue descargado
          pdfStatus = 'never_downloaded';
          pdfExists = false;
          pdfWasDownloaded = false;
        }

        // Guardar información DETALLADA de archivos
        const fileData: import('@shared/types').FileInfo = {};
        
        if (xmlInExisting || xmlInHistory) {
          fileData.xml = {
            downloadId: xmlInExisting?.id || xmlInHistory?.id,
            path: xmlInExisting?.filename || xmlInHistory?.filename,
            status: xmlStatus,
            exists: xmlExists,
            wasDownloaded: xmlWasDownloaded,
            fileSize: xmlInExisting?.fileSize,
            lastModified: xmlInExisting?.startTime ? new Date(xmlInExisting.startTime).getTime() : undefined,
          };
        }

        if (pdfInExisting || pdfInHistory) {
          fileData.pdf = {
            downloadId: pdfInExisting?.id || pdfInHistory?.id,
            path: pdfInExisting?.filename || pdfInHistory?.filename,
            status: pdfStatus,
            exists: pdfExists,
            wasDownloaded: pdfWasDownloaded,
            fileSize: pdfInExisting?.fileSize,
            lastModified: pdfInExisting?.startTime ? new Date(pdfInExisting.startTime).getTime() : undefined,
          };
        }

        // Solo guardar si hay información disponible
        if (fileData.xml || fileData.pdf) {
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

      // Mensaje detallado y sofisticado
      const totalChecked = facturasToCheck.length;
      const totalDeleted = xmlDeleted + pdfDeleted;
      const totalExisting = foundXmlIds.length + foundPdfIds.length;
      
      let mensaje = `✅ Verificación completada:\n`;
      mensaje += `  📊 ${totalChecked} documentos verificados\n`;
      mensaje += `  ✅ ${foundXmlIds.length} XML existentes | ${foundPdfIds.length} PDF existentes\n`;
      
      if (totalDeleted > 0) {
        mensaje += `  ❌ ${xmlDeleted} XML eliminados | ${pdfDeleted} PDF eliminados`;
      }
      
      const hasFiles = foundXmlIds.length > 0 || foundPdfIds.length > 0;
      this.showNotification(mensaje, hasFiles ? 'success' : 'warning');
      
      // Log detallado en consola para debugging
      console.log('📋 Resumen de verificación:');
      console.log(`   Total: ${totalChecked} documentos`);
      console.log(`   ✅ Existentes: ${totalExisting} archivos (${foundXmlIds.length} XML, ${foundPdfIds.length} PDF)`);
      console.log(`   ❌ Eliminados: ${totalDeleted} archivos (${xmlDeleted} XML, ${pdfDeleted} PDF)`);
      console.log(`   ⚪ Nunca descargados: ${(totalChecked * 2) - totalExisting - totalDeleted} archivos`);
      
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

  /**
   * Actualiza progreso de descarga por lotes con información detallada
   */
  private updateBatchDownloadProgress(progress: any): void {
    if (!progress) return;

    // Actualizar botón con información de lote
    if (this.downloadBtn) {
      const { currentBatch, totalBatches, completedDocs, pendingDocs, currentSpeed, estimatedTimeRemaining } = progress;
      
      // Formatear tiempo restante
      const formatTime = (seconds: number): string => {
        if (seconds < 60) return `${Math.round(seconds)}s`;
        const mins = Math.floor(seconds / 60);
        return `~${mins} min`;
      };

      const speedText = currentSpeed > 0 ? ` | ${currentSpeed} docs/min` : '';
      const etaText = estimatedTimeRemaining > 0 ? ` | ${formatTime(estimatedTimeRemaining)} restante` : '';
      
      this.downloadBtn.innerHTML = `<span class="btn-text">Lote ${currentBatch}/${totalBatches} | ${completedDocs}/${completedDocs + pendingDocs}${speedText}${etaText}</span>`;

      // Actualizar contador de descargados
      const downloadedDocsEl = PopupUI.safeGetElement('downloaded-docs');
      if (downloadedDocsEl) {
        downloadedDocsEl.textContent = completedDocs.toString();
      }
    }

    if (this.cancelBtn && !this.downloadCancelled) {
      this.cancelBtn.style.display = 'flex';
    }
  }

  private handleDownloadComplete(exitosos: number, fallidos: number, total: number, saltados?: number): void {
    if (this.downloadBtn) {
      this.downloadBtn.disabled = false;
      this.downloadBtn.innerHTML = '<span class="btn-text">Descargar</span>';
    }

    const hasSelections = this.dataManager.selectedFacturas.size > 0;
    PopupUI.enableButtonsAfterOperation(hasSelections);

    let message = `Descarga finalizada. ${exitosos} de ${total} archivos descargados.`;
    let type: 'success' | 'warning' | 'error' = 'success';
    
    if (saltados && saltados > 0) {
      message += ` ${saltados} ya existían.`;
    }
    
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

    // Resetear contador de descargas de sesión al iniciar nuevo escaneo
    if (typeof (window as any).downloadCounter !== 'undefined') {
      await (window as any).downloadCounter.resetSessionCount();
    }

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
  (window as any).facturasManager = new FacturasManager();
});
