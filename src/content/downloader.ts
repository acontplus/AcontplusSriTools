// Módulo de descarga - Migrado a TypeScript

import { DELAYS, MESSAGES } from '@shared/constants';
import { SRIUtils, isExtensionContextValid } from '@shared/utils';
import type { Documento, FormatoDescarga } from '@shared/types';
import type { SRIDocumentosExtractor } from './extractor';

export class SRIDownloader {
  private downloadCancelled = false;

  constructor(private extractor: SRIDocumentosExtractor) {}

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
    let descargados = 0;
    let fallidos = 0;
    this.downloadCancelled = false;

    for (let i = 0; i < facturas.length; i++) {
      if (this.downloadCancelled) {
        break;
      }

      // Actualizar ViewState
      const viewStateEl = document.querySelector<HTMLInputElement>('#javax\\.faces\\.ViewState');
      if (viewStateEl) {
        this.extractor.view_state = viewStateEl.value;
      }

      const factura = facturas[i];

      try {
        if (!isExtensionContextValid()) {
          console.warn('Contexto de extensión invalidado');
          break;
        }

        chrome.runtime.sendMessage({
          action: 'updateDownloadProgress',
          current: i + 1,
          total: facturas.length,
        });
      } catch (error: any) {
        if (error.message.includes('Extension context invalidated')) {
          console.warn('Extensión recargada durante descarga');
          break;
        }
      }

      try {
        const originalIndex = factura.rowIndex;
        if (originalIndex === undefined || originalIndex < 0) {
          fallidos++;
          continue;
        }

        if (formato === 'both') {
          const exitoXml = await this.descargarUnicoDocumento(factura, 'xml', originalIndex);
          await SRIUtils.esperar(DELAYS.DOWNLOAD_FORMAT);
          const exitoPdf = await this.descargarUnicoDocumento(factura, 'pdf', originalIndex);

          if (exitoXml || exitoPdf) {
            descargados++;
          } else {
            fallidos++;
          }
        } else {
          const exito = await this.descargarUnicoDocumento(factura, formato, originalIndex);
          if (exito) descargados++;
          else fallidos++;
        }

        await SRIUtils.esperar(DELAYS.DOWNLOAD_BETWEEN);
      } catch (error) {
        console.error(`Error descargando ${factura.claveAcceso}:`, error);
        fallidos++;
      }
    }

    chrome.runtime.sendMessage({
      action: 'descargaFinalizada',
      exitosos: descargados,
      fallidos: fallidos,
      total: facturas.length,
    });

    chrome.runtime.sendMessage({ action: 'hideCancel' });
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
    }

    const url_links = window.location.href;
    const name_files = `${factura.numero.replace(/ /g, '_')}.${formato}`;

    let text_body = `frmPrincipal=frmPrincipal&javax.faces.ViewState=${encodeURIComponent(
      this.extractor.view_state
    )}&g-recaptcha-response=`;

    if (this.extractor.tipo_emisi === 'CompRecibidos') {
      const fecha = new Date(factura.fechaEmision);
      text_body += `&frmPrincipal%3Aopciones=ruc&frmPrincipal%3Aano=${fecha.getFullYear()}&frmPrincipal%3Ames=${
        fecha.getMonth() + 1
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
        throw new Error(`Error en la respuesta del servidor: ${response.statusText}`);
      }

      const blob = await response.blob();

      // Validar si es HTML (sesión perdida)
      if (blob.type.includes('text/html')) {
        chrome.runtime.sendMessage({
          action: 'sessionLost',
          message: MESSAGES.SESSION_LOST,
        });
        this.downloadCancelled = true;
        return false;
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
