// Módulo de descarga - Migrado a TypeScript

import { DELAYS, MESSAGES, STORAGE_KEYS } from '@shared/constants';
import { SRIUtils, isExtensionContextValid } from '@shared/utils';
import { StorageManager } from '@shared/storage';
import type { Documento, FormatoDescarga, DownloadJob, BatchConfig } from '@shared/types';
import type { SRIDocumentosExtractor } from './extractor';
import { DownloadQueue } from './download-queue';

export class SRIDownloader {
  private downloadCancelled = false;

  constructor(private extractor: SRIDocumentosExtractor) { }

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
          // Para 'both', verificar si AMBOS archivos ya existen
          const xmlExists = archivosExistentes.has(`${baseFileName}.xml`);
          const pdfExists = archivosExistentes.has(`${baseFileName}.pdf`);

          // Solo descargar si al menos uno NO existe
          return !(xmlExists && pdfExists);
        } else {
          // Para formato único, verificar solo ese formato
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

      // Inicializar cola
      downloadQueue.initializeQueue(facturasParaDescargar, formato);

      // Función de descarga que se pasa a la cola
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

      // Listener para cancelación
      const cancelListener = (message: any) => {
        if (message.action === 'cancelDownload') {
          this.downloadCancelled = true;
          downloadQueue.pauseQueue();
        }
      };
      chrome.runtime.onMessage.addListener(cancelListener);

      // Procesar cola
      await downloadQueue.processQueue(downloadFunction);

      // Cleanup
      chrome.runtime.onMessage.removeListener(cancelListener);

      // Obtener resultados
      const failedJobs = downloadQueue.getFailedDocuments();
      const exitosos = facturasParaDescargar.length - failedJobs.length;
      const saltados = facturas.length - facturasParaDescargar.length;

      chrome.runtime.sendMessage({
        action: 'descargaFinalizada',
        exitosos,
        fallidos: failedJobs.length,
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

    const formatoCapitalized = formato.charAt(0).toUpperCase() + formato.slice(1);
    text_body += `&frmPrincipal%3Atabla${this.extractor.tipo_emisi}%3A${originalIndex}%3Alnk${formatoCapitalized}=frmPrincipal%3Atabla${this.extractor.tipo_emisi}%3A${originalIndex}%3Alnk${formatoCapitalized}`;

    const exito = await this.fetchParaDescarga(url_links, text_body, formato, name_files);
    return exito;
  }

  private async fetchParaDescarga(
    urlSRI: string,
    frmBody: string,
    _frmFile: string,
    nameFile: string
  ): Promise<boolean> {
    try {
      if (this.downloadCancelled) {
        return false;
      }

      const response = await fetch(urlSRI, {
        headers: {
          accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: frmBody,
        method: 'POST',
      });

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
