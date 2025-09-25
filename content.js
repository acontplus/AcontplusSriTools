// Content Script para Acontplus SRI Tools v1.4.1 - Final
// Integración de técnicas de paginación robustas con Acontplus SRI Tools
// Interfaz limpia y optimizada para máxima usabilidad

// MARCAR QUE EL CONTENT SCRIPT ESTÁ CARGADO
window.SRIExtractorLoaded = true;
console.log('🔍 Content Script cargado correctamente - Acontplus SRI Tools v1.4.1-Final');

class SRIDocumentosExtractor {
  constructor() {
    this.documentos = [];
    this.allDocuments = [];
    this.tablaDetectada = null;
    this.tipoComprobante = null;
    this.version = '1.4.1-Final';
    this.paginationInfo = { current: 1, total: 1 };
    this.isProcessingPagination = false;
    this.currentPage = 1;
    this.totalPages = 1;
    
    // Variables adaptadas para paginación robusta
    this.tipo_emisi = ""; // CompRecibidos o CompEmitidos
    this.movimiento = "PROCESAR"; // REPAGINAR o PROCESAR
    this.regs_total = 0;
    this.intentos = 0;
    this.view_state = "";
    this.body_tabla = null;
    this.fila_tabla = null;
    
    this.init();
  }

  init() {
    console.log('SRI Documentos Extractor v' + this.version + ' iniciado - Acontplus S.A.S.');
    this.setupMessageListener();
    this.detectarTipoEmisionRobusta();
    this.detectCurrentPagination();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('📨 Mensaje recibido:', message);

      switch (message.action) {
        case 'ping':
          sendResponse({ 
            success: true, 
            message: 'Content script activo',
            version: this.version,
            url: window.location.href,
            ready: true
          });
          return true;

        case 'buscarTodasLasPaginasSRIeload':
        case 'buscarTodasLasPaginasRobusta':
          this.procesarTodasLasPaginasRobusta(message.config || {}).then(result => {
            sendResponse(result);
          }).catch(error => {
            sendResponse({ success: false, error: error.message });
          });
          return true; // Keep the message channel open for the asynchronous response

        case 'getPaginationInfo':
          const paginationInfo = this.getPaginationInfoRobusta();
          sendResponse({
            success: true,
            currentPage: paginationInfo.current,
            totalPages: paginationInfo.total
          });
          return true;

        case 'extractCurrentPage':
          this.extractCurrentPageData().then(result => {
            sendResponse(result);
          }).catch(error => {
            sendResponse({ success: false, error: error.message });
          });
          return true; // Keep the message channel open for the asynchronous response

        default:
          console.warn('⚠️ Acción no reconocida:', message.action);
          sendResponse({ success: false, error: 'Acción no reconocida' });
          return true;
      }
    });
  }
  
  async solicitarYGuardarUbicacionDescarga() {
      try {
          if (!window.showDirectoryPicker) {
              chrome.runtime.sendMessage({ action: 'verificationError', error: 'Tu navegador no soporta esta función.' });
              return;
          }
          const dirHandle = await window.showDirectoryPicker();
          
          // Guardar el handle en IndexedDB
          const db = await this.openDb();
          const tx = db.transaction('fileHandles', 'readwrite');
          const store = tx.objectStore('fileHandles');
          await store.put(dirHandle, 'downloadDirHandle');
          await tx.done;

          // Guardar el nombre en chrome.storage.local para acceso rápido del popup
          await chrome.storage.local.set({ downloadPathName: dirHandle.name });

          // Notificar al popup para que actualice la UI
          chrome.runtime.sendMessage({ action: 'pathSelected', path: dirHandle.name });

      } catch (error) {
          if (error.name !== 'AbortError') {
              console.error('Error al solicitar ubicación de descarga:', error);
              chrome.runtime.sendMessage({ action: 'verificationError', error: error.message });
          }
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
      console.log(`Iniciando descarga de ${facturas.length} documentos en formato ${formato}`);
      let descargados = 0;
      let fallidos = 0;
      
      const dirHandle = await this.getDirHandle();

      for (let i = 0; i < facturas.length; i++) {
          this.view_state = document.querySelector("#javax\\.faces\\.ViewState")?.value || this.view_state;
          const factura = facturas[i];
          
          chrome.runtime.sendMessage({ action: 'updateDownloadProgress', current: i + 1, total: facturas.length });
    
          try {
              const originalIndex = factura.rowIndex;
              if (originalIndex === undefined || originalIndex < 0) {
                  fallidos++;
                  continue;
              }
              const exito = await this.descargarUnicoDocumento(factura, formato, originalIndex, dirHandle);
              if(exito) descargados++;
              else fallidos++;

              await this.esperar(500);
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
  }

  async descargarUnicoDocumento(factura, formato, originalIndex, dirHandle) {
      const url_links = window.location.href;
      const name_files = `${factura.numero.replace(/ /g, '_')}.${formato}`;
      
      let text_body = `frmPrincipal=frmPrincipal&javax.faces.ViewState=${encodeURIComponent(this.view_state)}&g-recaptcha-response=`;

      if (this.tipo_emisi === "CompRecibidos") {
          const fecha = new Date(factura.fechaEmision);
          text_body += `&frmPrincipal%3Aopciones=ruc&frmPrincipal%3Aano=${fecha.getFullYear()}&frmPrincipal%3Ames=${fecha.getMonth() + 1}&frmPrincipal%3Adia=${fecha.getDate()}`;
      } else {
          text_body += `&frmPrincipal%3Aopciones=ruc&frmPrincipal%3AcalendarFechaDesde_input=${new Date(factura.fechaEmision).toLocaleDateString('es-EC')}`;
      }
      
      text_body += `&frmPrincipal%3Atabla${this.tipo_emisi}%3A${originalIndex}%3Alnk${formato.charAt(0).toUpperCase() + formato.slice(1)}=frmPrincipal%3Atabla${this.tipo_emisi}%3A${originalIndex}%3Alnk${formato.charAt(0).toUpperCase() + formato.slice(1)}`;

      const exito = await this.fetchParaDescarga(url_links, text_body, formato, name_files, dirHandle);
      return exito;
  }

  async fetchParaDescarga(urlSRI, frmBody, frmFile, nameFile, dirHandle) {
    try {
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
        
        if (dirHandle) {
            // Guardar directamente en la carpeta seleccionada
            const fileHandle = await dirHandle.getFileHandle(nameFile, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
        } else {
            // Fallback a la descarga normal del navegador
            const downloadLink = document.createElement('a');
            downloadLink.href = window.URL.createObjectURL(blob);
            downloadLink.download = nameFile;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            setTimeout(() => {
                window.URL.revokeObjectURL(downloadLink.href);
                document.body.removeChild(downloadLink);
            }, 100);
        }
        return true;
    } catch (error) {
        console.error("Error en fetchParaDescarga:", error);
        return false;
    }
  }


  // --- Helper functions for IndexedDB ---
  openDb() {
      return new Promise((resolve, reject) => {
          const request = indexedDB.open('AcontplusSRIToolsDB', 1);
          request.onupgradeneeded = () => {
              request.result.createObjectStore('fileHandles');
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
      });
  }

  async getDirHandle() {
      try {
          const db = await this.openDb();
          const tx = db.transaction('fileHandles', 'readonly');
          const store = tx.objectStore('fileHandles');
          const handle = await store.get('downloadDirHandle');
          if (handle && await handle.queryPermission({ mode: 'readwrite' }) === 'granted') {
              return handle;
          }
          return null;
      } catch (error) {
          console.error("Error getting dir handle:", error);
          return null;
      }
  }


  // Detectar tipo de emisión usando técnica robusta
  detectarTipoEmisionRobusta() {
    try {
      const tablaRecibidos = document.querySelector('#frmPrincipal\\:tablaCompRecibidos_data');
      const tablaEmitidos = document.querySelector('#frmPrincipal\\:tablaCompEmitidos_data');
      
      if (tablaRecibidos && tablaRecibidos.childElementCount > 0) {
        this.tipo_emisi = "CompRecibidos";
        this.body_tabla = tablaRecibidos;
        console.log('📄 Tipo detectado: CompRecibidos');
      } else if (tablaEmitidos && tablaEmitidos.childElementCount > 0) {
        this.tipo_emisi = "CompEmitidos";
        this.body_tabla = tablaEmitidos;
        console.log('📄 Tipo detectado: CompEmitidos');
      } else {
        if (window.location.href.includes('recibidos')) this.tipo_emisi = "CompRecibidos";
        else this.tipo_emisi = "CompEmitidos";
        console.log('📄 Tipo detectado por URL:', this.tipo_emisi);
      }
    } catch (error) {
      console.warn('⚠️ Error detectando tipo emisión:', error);
      this.tipo_emisi = "CompEmitidos";
    }
  }

  // Procesamiento completo usando técnicas robustas
  async procesarTodasLasPaginasRobusta(config = {}) {
    console.log('🚀 === INICIANDO BÚSQUEDA COMPLETA ROBUSTA ===');
    
    if (this.isProcessingPagination) {
      console.log('⚠️ Ya se está procesando, evitando duplicados');
      return { success: false, error: 'Búsqueda ya en progreso' };
    }

    this.isProcessingPagination = true;
    this.allDocuments = [];
    this.movimiento = config.optimizarPaginacion ? "REPAGINAR" : "PROCESAR";
    
    try {
      const resultadoInicial = this.detectarTablaRobusta();
      if (!resultadoInicial.encontrada) throw new Error('No se encontró tabla de comprobantes en la página actual');

      this.tipoComprobante = resultadoInicial.tipo;
      const tipoTexto = this.tipoComprobante === 'R' ? 'RECIBIDOS' : 'EMITIDOS';
      console.log('✅ Tabla detectada: Documentos', tipoTexto);

      await this.ejecutarLogicaDescargaRobusta();

      const resumenFinal = {
        documentosEncontrados: this.allDocuments.length,
        paginasProcesadas: this.totalPages,
        tipoComprobante: tipoTexto,
        optimizacionAplicada: this.movimiento === "REPAGINAR"
      };

      console.log('🎉 === BÚSQUEDA COMPLETA FINALIZADA ===', resumenFinal);
      await this.guardarResultadoFinalCompleto(resumenFinal);
      this.isProcessingPagination = false;

      return {
        success: true,
        message: 'Búsqueda completa finalizada: ' + this.allDocuments.length + ' documentos encontrados',
        allDocuments: this.allDocuments,
        paginationInfo: { current: this.totalPages, total: this.totalPages },
        totalPages: this.totalPages,
        optimization: resumenFinal.optimizacionAplicada ? { optimized: true, message: 'Páginas optimizadas' } : { optimized: false }
      };

    } catch (error) {
      console.error('❌ Error en búsqueda completa:', error);
      this.isProcessingPagination = false;
      return { success: false, error: error.message };
    }
  }

  // Lógica principal de descarga
  async ejecutarLogicaDescargaRobusta() {
    console.log('🔄 Ejecutando lógica robusta adaptada...');
    if (this.movimiento === "REPAGINAR") {
      await this.aplicarRepaginacionRobusta();
      this.movimiento = "PROCESAR";
    }
    await this.procesarPaginasRecursivamente();
  }

  async aplicarRepaginacionRobusta() {
    try {
      const paginator = document.querySelector(`#frmPrincipal\\:tabla${this.tipo_emisi}_paginator_bottom`);
      if (paginator) {
        const current = paginator.querySelector('.ui-paginator-current');
        if (current) {
          const pa = parseInt(current.textContent.match(/\d+/g)[1]);
          if (pa > 1) {
            await this.updateProgress("Espere..Repaginado la cantidad visible...");
            const dmax = 300;
            const po = document.querySelector('.ui-paginator-rpp-options');
            if(po) {
                const nd = po.querySelector("option");
                if(nd) {
                    nd.value = dmax;
                    nd.textContent = dmax;
                    nd.selected = true;
                    po.dispatchEvent(new Event("change"));
                    await this.esperar(4000);
                    return true;
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

  async procesarPaginasRecursivamente() {
    try {
      const tablaActual = this.detectarTablaRobusta();
      if (tablaActual.encontrada) {
        this.body_tabla = tablaActual.tabla;
        this.regs_total = this.body_tabla.childElementCount;
        
        const viewStateElement = document.querySelector('#javax\\.faces\\.ViewState');
        if (viewStateElement) this.view_state = viewStateElement.value;
        
        if (this.regs_total > 0) {
          await this.extraerDocumentosPaginaActual();
          
          if (await this.verificarPaginaSiguienteRobusta()) {
            await this.updateProgress("Cambiando a la siguiente página...");
            await this.navegarSiguientePaginaRobusta();
            await this.esperar(4000);
            await this.procesarPaginasRecursivamente();
          } else {
            await this.updateProgress("Terminado... :-)");
          }
        }
      }
    } catch (error) {
      console.error('❌ Error en procesamiento recursivo:', error);
    }
  }

  async verificarPaginaSiguienteRobusta() {
    return document.getElementsByClassName('ui-paginator-next ui-state-default ui-corner-all ui-state-disabled').length === 0;
  }

  async navegarSiguientePaginaRobusta() {
    const botonSiguiente = document.getElementsByClassName('ui-icon ui-icon-seek-next')[0];
    if (botonSiguiente) {
      botonSiguiente.click();
      return true;
    }
    return false;
  }

  async extraerDocumentosPaginaActual() {
    this.documentos = [];
    this.intentos = 0;
    
    for (let i = 1; i <= this.regs_total; i++) {
      try {
        this.intentos++;
        this.fila_tabla = this.body_tabla.getElementsByTagName("tr")[i-1];
        if (this.fila_tabla) {
          const regs_actual = Number(this.fila_tabla.getElementsByClassName("ui-dt-c")[0].innerHTML) - 1;
          const filaEspecifica = this.body_tabla.querySelector(`tr[data-ri="${regs_actual}"]`);
          if (filaEspecifica) {
            const celdas = filaEspecifica.querySelectorAll('td[role="gridcell"]');
            if (celdas.length >= 8) {
              const documento = this.extraerDatosFilaEspecifica(celdas, this.tipoComprobante, i, regs_actual);
              if (documento) this.documentos.push(documento);
            }
          }
        }
        await this.updateProgress("Procesando documentos " + i + " de " + this.regs_total);
        this.intentos = 0;
      } catch (error) {
        if (this.intentos < 2) i--;
      }
    }
    this.allDocuments.push(...this.documentos);
  }

  detectarTablaRobusta() {
    const tablaRecibidos = document.querySelector('#frmPrincipal\\:tablaCompRecibidos_data');
    if (tablaRecibidos && tablaRecibidos.childElementCount > 0) return { encontrada: true, tabla: tablaRecibidos, tipo: 'R' };
    
    const tablaEmitidos = document.querySelector('#frmPrincipal\\:tablaCompEmitidos_data');
    if (tablaEmitidos && tablaEmitidos.childElementCount > 0) return { encontrada: true, tabla: tablaEmitidos, tipo: 'E' };
    
    return { encontrada: false };
  }

  getPaginationInfoRobusta() {
    try {
      const paginator = document.querySelector(`#frmPrincipal\\:tabla${this.tipo_emisi}_paginator_bottom`);
      if (paginator) {
        const current = paginator.querySelector('.ui-paginator-current');
        if (current) {
          const numbers = current.textContent.match(/\d+/g);
          if (numbers && numbers.length >= 2) return { current: parseInt(numbers[1]), total: parseInt(numbers[1]) };
        }
      }
    } catch(e) {}
    return { current: 1, total: 1 };
  }

  detectCurrentPagination() {
    const paginationInfo = this.getPaginationInfoRobusta();
    this.currentPage = paginationInfo.current;
    this.totalPages = paginationInfo.total;
  }

  async extractCurrentPageData() {
    try {
      const resultado = this.detectarTablaRobusta();
      if (!resultado.encontrada) throw new Error('No se encontró tabla de comprobantes');

      this.tipoComprobante = resultado.tipo;
      this.tablaDetectada = resultado.tabla;
      this.extraerDocumentos(resultado.tabla, this.tipoComprobante);
      this.paginationInfo = this.getPaginationInfoRobusta();

      return {
        success: true,
        documentos: this.documentos,
        tipoComprobante: this.tipoComprobante,
        paginationInfo: this.paginationInfo
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  extraerDocumentos(tbody, tipoComprobante) {
    const regsTotal = tbody.childElementCount;
    this.documentos = [];

    for (let i = 0; i < regsTotal; i++) {
      try {
        const fila = tbody.getElementsByTagName("tr")[i];
        const regsActual = Number(fila.getElementsByClassName("ui-dt-c")[0].innerHTML) - 1;
        const filaEspecifica = tbody.querySelector(`tr[data-ri="${regsActual}"]`);
        if (filaEspecifica) {
          const celdas = filaEspecifica.querySelectorAll('td[role="gridcell"]');
          if (celdas.length >= 8) {
            const documento = this.extraerDatosFilaEspecifica(celdas, tipoComprobante, i, regsActual);
            if (documento) this.documentos.push(documento);
          }
        }
      } catch (error) { console.warn('⚠️ Error extrayendo fila ' + i + ':', error); }
    }
    this.guardarDatos();
  }

  extraerDatosFilaEspecifica(celdas, tipoComprobante, index, rowIndex) {
    try {
      let datos;
      if (tipoComprobante === 'R') {
        datos = {
          rucEmisorRaw: this.extraerTextoCelda(celdas[1]),
          tipoSerie: this.extraerTextoCelda(celdas[2]),
          claveAcceso: this.extraerTextoCelda(celdas[3]),
          fechaEmision: this.extraerTextoCelda(celdas[5]),
          importeTotal: this.extraerNumeroCelda(celdas[8])
        };
      } else {
        datos = {
          rucEmisorRaw: this.extraerTextoCelda(celdas[1]),
          claveAcceso: this.extraerTextoCelda(celdas[2]),
          tipoSerie: this.extraerTextoCelda(celdas[3]),
          fechaEmision: this.extraerTextoCelda(celdas[5]),
          importeTotal: this.extraerNumeroCelda(celdas[8])
        };
      }
      
      const rucRazonData = this.separarRucRazonSocial(datos.rucEmisorRaw);
      const tipoSerieData = this.separarTipoSerie(datos.tipoSerie);
      
      return {
        rowIndex,
        id: `${tipoSerieData[0]}_${tipoSerieData[1]}_${tipoSerieData[2]}_${index}_${Date.now()}`,
        numero: datos.tipoSerie,
        ruc: rucRazonData[0],
        razonSocial: rucRazonData[1],
        tipoComprobante: tipoSerieData[0],
        serie: tipoSerieData[1],
        numeroComprobante: tipoSerieData[2],
        claveAcceso: datos.claveAcceso,
        fechaEmision: this.formatearFecha(datos.fechaEmision),
        importeTotal: datos.importeTotal
      };
    } catch (error) {
      console.warn('⚠️ Error procesando fila ' + index + ':', error);
      return null;
    }
  }

  extraerTextoCelda(celda) {
    return celda ? (celda.textContent || '').trim() : '';
  }

  extraerNumeroCelda(celda) {
    if (!celda || !celda.textContent) return 0;
    const numero = parseFloat(celda.textContent.trim().replace(/[^\d.-]/g, '').replace(',', '.'));
    return isNaN(numero) ? 0 : Math.abs(numero);
  }

  separarRucRazonSocial(texto) {
    if (!texto) return ['', ''];
    const lineas = texto.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0);
    if (lineas.length >= 2 && /^\d{10,13}$/.test(lineas[0])) return [lineas[0], lineas.slice(1).join(' ').trim()];
    const match = texto.match(/(\d{10,13})\s+(.+)/);
    if (match) return [match[1].trim(), match[2].trim()];
    const rucMatch = texto.match(/\d{10,13}/);
    if (rucMatch) return [rucMatch[0], texto.replace(rucMatch[0], '').trim()];
    return ['', texto.trim()];
  }

  separarTipoSerie(texto) {
    if (!texto) return ['', '', ''];
    const match = texto.match(/([^0-9]+)\s*(\d{1,3}-\d{1,3}-\d+)/);
    if (match) {
      const partes = match[2].split('-');
      if (partes.length >= 3) return [match[1].trim(), `${partes[0]}-${partes[1]}`, partes.slice(2).join('')];
    }
    return [texto.trim(), '', ''];
  }

  formatearFecha(fechaTexto) {
    if (!fechaTexto) return '';
    const match = fechaTexto.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
    return fechaTexto;
  }

  async updateProgress(progress) {
    try {
      await chrome.storage.local.set({ 
        progressStatus: {
          mensaje: progress,
          documentosEncontrados: this.allDocuments.length,
          currentPage: this.currentPage,
          totalPages: this.totalPages
        } 
      });
    } catch (error) { console.warn('No se pudo actualizar progreso:', error); }
  }

  async guardarResultadoFinalCompleto(resumen) {
    try {
      await chrome.storage.local.set({ 
        progressStatus: { completed: true, allDocuments: this.allDocuments, paginationInfo: this.getPaginationInfoRobusta(), resumen },
        facturasData: this.allDocuments,
        lastExtraction: new Date().toISOString()
      });
    } catch (error) { console.warn('No se pudo guardar resultado final:', error); }
  }

  guardarDatos() {
    try {
      chrome.storage.local.set({ 
        facturasData: this.documentos,
        lastExtraction: new Date().toISOString()
      });
    } catch (error) { console.warn('No se pudieron guardar los datos:', error); }
  }

  esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Inicializar el extractor y hacerlo globalmente accesible
window.sriExtractorInstance = new SRIDocumentosExtractor();