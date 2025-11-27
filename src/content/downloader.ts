// Módulo de descarga - Migrado a TypeScript

import { DELAYS, MESSAGES, STORAGE_KEYS } from '@shared/constants';
import { SRIUtils, isExtensionContextValid } from '@shared/utils';
import { StorageManager } from '@shared/storage';
import type { Documento, FormatoDescarga, DownloadJob, BatchConfig } from '@shared/types';
import type { SRIDocumentosExtractor } from './extractor';
import { DownloadQueue } from './download-queue';

// Configuración de detección de SRI lento/caído
const SRI_HEALTH_CONFIG = {
  TIMEOUT_MS: 30000,              // 30 segundos timeout por petición
  SLOW_THRESHOLD_MS: 10000,       // >10s = SRI lento
  MAX_TIMEOUTS: 3,                // Pausar después de 3 timeouts
  MAX_SLOW_RESPONSES: 5,          // Advertir después de 5 respuestas lentas
  PAUSE_AFTER_TIMEOUT_MS: 15000,  // Pausar 15s después de timeout
};

export class SRIDownloader {
  private downloadCancelled = false;
  private timeoutCount = 0;
  private slowResponseCount = 0;
  private lastResponseTimes: number[] = [];

  constructor(private extractor: SRIDocumentosExtractor) { }

  /**
   * Resetea los contadores de salud del SRI
   */
  private resetHealthCounters(): void {
    this.timeoutCount = 0;
    this.slowResponseCount = 0;
    this.lastResponseTimes = [];
  }

  /**
   * Registra el tiempo de respuesta y detecta problemas
   */
  private trackResponseTime(responseTimeMs: number): void {
    this.lastResponseTimes.push(responseTimeMs);
    
    // Mantener solo las últimas 10 respuestas
    if (this.lastResponseTimes.length > 10) {
      this.lastResponseTimes.shift();
    }

    if (responseTimeMs > SRI_HEALTH_CONFIG.SLOW_THRESHOLD_MS) {
      this.slowResponseCount++;
      console.warn(`🐢 Respuesta lenta del SRI: ${(responseTimeMs / 1000).toFixed(1)}s`);

      if (this.slowResponseCount >= SRI_HEALTH_CONFIG.MAX_SLOW_RESPONSES) {
        chrome.runtime.sendMessage({
          action: 'sriSlowDetected',
          message: `El SRI está respondiendo lento (${this.slowResponseCount} respuestas > ${SRI_HEALTH_CONFIG.SLOW_THRESHOLD_MS / 1000}s). Las descargas pueden tardar más de lo normal.`,
          avgResponseTime: this.getAverageResponseTime(),
        });
      }
    }
  }

