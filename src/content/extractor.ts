// Extractor principal - Migrado a TypeScript

import { VERSION, SELECTORS } from '@shared/constants';
import { StorageManager } from '@shared/storage';
import { MessageListener } from '@shared/messaging';
import type {
  Documento,
  PaginationInfo,
  HeaderMap,
  TipoEmision,
  TipoComprobante,
  ExtractResult,
  SessionStatus,
} from '@shared/types';
import { SRIPagination } from './pagination';
import { SRIDownloader } from './downloader';

export class SRIDocumentosExtractor {
  public documentos: Documento[] = [];
  public allDocuments: Documento[] = [];
  public tablaDetectada: HTMLElement | null = null;
  public tipoComprobante: TipoComprobante | null = null;
  public version = VERSION;
  public paginationInfo: PaginationInfo = { current: 1, total: 1 };
  public isProcessingPagination = false;
  public currentPage = 1;
  public totalPages = 1;
  public headerMap: HeaderMap = {};

  // Variables para paginación robusta
  public tipo_emisi: TipoEmision = 'CompRecibidos';
  public movimiento: 'REPAGINAR' | 'PROCESAR' = 'PROCESAR';
  public regs_total = 0;
  public intentos = 0;
  public view_state = '';
  public body_tabla: HTMLElement | null = null;
  public fila_tabla: HTMLElement | null = null;

  public pagination: SRIPagination;
  public downloader: SRIDownloader;
  private messageListener: MessageListener;

  constructor() {
    this.pagination = new SRIPagination(this);
    this.downloader = new SRIDownloader(this);
    this.messageListener = new MessageListener();
    this.init();
  }

  private init(): void {
    this.setupMessageListener();
    this.detectarTipoEmisionRobusta();
    this.detectCurrentPagination();
  }

  private setupMessageListener(): void {
    this.messageListener.on('ping', async () => ({
      success: true,
      message: 'Content script activo',
      version: this.version,
      url: window.location.href,
      ready: true,
    }));

    this.messageListener.on('buscarTodasLasPaginasSRIeload', async (message) => {
      return await this.pagination.procesarTodasLasPaginasRobusta(message.config || {});
    });

    this.messageListener.on('buscarTodasLasPaginasRobusta', async (message) => {
      return await this.pagination.procesarTodasLasPaginasRobusta(message.config || {});
    });

    this.messageListener.on('getPaginationInfo', async () => {
      const paginationInfo = this.pagination.getPaginationInfoRobusta();
      return {
        success: true,
        currentPage: paginationInfo.current,
        totalPages: paginationInfo.total,
      };
    });

    this.messageListener.on('extractCurrentPage', async () => {
      return await this.extractCurrentPageData();
    });

    this.messageListener.on('checkSession', async () => {
      return this.checkSessionStatus();
    });

    this.messageListener.on('cancelDownload', async () => {
      this.downloader.cancelDownload();
      return { success: true, message: 'Descarga cancelada' };
    });
  }

  public detectarTipoEmisionRobusta(): void {
    try {
      const tablaRecibidos = document.querySelector<HTMLElement>(SELECTORS.TABLA_RECIBIDOS);
      const tablaEmitidos = document.querySelector<HTMLElement>(SELECTORS.TABLA_EMITIDOS);

      if (tablaRecibidos && tablaRecibidos.childElementCount > 0) {
        this.tipo_emisi = 'CompRecibidos';
        this.body_tabla = tablaRecibidos;
      } else if (tablaEmitidos && tablaEmitidos.childElementCount > 0) {
        this.tipo_emisi = 'CompEmitidos';
        this.body_tabla = tablaEmitidos;
      } else {
        if (window.location.href.includes('recibidos')) {
          this.tipo_emisi = 'CompRecibidos';
        } else {
          this.tipo_emisi = 'CompEmitidos';
        }
      }
    } catch (error) {
      console.warn('❌ Error detectando tipo emisión:', error);
      this.tipo_emisi = 'CompEmitidos';
    }
  }

