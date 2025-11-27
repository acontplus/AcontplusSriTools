// Módulo de paginación - Migrado a TypeScript

import { SELECTORS, DELAYS, LIMITS } from '@shared/constants';
import { StorageManager } from '@shared/storage';
import { SRIUtils } from '@shared/utils';
import type {
  Documento,
  PaginationInfo,
  TipoComprobante,
  SearchConfig,
  SearchResult,
  SearchSummary,
} from '@shared/types';
import type { SRIDocumentosExtractor } from './extractor';

export class SRIPagination {
  constructor(private extractor: SRIDocumentosExtractor) {}

  async procesarTodasLasPaginasRobusta(config: SearchConfig = {}): Promise<SearchResult> {
    if (this.extractor.isProcessingPagination) {
      return { success: false, error: 'Búsqueda ya en progreso' };
    }

    this.extractor.isProcessingPagination = true;
    this.extractor.allDocuments = [];
    this.extractor.movimiento = config.optimizarPaginacion ? 'REPAGINAR' : 'PROCESAR';

    try {
      const resultadoInicial = this.detectarTablaRobusta();

      if (!resultadoInicial.encontrada) {
        throw new Error('Por favor, consulte los comprobantes en el SRI antes de proceder con el escaneo');
      }

      this.extractor.tipoComprobante = resultadoInicial.tipo || null;
      const tipoTexto = this.extractor.tipoComprobante === 'R' ? 'RECIBIDOS' : 'EMITIDOS';

      await this.ejecutarLogicaDescargaRobusta();

      const resumenFinal: SearchSummary = {
        documentosEncontrados: this.extractor.allDocuments.length,
        paginasProcesadas: this.extractor.totalPages,
        tipoComprobante: tipoTexto,
        optimizacionAplicada: this.extractor.movimiento === 'REPAGINAR',
      };

      await this.guardarResultadoFinalCompleto(resumenFinal);
      this.extractor.isProcessingPagination = false;

      return {
        success: true,
        message: `Búsqueda completa finalizada: ${this.extractor.allDocuments.length} documentos encontrados`,
        allDocuments: this.extractor.allDocuments,
        paginationInfo: { current: this.extractor.totalPages, total: this.extractor.totalPages },
        totalPages: this.extractor.totalPages,
        optimization: resumenFinal.optimizacionAplicada
          ? { optimized: true, message: 'Páginas optimizadas' }
          : { optimized: false },
      };
    } catch (error) {
      console.error('❌ Error en búsqueda completa:', error);
      this.extractor.isProcessingPagination = false;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  private async ejecutarLogicaDescargaRobusta(): Promise<void> {
    if (this.extractor.movimiento === 'REPAGINAR') {
      await this.aplicarRepaginacionRobusta();
      this.extractor.movimiento = 'PROCESAR';
    }
    await this.procesarPaginasRecursivamente();
  }

  private async aplicarRepaginacionRobusta(): Promise<boolean> {
    try {
      const paginatorSelector = `#frmPrincipal\\:tabla${this.extractor.tipo_emisi}_paginator_bottom`;
      const paginator = document.querySelector(paginatorSelector);

      if (paginator) {
        const current = paginator.querySelector(SELECTORS.PAGINATOR_CURRENT);
        if (current) {
          const matches = current.textContent?.match(/\d+/g);
          if (matches) {
            const pa = parseInt(matches[1]);
            if (pa > 1) {
              await this.extractor.updateProgress('Espere..Repaginado la cantidad visible...');
              const dmax = LIMITS.MAX_ROWS_PER_PAGE;
              const po = document.querySelector<HTMLSelectElement>(SELECTORS.PAGINATOR_RPP_OPTIONS);

              if (po) {
                const nd = po.querySelector<HTMLOptionElement>('option');
                if (nd) {
                  nd.value = dmax.toString();
                  nd.textContent = dmax.toString();
                  nd.selected = true;
                  po.dispatchEvent(new Event('change'));
                  await SRIUtils.esperar(DELAYS.REPAGINATION);
                  return true;
                }
              }
            }
          }
        }
      }
      return false;
    } catch (error) {
      console.error('❌ Error en repaginación:', error);
      return false;
    }
  }

  private async procesarPaginasRecursivamente(): Promise<void> {
    try {
      const tablaActual = this.detectarTablaRobusta();
      if (tablaActual.encontrada && tablaActual.tabla) {
        this.extractor.body_tabla = tablaActual.tabla || null;
        this.extractor.regs_total = this.extractor.body_tabla?.childElementCount || 0;

        const viewStateElement = document.querySelector<HTMLInputElement>(SELECTORS.VIEW_STATE);
        if (viewStateElement) {
          this.extractor.view_state = viewStateElement.value;
        }

        if (this.extractor.regs_total > 0) {
          await this.extraerDocumentosPaginaActual();

          if (await this.verificarPaginaSiguienteRobusta()) {
            await this.extractor.updateProgress('Cambiando a la siguiente página...');
            await this.navegarSiguientePaginaRobusta();
            await SRIUtils.esperar(DELAYS.PAGE_NAVIGATION);
            await this.procesarPaginasRecursivamente();
          }
        }
      }
    } catch (error) {
      console.error('❌ Error en procesamiento recursivo:', error);
    }
  }

  private async verificarPaginaSiguienteRobusta(): Promise<boolean> {
    return document.querySelectorAll(SELECTORS.PAGINATOR_NEXT_DISABLED).length === 0;
  }

  private async navegarSiguientePaginaRobusta(): Promise<boolean> {
    const botonSiguiente = document.querySelector<HTMLElement>(SELECTORS.PAGINATOR_NEXT);
    if (botonSiguiente) {
      botonSiguiente.click();
      return true;
    }
    return false;
  }

  private async extraerDocumentosPaginaActual(): Promise<void> {
    this.extractor.documentos = [];
    this.extractor.intentos = 0;

    // Obtener número de página actual
    const currentPageNumber = this.getCurrentPageNumber();

    const tablaElement = this.extractor.body_tabla?.closest('table');
    if (tablaElement) {
      this.mapearCabeceras(tablaElement);
    } else {
      console.error('❌ No se encontró el elemento <table> padre para mapear cabeceras.');
      return;
    }

    for (let i = 1; i <= this.extractor.regs_total; i++) {
      try {
        this.extractor.intentos++;
        const fila = this.extractor.body_tabla?.getElementsByTagName('tr')[i - 1];

        if (fila) {
          const numeroCelda = fila.querySelector('.ui-dt-c');
          if (!numeroCelda) continue;

          const regs_actual = Number(numeroCelda.innerHTML) - 1;
          const filaEspecifica = this.extractor.body_tabla?.querySelector<HTMLElement>(
            `tr[data-ri="${regs_actual}"]`
          );

          if (filaEspecifica) {
            const celdas = filaEspecifica.querySelectorAll<HTMLElement>('td[role="gridcell"]');

            if (celdas.length >= 8) {
              const documento = this.extraerDatosFilaEspecifica(
                celdas,
                this.extractor.tipoComprobante!,
                i,
                regs_actual,
                currentPageNumber
              );
              if (documento) {
                this.extractor.documentos.push(documento);
              }
            }
          }
        }

        if (i % LIMITS.PROGRESS_UPDATE_INTERVAL === 0) {
          await this.extractor.updateProgress(
            `Procesando documentos ${i} de ${this.extractor.regs_total} (Página ${currentPageNumber})`
          );
        }
        this.extractor.intentos = 0;
      } catch (error) {
        console.error(`❌ Error procesando fila ${i}:`, error);
        if (this.extractor.intentos < 2) i--;
      }
    }

    this.extractor.allDocuments.push(...this.extractor.documentos);
  }

  /**
   * Obtiene el número de página actual del paginador del SRI
   */
  private getCurrentPageNumber(): number {
    try {
      const paginatorSelector = `#frmPrincipal\\:tabla${this.extractor.tipo_emisi}_paginator_bottom`;
      const paginator = document.querySelector(paginatorSelector);

      if (paginator) {
        const current = paginator.querySelector(SELECTORS.PAGINATOR_CURRENT);
        if (current) {
          // El texto es algo como "Mostrando 1 - 100 de 350" o "(1 de 4)"
          const text = current.textContent || '';
          
          // Buscar patrón "(X de Y)" para número de página
          const pageMatch = text.match(/\((\d+)\s+de\s+(\d+)\)/);
          if (pageMatch) {
            return parseInt(pageMatch[1]);
          }
          
          // Alternativa: calcular página basándose en registros mostrados
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

  public detectarTablaRobusta(): {
    encontrada: boolean;
    tabla?: HTMLElement;
    tipo?: TipoComprobante;
  } {
    const tablaRecibidos = document.querySelector<HTMLElement>(SELECTORS.TABLA_RECIBIDOS);
    if (tablaRecibidos && tablaRecibidos.childElementCount > 0) {
      return { encontrada: true, tabla: tablaRecibidos, tipo: 'R' };
    }

    const tablaEmitidos = document.querySelector<HTMLElement>(SELECTORS.TABLA_EMITIDOS);
    if (tablaEmitidos && tablaEmitidos.childElementCount > 0) {
      return { encontrada: true, tabla: tablaEmitidos, tipo: 'E' };
    }

    return { encontrada: false };
  }

  public mapearCabeceras(tablaElement: HTMLTableElement): void {
    const headerMap = this.extractor.headerMap;
    const headerCells = tablaElement.querySelectorAll('thead th');

    headerCells.forEach((th, index) => {
      const text = (th.textContent || '').trim().toLowerCase().replace(/\s+/g, ' ');

      if (text.includes('ruc') && (text.includes('social') || text.includes('receptor'))) {
        headerMap.rucEmisorRaw = index;
      }
      if (text.includes('número de comprobante') || text.includes('tipo y serie')) {
        headerMap.numero = index;
      }
      if (text.includes('clave de acceso')) {
        headerMap.claveAcceso = index;
      }
      if (text.includes('fecha') && text.includes('emisión') && !text.includes('autorización')) {
        headerMap.fechaEmision = index;
      }
      if (text.includes('fecha') && text.includes('autorización')) {
        headerMap.fechaAutorizacion = index;
      }
      if (text.includes('valor sin impuestos')) {
        headerMap.valorSinImpuestos = index;
      }
      if (text.includes('iva') && text.length < 10) {
        headerMap.iva = index;
      }
      if (text.includes('importe total')) {
        headerMap.importeTotal = index;
      }
    });
  }

  public extraerDatosFilaEspecifica(
    celdas: NodeListOf<HTMLElement>,
    _tipoComprobante: TipoComprobante,
    index: number,
    rowIndex: number,
    pageNumber: number = 1
  ): Documento | null {
    try {
      const h = this.extractor.headerMap;

      if (Object.keys(h).length < 7) {
        return null;
      }

      const importeTotal = SRIUtils.extraerNumeroCelda(celdas[h.importeTotal!]);
      const valorSinImpuestos = SRIUtils.extraerNumeroCelda(celdas[h.valorSinImpuestos!]);
      const iva =
        h.iva !== undefined
          ? SRIUtils.extraerNumeroCelda(celdas[h.iva])
          : parseFloat((importeTotal - valorSinImpuestos).toFixed(2));

      const datos = {
        rucEmisorRaw: SRIUtils.extraerTextoCelda(celdas[h.rucEmisorRaw!]),
        tipoSerie: SRIUtils.extraerTextoCelda(celdas[h.numero!]),
        claveAcceso: SRIUtils.extraerTextoCelda(celdas[h.claveAcceso!]),
        fechaEmision: SRIUtils.extraerTextoCelda(celdas[h.fechaEmision!]),
        fechaAutorizacion: SRIUtils.extraerTextoCelda(celdas[h.fechaAutorizacion!]),
      };

      const [ruc, razonSocial] = SRIUtils.separarRucRazonSocial(datos.rucEmisorRaw);
      const [tipo, serie, numeroComprobante] = SRIUtils.separarTipoSerie(datos.tipoSerie);

      const documentoFinal: Documento = {
        rowIndex,
        pageNumber, // Página donde se encontró el documento
        id: datos.claveAcceso || Date.now().toString(),
        numero: datos.tipoSerie,
        ruc,
        razonSocial,
        tipoComprobante: tipo,
        serie,
        numeroComprobante,
        claveAcceso: datos.claveAcceso,
        fechaEmision: SRIUtils.formatearFecha(datos.fechaEmision),
        fechaAutorizacion: SRIUtils.formatearFechaHora(datos.fechaAutorizacion),
        valorSinImpuestos,
        iva,
        importeTotal,
      };

      return documentoFinal;
    } catch (error) {
      console.warn(`⚠️ Error procesando fila ${index}:`, error);
      return null;
    }
  }

  private async guardarResultadoFinalCompleto(resumen: SearchSummary): Promise<void> {
    try {
      await StorageManager.saveProgress({
        completed: true,
        allDocuments: this.extractor.allDocuments,
        paginationInfo: this.getPaginationInfoRobusta(),
        resumen,
      });
      await StorageManager.saveDocuments(this.extractor.allDocuments);
    } catch (error) {
      console.warn('No se pudo guardar resultado final:', error);
    }
  }

  public getPaginationInfoRobusta(): PaginationInfo {
    try {
      const paginatorSelector = `#frmPrincipal\\:tabla${this.extractor.tipo_emisi}_paginator_bottom`;
      const paginator = document.querySelector(paginatorSelector);

      if (paginator) {
        const current = paginator.querySelector(SELECTORS.PAGINATOR_CURRENT);
        if (current) {
          const numbers = current.textContent?.match(/\d+/g);
          if (numbers && numbers.length >= 2) {
            return { current: parseInt(numbers[1]), total: parseInt(numbers[1]) };
          }
        }
      }
    } catch (e) {
      console.warn('Error obteniendo info de paginación:', e);
    }
    return { current: 1, total: 1 };
  }

  public detectCurrentPagination(): void {
    try {
      const paginationInfo = this.getPaginationInfoRobusta();
      this.extractor.currentPage = paginationInfo.current;
      this.extractor.totalPages = paginationInfo.total;
    } catch (error) {
      console.warn('⚠️ Error detectando paginación:', error);
      this.extractor.currentPage = 1;
      this.extractor.totalPages = 1;
    }
  }
}

// Exportar globalmente
if (typeof window !== 'undefined') {
  (window as any).SRIPagination = SRIPagination;
}