  /**
   * Obtiene el tiempo promedio de respuesta
   */
  private getAverageResponseTime(): number {
    if (this.lastResponseTimes.length === 0) return 0;
    const sum = this.lastResponseTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.lastResponseTimes.length);
  }

  /**
   * Maneja un timeout del SRI
   */
  private async handleTimeout(): Promise<boolean> {
    this.timeoutCount++;
    console.error(`⏱️ Timeout #${this.timeoutCount} del SRI`);

    if (this.timeoutCount >= SRI_HEALTH_CONFIG.MAX_TIMEOUTS) {
      console.error(`🚫 Demasiados timeouts (${this.timeoutCount}). El SRI parece estar caído o muy lento.`);
      
      chrome.runtime.sendMessage({
        action: 'sriDownDetected',
        message: `El SRI no responde después de ${this.timeoutCount} intentos. Posiblemente está caído o en mantenimiento. Se pausarán las descargas.`,
        timeoutCount: this.timeoutCount,
      });

      // Pausar antes de continuar
      console.log(`⏸️ Pausando ${SRI_HEALTH_CONFIG.PAUSE_AFTER_TIMEOUT_MS / 1000}s antes de reintentar...`);
      await SRIUtils.esperar(SRI_HEALTH_CONFIG.PAUSE_AFTER_TIMEOUT_MS);
      
      // Resetear contador para dar otra oportunidad
      this.timeoutCount = 0;
      return false; // Indicar que hubo problema
    }

    return true; // Puede continuar
  }

  /**
   * Incrementa el contador de descargas y muestra modal si es necesario
   */
  private async incrementarContadorDescarga(): Promise<void> {
    try {
      if (typeof (window as any).downloadCounter !== 'undefined') {
        await (window as any).downloadCounter.incrementDownload();
      }
    } catch (error) {
      console.warn('Error incrementando contador de descargas:', error);
    }
  }

  async verificarDescargasEnPagina(facturas: Documento[]): Promise<void> {
    try {
      if (!('showDirectoryPicker' in window)) {
        chrome.runtime.sendMessage({
          action: 'verificationError',
          error: 'API no soportada.',
        });
        return;
      }

      const dirHandle = await (window as any).showDirectoryPicker();
      const downloadedFiles = new Set<string>();

      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          const normalizedName = entry.name.substring(0, entry.name.lastIndexOf('.'));
          downloadedFiles.add(normalizedName);
        }
      }

      const foundFiles = facturas
        .filter((factura) => downloadedFiles.has(factura.numero.replace(/ /g, '_')))
        .map((factura) => factura.id);

      await chrome.storage.local.set({
        lastVerification: {
          foundIds: foundFiles,
          total: facturas.length,
          timestamp: Date.now(),
        },
      });
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error al verificar descargas:', error);
        chrome.runtime.sendMessage({
          action: 'verificationError',
          error: error.message,
        });
      }
    }
  }

  async descargarDocumentosSeleccionados(
    facturas: Documento[],
    formato: FormatoDescarga
  ): Promise<void> {
    this.downloadCancelled = false;
    this.resetHealthCounters(); // Resetear contadores de salud del SRI

    try {
      // Cargar configuración de usuario
      const userConfig = await StorageManager.get<BatchConfig>(STORAGE_KEYS.DOWNLOAD_CONFIG);
      const downloadQueue = new DownloadQueue(userConfig || {});

      // Obtener archivos ya descargados para evitar duplicados
      const archivosExistentes = await this.obtenerArchivosExistentes();

      // Filtrar documentos que ya existen
      const facturasParaDescargar = facturas.filter((factura) => {
        const baseFileName = factura.numero.replace(/ /g, '_');

        if (formato === 'both') {
          const xmlExists = archivosExistentes.has(`${baseFileName}.xml`);
          const pdfExists = archivosExistentes.has(`${baseFileName}.pdf`);
          return !(xmlExists && pdfExists);
        } else {
          const fileName = `${baseFileName}.${formato}`;
          return !archivosExistentes.has(fileName);
        }
      });

      console.log(`📥 Descargando ${facturasParaDescargar.length} documentos (${facturas.length - facturasParaDescargar.length} ya existen)`);

      if (facturasParaDescargar.length === 0) {
        chrome.runtime.sendMessage({
          action: 'descargaFinalizada',
          exitosos: 0,
          fallidos: 0,
          saltados: facturas.length,
          total: facturas.length,
        });
        return;
      }

      // Agrupar documentos por página para procesarlos en orden
      const documentosPorPagina = this.agruparPorPagina(facturasParaDescargar);
      const paginasOrdenadas = Array.from(documentosPorPagina.keys()).sort((a, b) => a - b);
      
      console.log(`📑 Documentos distribuidos en ${paginasOrdenadas.length} páginas: ${paginasOrdenadas.join(', ')}`);

      // Listener para cancelación
      const cancelListener = (message: any) => {
        if (message.action === 'cancelDownload') {
          this.downloadCancelled = true;
          downloadQueue.pauseQueue();
        }
      };
      chrome.runtime.onMessage.addListener(cancelListener);

      let totalExitosos = 0;
      let totalFallidos = 0;

      // Procesar página por página
      for (const numeroPagina of paginasOrdenadas) {
        if (this.downloadCancelled) break;

        const documentosDePagina = documentosPorPagina.get(numeroPagina)!;
        console.log(`\n📄 Procesando página ${numeroPagina} (${documentosDePagina.length} documentos)...`);

        // Navegar a la página si es necesario
        const navegacionExitosa = await this.navegarAPagina(numeroPagina);
        if (!navegacionExitosa) {
          console.error(`❌ No se pudo navegar a la página ${numeroPagina}, saltando ${documentosDePagina.length} documentos`);
          totalFallidos += documentosDePagina.length;
          continue;
        }

        // Inicializar cola para esta página
        downloadQueue.initializeQueue(documentosDePagina, formato);

        // Función de descarga
        const downloadFunction = async (job: DownloadJob): Promise<boolean> => {
          if (this.downloadCancelled) {
            downloadQueue.pauseQueue();
            return false;
          }

          // Actualizar ViewState antes de cada descarga
          const viewStateEl = document.querySelector<HTMLInputElement>('#javax\\.faces\\.ViewState');
          if (viewStateEl) {
            this.extractor.view_state = viewStateEl.value;
          }

          const factura = job.documento;
          const originalIndex = factura.rowIndex;

          if (originalIndex === undefined || originalIndex < 0) {
            return false;
          }

          try {
            if (!isExtensionContextValid()) {
              console.warn('Contexto de extensión invalidado');
              downloadQueue.pauseQueue();
              return false;
            }

            // Procesar según formato
            if (job.formato === 'both') {
              const exitoXml = await this.descargarUnicoDocumento(factura, 'xml', originalIndex);
              if (exitoXml) {
                await this.incrementarContadorDescarga();
              }
              await SRIUtils.esperar(DELAYS.DOWNLOAD_FORMAT);

              const exitoPdf = await this.descargarUnicoDocumento(factura, 'pdf', originalIndex);
              if (exitoPdf) {
                await this.incrementarContadorDescarga();
              }

              return exitoXml && exitoPdf;
            } else {
              const exito = await this.descargarUnicoDocumento(factura, job.formato, originalIndex);
              if (exito) {
                await this.incrementarContadorDescarga();
              }
              return exito;
            }
          } catch (error) {
            console.error(`Error descargando ${factura.claveAcceso}:`, error);
            return false;
          }
        };

        // Procesar cola de esta página
        await downloadQueue.processQueue(downloadFunction);

        // Acumular resultados
        const failedJobs = downloadQueue.getFailedDocuments();
        totalExitosos += documentosDePagina.length - failedJobs.length;
        totalFallidos += failedJobs.length;

        // Notificar progreso entre páginas
        chrome.runtime.sendMessage({
          action: 'paginaCompletada',
          pagina: numeroPagina,
          exitosos: documentosDePagina.length - failedJobs.length,
          fallidos: failedJobs.length,
          totalPaginas: paginasOrdenadas.length,
        });
      }

      // Cleanup
      chrome.runtime.onMessage.removeListener(cancelListener);

      const saltados = facturas.length - facturasParaDescargar.length;

      chrome.runtime.sendMessage({
        action: 'descargaFinalizada',
        exitosos: totalExitosos,
        fallidos: totalFallidos,
        saltados,
        total: facturas.length,
      });

      // Limpiar sesión
      await downloadQueue.clearSession();

    } catch (error: any) {
      console.error('Error en sistema de descargas por lotes:', error);
      chrome.runtime.sendMessage({
        action: 'descargaFinalizada',
        exitosos: 0,
        fallidos: facturas.length,
        saltados: 0,
        total: facturas.length,
      });
    }

    chrome.runtime.sendMessage({ action: 'hideCancel' });
  }

  private async obtenerArchivosExistentes(): Promise<Set<string>> {
    try {
      // Solicitar al background que busque archivos existentes
      const response = await chrome.runtime.sendMessage({
        action: 'getExistingFiles',
      });

      if (response && response.success && response.files) {
        console.log(`✅ ${response.files.length} archivos existentes encontrados`);
        return new Set(response.files);
      }

      return new Set();
    } catch (error) {
      console.error('Error obteniendo archivos existentes:', error);
      return new Set();
    }
  }

  cancelDownload(): void {
    this.downloadCancelled = true;
  }

  /**
   * Agrupa documentos por número de página para procesarlos en orden
   */
  private agruparPorPagina(documentos: Documento[]): Map<number, Documento[]> {
    const grupos = new Map<number, Documento[]>();
    
    for (const doc of documentos) {
      const pagina = doc.pageNumber || 1;
      if (!grupos.has(pagina)) {
        grupos.set(pagina, []);
      }
      grupos.get(pagina)!.push(doc);
    }
    
    return grupos;
  }

  /**
   * Obtiene el número de página actual del paginador del SRI
   */
  private getCurrentPageFromDOM(): number {
    try {
      const paginatorSelector = `#frmPrincipal\\:tabla${this.extractor.tipo_emisi}_paginator_bottom`;
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
      console.warn('⚠️ Error obteniendo página actual:', error);
    }
    return 1;
  }

  /**
   * Navega a una página específica del paginador del SRI
   */
  private async navegarAPagina(targetPage: number): Promise<boolean> {
    const currentPage = this.getCurrentPageFromDOM();
    
    if (currentPage === targetPage) {
      console.log(`📄 Ya estamos en la página ${targetPage}`);
      return true;
    }

    console.log(`🔄 Navegando de página ${currentPage} a página ${targetPage}...`);

    try {
      // Estrategia: usar los botones de navegación del paginador
      const paginatorSelector = `#frmPrincipal\\:tabla${this.extractor.tipo_emisi}_paginator_bottom`;
      const paginator = document.querySelector(paginatorSelector);

      if (!paginator) {
        console.error('❌ No se encontró el paginador');
        return false;
      }

      // Buscar el botón de página específica o navegar secuencialmente
      const pageButtons = paginator.querySelectorAll<HTMLElement>('.ui-paginator-page');
      
      // Intentar encontrar el botón de la página directamente
      for (let i = 0; i < pageButtons.length; i++) {
        const btn = pageButtons[i];
        if (btn.textContent?.trim() === targetPage.toString()) {
          btn.click();
          await this.esperarCargaPagina();
          return true;
        }
      }

      // Si no encontramos el botón directo, navegar secuencialmente
      if (targetPage > currentPage) {
        // Navegar hacia adelante
        for (let i = currentPage; i < targetPage; i++) {
          const nextBtn = paginator.querySelector<HTMLElement>('.ui-paginator-next:not(.ui-state-disabled)');
          if (nextBtn) {
            nextBtn.click();
            await this.esperarCargaPagina();
          } else {
            console.error(`❌ No se puede avanzar más allá de la página ${i}`);
            return false;
          }
        }
      } else {
        // Navegar hacia atrás
        for (let i = currentPage; i > targetPage; i--) {
          const prevBtn = paginator.querySelector<HTMLElement>('.ui-paginator-prev:not(.ui-state-disabled)');
          if (prevBtn) {
            prevBtn.click();
            await this.esperarCargaPagina();
          } else {
            console.error(`❌ No se puede retroceder más allá de la página ${i}`);
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      console.error('❌ Error navegando a página:', error);
      return false;
    }
  }

  /**
   * Espera a que la página cargue después de navegar
   */
  private async esperarCargaPagina(): Promise<void> {
    // Esperar un tiempo base
    await SRIUtils.esperar(DELAYS.PAGE_NAVIGATION);

    // Esperar a que desaparezca el indicador de carga si existe
    const maxWait = 10000; // 10 segundos máximo
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const loadingIndicator = document.querySelector('.ui-blockui, .ui-loading');
      if (!loadingIndicator) {
        break;
      }
      await SRIUtils.esperar(200);
    }

    // Actualizar ViewState después de la navegación
    const viewStateEl = document.querySelector<HTMLInputElement>('#javax\\.faces\\.ViewState');
    if (viewStateEl) {
      this.extractor.view_state = viewStateEl.value;
      console.log(`🔑 ViewState actualizado después de navegación`);
    }
  }

  private async descargarUnicoDocumento(
    factura: Documento,
    formato: 'xml' | 'pdf',
    originalIndex: number
  ): Promise<boolean> {
    if (this.downloadCancelled) {
      return false;
    }

    // Actualizar ViewState
    const viewStateEl = document.querySelector<HTMLInputElement>('#javax\\.faces\\.ViewState');
    if (viewStateEl) {
      this.extractor.view_state = viewStateEl.value;
      console.log(`🔑 ViewState actualizado (${viewStateEl.value.substring(0, 30)}...)`);
    } else {
      console.warn('⚠️ No se encontró ViewState en la página');
    }

    const url_links = window.location.href;
    const name_files = `${factura.numero.replace(/ /g, '_')}.${formato}`;
    
    console.log(`📤 Descargando: ${name_files}, rowIndex: ${originalIndex}, tipo: ${this.extractor.tipo_emisi}`);

    let text_body = `frmPrincipal=frmPrincipal&javax.faces.ViewState=${encodeURIComponent(
      this.extractor.view_state
    )}&g-recaptcha-response=`;

    if (this.extractor.tipo_emisi === 'CompRecibidos') {
      const fecha = new Date(factura.fechaEmision);
      text_body += `&frmPrincipal%3Aopciones=ruc&frmPrincipal%3Aano=${fecha.getFullYear()}&frmPrincipal%3Ames=${fecha.getMonth() + 1
        }&frmPrincipal%3Adia=${fecha.getDate()}`;
    } else {
      text_body += `&frmPrincipal%3Aopciones=ruc&frmPrincipal%3AcalendarFechaDesde_input=${new Date(
        factura.fechaEmision
      ).toLocaleDateString('es-EC')}`;
    }

    // Agregar cmbTipoComprobante si existe (importante para mantener el contexto de la búsqueda)
    const tipoComprobanteSelect = document.querySelector<HTMLSelectElement>('select[name="frmPrincipal:cmbTipoComprobante"]');
    if (tipoComprobanteSelect && tipoComprobanteSelect.value) {
      text_body += `&frmPrincipal%3AcmbTipoComprobante=${tipoComprobanteSelect.value}`;
    }

    const formatoCapitalized = formato.charAt(0).toUpperCase() + formato.slice(1);
    text_body += `&frmPrincipal%3Atabla${this.extractor.tipo_emisi}%3A${originalIndex}%3Alnk${formatoCapitalized}=frmPrincipal%3Atabla${this.extractor.tipo_emisi}%3A${originalIndex}%3Alnk${formatoCapitalized}`;

    // Pequeña pausa extra para PDFs para evitar saturación
    if (formato === 'pdf') {
      await SRIUtils.esperar(500);
    }

    const exito = await this.fetchParaDescarga(url_links, text_body, formato, name_files, formato === 'pdf' ? 60000 : 30000);
    return exito;
  }

  private async fetchParaDescarga(
    urlSRI: string,
    frmBody: string,
    _frmFile: string,
    nameFile: string,
    timeoutMs: number = SRI_HEALTH_CONFIG.TIMEOUT_MS
  ): Promise<boolean> {
    try {
      if (this.downloadCancelled) {
        return false;
      }

      const startTime = Date.now();
      
      // Crear AbortController para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await fetch(urlSRI, {
          headers: {
            accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: frmBody,
          method: 'POST',
          signal: controller.signal,
        });
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        // Detectar si fue un timeout (abort)
        if (fetchError.name === 'AbortError') {
          console.error(`⏱️ Timeout descargando ${nameFile} (>${timeoutMs / 1000}s)`);
          const canContinue = await this.handleTimeout();
          if (!canContinue) {
            return false;
          }
          // Reintentar será manejado por el sistema de reintentos
          throw new Error(`Timeout: El SRI no respondió en ${timeoutMs / 1000} segundos`);
        }
        
        // Error de red (SRI caído, sin conexión, etc.)
        if (fetchError.message?.includes('Failed to fetch') || fetchError.message?.includes('NetworkError')) {
          console.error(`🌐 Error de red descargando ${nameFile}:`, fetchError.message);
          chrome.runtime.sendMessage({
            action: 'sriNetworkError',
            message: 'Error de conexión con el SRI. Verifica tu conexión a internet o si el SRI está disponible.',
          });
          return false;
        }
        
        throw fetchError;
      }
      
      clearTimeout(timeoutId);
      
      // Registrar tiempo de respuesta
      const responseTime = Date.now() - startTime;
      this.trackResponseTime(responseTime);
      
      console.log(`⏱️ Respuesta en ${(responseTime / 1000).toFixed(1)}s para ${nameFile}`);

      if (!response.ok) {
        // Errores HTTP específicos
        if (response.status === 401 || response.status === 403) {
          console.warn('🔒 Error de autenticación detectado (401/403)');
          chrome.runtime.sendMessage({
            action: 'sessionLost',
            message: MESSAGES.SESSION_LOST,
          });
          this.downloadCancelled = true;
          return false;
        }
        throw new Error(`Error en la respuesta del servidor: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();

      // Validar si es HTML (posible sesión perdida, documento no existe, o error del servidor)
      if (blob.type.includes('text/html')) {
        // Leer el contenido HTML para análisis
        const htmlText = await blob.text();
        const htmlLower = htmlText.toLowerCase();

        // 1. PRIORIDAD ALTA: Indicadores específicos de sesión expirada del SRI
        const sessionExpiredIndicators = [
          'sesión ha expirado',
          'session has expired',
          'el tiempo asignado a la transacción se ha extinguido',
          'su sesión ha caducado',
          'session timeout',
          'debe autenticarse nuevamente',
          'volver a iniciar sesión'
        ];

        const isSessionExpired = sessionExpiredIndicators.some(indicator =>
          htmlLower.includes(indicator.toLowerCase())
        );

        if (isSessionExpired) {
          console.error('🔒 SESIÓN SRI EXPIRADA - Cancelando todas las descargas');
          chrome.runtime.sendMessage({
            action: 'sessionLost',
            message: MESSAGES.SESSION_LOST,
          });
          this.downloadCancelled = true;
          return false;
        }

        // 2. Detectar página de login (sin sesión activa)
        const loginIndicators = ['login', 'iniciar sesión', 'usuario', 'contraseña', 'autenticación'];
        const hasLoginForm = loginIndicators.filter(indicator =>
          htmlLower.includes(indicator)
        ).length >= 2; // Al menos 2 indicadores de login

        if (hasLoginForm && blob.size < 50000) { // Páginas de login suelen ser < 50KB
          console.error('🔐 Página de LOGIN detectada - Sin sesión activa');
          chrome.runtime.sendMessage({
            action: 'sessionLost',
            message: 'Debe iniciar sesión en el portal del SRI para continuar',
          });
          this.downloadCancelled = true;
          return false;
        }

        // 3. Documento no existe en servidor (pero sí en localStorage)
        const notFoundIndicators = [
          'no se encuentra',
          'not found',
          'no existe',
          'documento no disponible',
          'comprobante no encontrado',
          'no se pudo obtener',
          'error 404'
        ];

        const isDocumentNotFound = notFoundIndicators.some(indicator =>
          htmlLower.includes(indicator)
        );

        if (isDocumentNotFound) {
          console.warn(`⚠️ Documento ${nameFile} no existe en servidor SRI (solo en localStorage) - Saltando...`);
          return false; // Saltar este documento, continuar con los demás
        }

        // 4. Otros errores del servidor (500, mantenimiento, etc.)
        const serverErrorIndicators = [
          'error del servidor',
          'server error',
          'error 500',
          'error 502',
          'error 503',
          'mantenimiento',
          'maintenance',
          'temporalmente no disponible'
        ];

        const isServerError = serverErrorIndicators.some(indicator =>
          htmlLower.includes(indicator)
        );

        if (isServerError) {
          console.warn(`🔧 Error del servidor SRI para ${nameFile} - Saltando...`);
          return false; // Saltar este documento
        }

        // 5. Si es HTML pero no coincide con ningún patrón conocido
        // Probablemente un documento que no existe o página de error genérica
        if (blob.size > 100000) {
          // HTML muy grande (>100KB) - probablemente página completa de error
          console.warn(`⚠️ Documento ${nameFile} devolvió HTML grande (${Math.round(blob.size / 1024)}KB) - posiblemente no existe en servidor`);
        } else {
          console.warn(`⚠️ Respuesta HTML inesperada para ${nameFile} (${blob.size} bytes)`);
          console.log('Primeras 200 caracteres:', htmlText.substring(0, 200));
        }
        return false; // Por seguridad, saltar el documento
      }

      // Convertir blob a data URL
      const reader = new FileReader();
      reader.readAsDataURL(blob);

      return new Promise((resolve) => {
        reader.onloadend = function () {
          const base64data = reader.result as string;
          chrome.runtime.sendMessage({
            action: 'downloadFile',
            payload: {
              url: base64data,
              filename: nameFile,
            },
          });
          resolve(true);
        };
      });
    } catch (error) {
      console.error('Error en fetchParaDescarga:', error);
      return false;
    }
  }
}

// Exportar globalmente
if (typeof window !== 'undefined') {
  (window as any).SRIDownloader = SRIDownloader;
}
