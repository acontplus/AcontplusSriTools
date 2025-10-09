// Módulo de descarga para Acontplus SRI Tools v1.4.1
// Maneja la descarga de documentos XML y PDF

class SRIDownloader {
  constructor(extractor) {
    this.extractor = extractor;
  }

  // Verificar si el contexto de la extensión sigue válido
  isExtensionContextValid() {
    try {
      return chrome.runtime?.id !== undefined;
    } catch {
      return false;
    }
  }

  async verificarDescargasEnPagina(facturas) {
    try {
      if (!window.showDirectoryPicker) {
        chrome.runtime.sendMessage({ action: 'verificationError', error: 'API no soportada.' });
        return;
      }
      const dirHandle = await window.showDirectoryPicker();
      const downloadedFiles = new Set();
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          let normalizedName = entry.name.substring(0, entry.name.lastIndexOf('.'));
          downloadedFiles.add(normalizedName);
        }
      }
      const foundFiles = facturas
        .filter(factura => downloadedFiles.has(factura.numero.replace(/ /g, '_')))
        .map(factura => factura.id);

      await chrome.storage.local.set({
        lastVerification: {
          foundIds: foundFiles,
          total: facturas.length,
          timestamp: Date.now()
        }
      });

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error al verificar descargas:', error);
        chrome.runtime.sendMessage({ action: 'verificationError', error: error.message });
      }
    }
  }

  async descargarDocumentosSeleccionados(facturas, formato) {
    let descargados = 0;
    let fallidos = 0;
    this.downloadCancelled = false;

    const dirHandle = null;

    for (let i = 0; i < facturas.length; i++) {
      if (this.downloadCancelled) {
        break;
      }

      this.extractor.view_state = document.querySelector("#javax\\.faces\\.ViewState")?.value || this.extractor.view_state;
      const factura = facturas[i];

      try {
        if (!this.isExtensionContextValid()) {
          console.warn('Contexto de extensión invalidado');
          break;
        }
        chrome.runtime.sendMessage({ action: 'updateDownloadProgress', current: i + 1, total: facturas.length });
      } catch (error) {
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
            const exitoXml = await this.descargarUnicoDocumento(factura, 'xml', originalIndex, dirHandle);
            await this.extractor.esperar(250); // Pequeña pausa entre descargas
            const exitoPdf = await this.descargarUnicoDocumento(factura, 'pdf', originalIndex, dirHandle);
            
            if (exitoXml && exitoPdf) {
                descargados++;
            } else {
                fallidos++;
            }
        } else {
            const exito = await this.descargarUnicoDocumento(factura, formato, originalIndex, dirHandle);
            if(exito) descargados++;
            else fallidos++;
        }

        await this.extractor.esperar(500);
      } catch (error) {
        console.error(`Error descargando ${factura.claveAcceso}:`, error);
        fallidos++;
      }
    }

    chrome.runtime.sendMessage({
      action: 'descargaFinalizada',
      exitosos: descargados,
      fallidos: fallidos,
      total: facturas.length
    });

    // Ocultar botón cancelar al finalizar
    chrome.runtime.sendMessage({ action: 'hideCancel' });
  }

  cancelDownload() {
    this.downloadCancelled = true;
  }

  async descargarUnicoDocumento(factura, formato, originalIndex, dirHandle) {
    // Verificar cancelación al inicio
    if (this.downloadCancelled) {
      return false;
    }

    const url_links = window.location.href;
    const name_files = `${factura.numero.replace(/ /g, '_')}.${formato}`;

    let text_body = `frmPrincipal=frmPrincipal&javax.faces.ViewState=${encodeURIComponent(this.extractor.view_state)}&g-recaptcha-response=`;

    if (this.extractor.tipo_emisi === "CompRecibidos") {
      const fecha = new Date(factura.fechaEmision);
      text_body += `&frmPrincipal%3Aopciones=ruc&frmPrincipal%3Aano=${fecha.getFullYear()}&frmPrincipal%3Ames=${fecha.getMonth() + 1}&frmPrincipal%3Adia=${fecha.getDate()}`;
    } else {
      text_body += `&frmPrincipal%3Aopciones=ruc&frmPrincipal%3AcalendarFechaDesde_input=${new Date(factura.fechaEmision).toLocaleDateString('es-EC')}`;
    }

    text_body += `&frmPrincipal%3Atabla${this.extractor.tipo_emisi}%3A${originalIndex}%3Alnk${formato.charAt(0).toUpperCase() + formato.slice(1)}=frmPrincipal%3Atabla${this.extractor.tipo_emisi}%3A${originalIndex}%3Alnk${formato.charAt(0).toUpperCase() + formato.slice(1)}`;

    const exito = await this.fetchParaDescarga(url_links, text_body, formato, name_files, dirHandle);
    return exito;
  }

  async fetchParaDescarga(urlSRI, frmBody, frmFile, nameFile, dirHandle) {
    try {
      // Verificar cancelación antes del fetch
      if (this.downloadCancelled) {
        return false;
      }

      const response = await fetch(urlSRI, {
        headers: {
          "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: frmBody,
        method: "POST",
      });

      if (!response.ok) throw new Error(`Error en la respuesta del servidor: ${response.statusText}`);

      const blob = await response.blob();

      // Convertir el blob a data URL para enviarlo al background script
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = function() {
        const base64data = reader.result;
        // Enviar al background script para que use la API chrome.downloads
        chrome.runtime.sendMessage({
          action: 'downloadFile',
          payload: {
            url: base64data,
            filename: nameFile
          }
        });
      }

      return true;
    } catch (error) {
      console.error("Error en fetchParaDescarga:", error);
      return false;
    }
  }
}

// Exportar globalmente para compatibilidad con extensiones
window.SRIDownloader = SRIDownloader;