  public detectCurrentPagination(): void {
    this.pagination.detectCurrentPagination();
  }

  public async extractCurrentPageData(): Promise<ExtractResult> {
    try {
      const resultado = this.pagination.detectarTablaRobusta();
      if (!resultado.encontrada) {
        throw new Error('No se encontró tabla de comprobantes');
      }

      this.tipoComprobante = resultado.tipo || null;
      this.tablaDetectada = resultado.tabla || null;
      if (resultado.tabla && this.tipoComprobante) {
        this.extraerDocumentos(resultado.tabla, this.tipoComprobante);
      }
      this.paginationInfo = this.pagination.getPaginationInfoRobusta();

      return {
        success: true,
        documentos: this.documentos,
        tipoComprobante: this.tipoComprobante || undefined,
        paginationInfo: this.paginationInfo,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  public extraerDocumentos(tbody: HTMLElement, tipoComprobante: TipoComprobante): void {
    const regsTotal = tbody.childElementCount;
    this.documentos = [];

    // Obtener número de página actual
    const currentPageNumber = this.getCurrentPageNumber();

    const tablaElement = tbody.closest('table');
    if (tablaElement) {
      this.pagination.mapearCabeceras(tablaElement);
    } else {
      console.error('No se encontró el elemento <table> padre para mapear cabeceras.');
      return;
    }

    for (let i = 0; i < regsTotal; i++) {
      try {
        const fila = tbody.getElementsByTagName('tr')[i];
        const numeroCelda = fila.querySelector('.ui-dt-c');
        if (!numeroCelda) continue;

        const regsActual = Number(numeroCelda.innerHTML) - 1;
        const filaEspecifica = tbody.querySelector<HTMLElement>(`tr[data-ri="${regsActual}"]`);

        if (filaEspecifica) {
          const celdas = filaEspecifica.querySelectorAll<HTMLElement>('td[role="gridcell"]');
          if (celdas.length >= 8) {
            const documento = this.pagination.extraerDatosFilaEspecifica(
              celdas,
              tipoComprobante,
              i,
              regsActual,
              currentPageNumber
            );
            if (documento) {
              this.documentos.push(documento);
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error extrayendo fila ${i}:`, error);
      }
    }

    this.guardarDatos();
  }

  /**
   * Obtiene el número de página actual del paginador del SRI
   */
  private getCurrentPageNumber(): number {
    try {
      const paginatorSelector = `#frmPrincipal\\:tabla${this.tipo_emisi}_paginator_bottom`;
      const paginator = document.querySelector(paginatorSelector);

      if (paginator) {
        const current = paginator.querySelector('.ui-paginator-current');
        if (current) {
          const text = current.textContent || '';
          
          // Buscar patrón "(X de Y)"
          const pageMatch = text.match(/\((\d+)\s+de\s+(\d+)\)/);
          if (pageMatch) {
            return parseInt(pageMatch[1]);
          }
          
          // Alternativa: calcular basándose en registros
          const rangeMatch = text.match(/(\d+)\s*-\s*(\d+)\s+de\s+(\d+)/);
          if (rangeMatch) {
            const startRecord = parseInt(rangeMatch[1]);
            const endRecord = parseInt(rangeMatch[2]);
            const recordsPerPage = endRecord - startRecord + 1;
            return Math.ceil(startRecord / recordsPerPage);
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Error obteniendo número de página:', error);
    }
    return 1;
  }

  public guardarDatos(): void {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        StorageManager.saveDocuments(this.documentos);
        console.log('✅ Datos guardados:', this.documentos.length, 'documentos');
      } else {
        console.warn('⚠️ chrome.storage no disponible, usando localStorage');
        const dataToStore = {
          facturasData: this.documentos,
          lastExtraction: new Date().toISOString(),
        };
        localStorage.setItem('acontplus_sri_data', JSON.stringify(dataToStore));
        this.sendDataToBackground();
      }
    } catch (error) {
      console.warn('❌ Error guardando datos:', error);
      (window as any).acontplusSRIData = {
        facturasData: this.documentos,
        lastExtraction: new Date().toISOString(),
      };
    }
  }

  private sendDataToBackground(): void {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage(
          {
            action: 'storeData',
            data: {
              facturasData: this.documentos,
              lastExtraction: new Date().toISOString(),
            },
          },
          () => {
            if (chrome.runtime.lastError) {
              console.warn('⚠️ Error enviando datos al background:', chrome.runtime.lastError);
            } else {
              console.log('✅ Datos enviados al background script');
            }
          }
        );
      }
    } catch (error) {
      console.warn('⚠️ Error enviando mensaje al background:', error);
    }
  }

  public async updateProgress(progress: string): Promise<void> {
    try {
      await StorageManager.saveProgress({
        mensaje: progress,
        documentosEncontrados: this.allDocuments.length,
        currentPage: this.currentPage,
        totalPages: this.totalPages,
      });
    } catch (error) {
      console.warn('No se pudo actualizar progreso:', error);
    }
  }

  public checkSessionStatus(): SessionStatus {
    try {
      // Verificar mensajes de sesión expirada
      const sessionExpiredSelectors = [
        '.ui-messages-error',
        '[id*="session"]',
        '.alert-danger',
        '.error-message',
      ];

      for (const selector of sessionExpiredSelectors) {
        const elements = Array.from(document.querySelectorAll(selector));
        for (const element of elements) {
          const text = element.textContent?.toLowerCase() || '';
          if (
            text.includes('sesión') &&
            (text.includes('expir') || text.includes('caduc') || text.includes('finaliz'))
          ) {
            return {
              success: false,
              sessionActive: false,
              message: 'Sesión expirada detectada',
              details: element.textContent?.trim(),
            };
          }
        }
      }

      // Verificar elementos que indican sesión activa
      const sessionActiveSelectors = [
        SELECTORS.TABLA_RECIBIDOS,
        SELECTORS.TABLA_EMITIDOS,
        '.ui-menu',
        '[id*="usuario"]',
        '.user-info',
        'a[href*="logout"]',
        'a[href*="cerrar"]',
      ];

      let activeIndicators = 0;
      for (const selector of sessionActiveSelectors) {
        if (document.querySelector(selector)) {
          activeIndicators++;
        }
      }

      // Verificar si estamos en página de login
      const loginSelectors = [
        'input[type="password"]',
        '#loginForm',
        '[id*="login"]',
        '.login-form',
      ];

      let loginIndicators = 0;
      for (const selector of loginSelectors) {
        if (document.querySelector(selector)) {
          loginIndicators++;
        }
      }

      if (loginIndicators > 0 && activeIndicators === 0) {
        return {
          success: true,
          sessionActive: false,
          message: 'Usuario no ha iniciado sesión',
          details: 'Página de login detectada',
        };
      } else if (activeIndicators > 0) {
        return {
          success: true,
          sessionActive: true,
          message: 'Sesión activa detectada',
          details: `${activeIndicators} indicadores de sesión activa encontrados`,
        };
      } else {
        return {
          success: true,
          sessionActive: false,
          message: 'Estado de sesión indeterminado',
          details: 'No se encontraron indicadores claros de sesión',
        };
      }
    } catch (error) {
      console.error('Error verificando estado de sesión:', error);
      return {
        success: false,
        sessionActive: false,
        message: 'Error al verificar sesión',
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  // Delegar métodos de descarga
  public async verificarDescargasEnPagina(facturas: Documento[]): Promise<void> {
    return this.downloader.verificarDescargasEnPagina(facturas);
  }

  public async descargarDocumentosSeleccionados(
    facturas: Documento[],
    formato: 'xml' | 'pdf' | 'both'
  ): Promise<void> {
    return this.downloader.descargarDocumentosSeleccionados(facturas, formato);
  }
}

// Exportar globalmente para compatibilidad
if (typeof window !== 'undefined') {
  (window as any).SRIDocumentosExtractor = SRIDocumentosExtractor;
}
