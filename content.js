// Content Script Principal - Acontplus SRI Tools v1.4.1-Final
// Punto de entrada que importa todos los módulos modulares

// Importar módulos compartidos
// [Nota: En extensiones Chrome, usamos inclusión directa en lugar de ES6 imports]

// Módulo de utilidades compartidas
class SRIUtils {
  static formatearFecha(fechaTexto) {
    if (!fechaTexto) return '';
    const match = fechaTexto.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
    return fechaTexto;
  }

  static formatearFechaHora(fechaTexto) {
    if (!fechaTexto) return '';
    const match = fechaTexto.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/);
    if (match) {
      return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')} ${match[4].padStart(2, '0')}:${match[5].padStart(2, '0')}:${match[6].padStart(2, '0')}`;
    }
    return this.formatearFecha(fechaTexto);
  }

  static extraerTextoCelda(celda) {
    return celda ? (celda.textContent || '').trim() : '';
  }

  static extraerNumeroCelda(celda) {
    if (!celda || !celda.textContent) return 0;
    const numero = parseFloat(celda.textContent.trim().replace(/[^\d.-]/g, '').replace(',', '.'));
    return isNaN(numero) ? 0 : Math.abs(numero);
  }

  static separarRucRazonSocial(texto) {
    if (!texto) return ['', ''];
    const lineas = texto.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0);
    if (lineas.length >= 2 && /^\d{10,13}$/.test(lineas[0])) return [lineas[0], lineas.slice(1).join(' ').trim()];
    const match = texto.match(/(\d{10,13})\s+(.+)/);
    if (match) return [match[1].trim(), match[2].trim()];
    const rucMatch = texto.match(/\d{10,13}/);
    if (rucMatch) return [rucMatch[0], texto.replace(rucMatch[0], '').trim()];
    return ['', texto.trim()];
  }

  static separarTipoSerie(texto) {
    if (!texto) return ['', '', ''];
    const match = texto.match(/([^0-9]+)\s*(\d{1,3}-\d{1,3}-\d+)/);
    if (match) {
      const partes = match[2].split('-');
      if (partes.length >= 3) return [match[1].trim(), `${partes[0]}-${partes[1]}`, partes.slice(2).join('')];
    }
    return [texto.trim(), '', ''];
  }
}

// Módulo de descarga
class SRIDownloader {
  constructor(extractor) {
    this.extractor = extractor;
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

    const dirHandle = null;

    for (let i = 0; i < facturas.length; i++) {
      this.extractor.view_state = document.querySelector("#javax\\.faces\\.ViewState")?.value || this.extractor.view_state;
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
  }

  async descargarUnicoDocumento(factura, formato, originalIndex, dirHandle) {
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

      const downloadLink = document.createElement('a');
      downloadLink.href = window.URL.createObjectURL(blob);
      downloadLink.download = nameFile;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(downloadLink.href);
        document.body.removeChild(downloadLink);
      }, 100);

      return true;
    } catch (error) {
      console.error("Error en fetchParaDescarga:", error);
      return false;
    }
  }
}

// Módulo de paginación
class SRIPagination {
  constructor(extractor) {
    this.extractor = extractor;
  }

  async procesarTodasLasPaginasRobusta(config = {}) {
    console.log('🚀 === INICIANDO BÚSQUEDA COMPLETA ROBUSTA ===');

    if (this.extractor.isProcessingPagination) {
      console.log('⚠️ Ya se está procesando, evitando duplicados');
      return { success: false, error: 'Búsqueda ya en progreso' };
    }

    this.extractor.isProcessingPagination = true;
    this.extractor.allDocuments = [];
    this.extractor.movimiento = config.optimizarPaginacion ? "REPAGINAR" : "PROCESAR";

    try {
      const resultadoInicial = this.detectarTablaRobusta();
      if (!resultadoInicial.encontrada) throw new Error('No se encontró tabla de comprobantes en la página actual');

      this.extractor.tipoComprobante = resultadoInicial.tipo;
      const tipoTexto = this.extractor.tipoComprobante === 'R' ? 'RECIBIDOS' : 'EMITIDOS';
      console.log('✅ Tabla detectada: Documentos', tipoTexto);

      await this.ejecutarLogicaDescargaRobusta();

      const resumenFinal = {
        documentosEncontrados: this.extractor.allDocuments.length,
        paginasProcesadas: this.extractor.totalPages,
        tipoComprobante: tipoTexto,
        optimizacionAplicada: this.extractor.movimiento === "REPAGINAR"
      };

      console.log('🎉 === BÚSQUEDA COMPLETA FINALIZADA ===', resumenFinal);
      await this.guardarResultadoFinalCompleto(resumenFinal);
      this.extractor.isProcessingPagination = false;

      return {
        success: true,
        message: 'Búsqueda completa finalizada: ' + this.extractor.allDocuments.length + ' documentos encontrados',
        allDocuments: this.extractor.allDocuments,
        paginationInfo: { current: this.extractor.totalPages, total: this.extractor.totalPages },
        totalPages: this.extractor.totalPages,
        optimization: resumenFinal.optimizacionAplicada ? { optimized: true, message: 'Páginas optimizadas' } : { optimized: false }
      };

    } catch (error) {
      console.error('❌ Error en búsqueda completa:', error);
      this.extractor.isProcessingPagination = false;
      return { success: false, error: error.message };
    }
  }

  async ejecutarLogicaDescargaRobusta() {
    console.log('🔄 Ejecutando lógica robusta adaptada...');
    if (this.extractor.movimiento === "REPAGINAR") {
      await this.aplicarRepaginacionRobusta();
      this.extractor.movimiento = "PROCESAR";
    }
    await this.procesarPaginasRecursivamente();
  }

  async aplicarRepaginacionRobusta() {
    try {
      const paginator = document.querySelector(`#frmPrincipal\\:tabla${this.extractor.tipo_emisi}_paginator_bottom`);
      if (paginator) {
        const current = paginator.querySelector('.ui-paginator-current');
        if (current) {
          const pa = parseInt(current.textContent.match(/\d+/g)[1]);
          if (pa > 1) {
            await this.extractor.updateProgress("Espere..Repaginado la cantidad visible...");
            const dmax = 300;
            const po = document.querySelector('.ui-paginator-rpp-options');
            if(po) {
              const nd = po.querySelector("option");
              if(nd) {
                nd.value = dmax;
                nd.textContent = dmax;
                nd.selected = true;
                po.dispatchEvent(new Event("change"));
                await this.extractor.esperar(4000);
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
        this.extractor.body_tabla = tablaActual.tabla;
        this.extractor.regs_total = this.extractor.body_tabla.childElementCount;

        const viewStateElement = document.querySelector('#javax\\.faces\\.ViewState');
        if (viewStateElement) this.extractor.view_state = viewStateElement.value;

        if (this.extractor.regs_total > 0) {
          await this.extraerDocumentosPaginaActual();

          if (await this.verificarPaginaSiguienteRobusta()) {
            await this.extractor.updateProgress("Cambiando a la siguiente página...");
            await this.navegarSiguientePaginaRobusta();
            await this.extractor.esperar(4000);
            await this.procesarPaginasRecursivamente();
          } else {
            await this.extractor.updateProgress("Terminado... :-)");
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
    const botonSiguiente = document.getElementsByClassName('ui-paginator-next ui-state-default ui-corner-all')[0];
    if (botonSiguiente) {
      botonSiguiente.click();
      return true;
    }
    return false;
  }

  async extraerDocumentosPaginaActual() {
    this.extractor.documentos = [];
    this.extractor.intentos = 0;

    const tablaElement = this.extractor.body_tabla.closest('table');
    if(tablaElement) {
      this.mapearCabeceras(tablaElement);
    } else {
      console.error("No se encontró el elemento <table> padre para mapear cabeceras.");
      return;
    }

    for (let i = 1; i <= this.extractor.regs_total; i++) {
      try {
        this.extractor.intentos++;
        this.extractor.fila_tabla = this.extractor.body_tabla.getElementsByTagName("tr")[i-1];
        if (this.extractor.fila_tabla) {
          const regs_actual = Number(this.extractor.fila_tabla.getElementsByClassName("ui-dt-c")[0].innerHTML) - 1;
          const filaEspecifica = this.extractor.body_tabla.querySelector(`tr[data-ri="${regs_actual}"]`);
          if (filaEspecifica) {
            const celdas = filaEspecifica.querySelectorAll('td[role="gridcell"]');
            if (celdas.length >= 8) {
              const documento = this.extraerDatosFilaEspecifica(celdas, this.extractor.tipoComprobante, i, regs_actual);
              if (documento) this.extractor.documentos.push(documento);
            }
          }
        }
        await this.extractor.updateProgress("Procesando documentos " + i + " de " + this.extractor.regs_total);
        this.extractor.intentos = 0;
      } catch (error) {
        if (this.extractor.intentos < 2) i--;
      }
    }
    this.extractor.allDocuments.push(...this.extractor.documentos);
  }

  detectarTablaRobusta() {
    const tablaRecibidos = document.querySelector('#frmPrincipal\\:tablaCompRecibidos_data');
    if (tablaRecibidos && tablaRecibidos.childElementCount > 0) return { encontrada: true, tabla: tablaRecibidos, tipo: 'R' };

    const tablaEmitidos = document.querySelector('#frmPrincipal\\:tablaCompEmitidos_data');
    if (tablaEmitidos && tablaEmitidos.childElementCount > 0) return { encontrada: true, tabla: tablaEmitidos, tipo: 'E' };

    return { encontrada: false };
  }

  mapearCabeceras(tablaElement) {
    const headerMap = {};
    const headerCells = tablaElement.querySelectorAll('thead th');

    headerCells.forEach((th, index) => {
      const text = (th.textContent || '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (text.includes('ruc') && (text.includes('social') || text.includes('receptor'))) headerMap.rucEmisorRaw = index;
      if (text.includes('número de comprobante')) headerMap.numero = index;
      if (text.includes('clave de acceso')) headerMap.claveAcceso = index;
      if (text.includes('fecha y hora de emisión')) headerMap.fechaEmision = index;
      if (text.includes('fecha y hora de autorización')) headerMap.fechaAutorizacion = index;
      if (text.includes('valor sin impuestos')) headerMap.valorSinImpuestos = index;
      if (text.includes('iva') && text.length < 5) headerMap.iva = index;
      if (text.includes('importe total')) headerMap.importeTotal = index;
    });
    this.extractor.headerMap = headerMap;
    console.log('Mapeo de cabeceras:', this.extractor.headerMap);
  }

  extraerDatosFilaEspecifica(celdas, tipoComprobante, index, rowIndex) {
    try {
      const h = this.extractor.headerMap;
      if (Object.keys(h).length < 7) {
        console.error("Mapeo de cabeceras incompleto, no se puede extraer la fila.");
        return null;
      }

      const importeTotal = SRIUtils.extraerNumeroCelda(celdas[h.importeTotal]);
      const valorSinImpuestos = SRIUtils.extraerNumeroCelda(celdas[h.valorSinImpuestos]);
      const iva = h.iva !== undefined ? SRIUtils.extraerNumeroCelda(celdas[h.iva]) : parseFloat((importeTotal - valorSinImpuestos).toFixed(2));

      const datos = {
        rucEmisorRaw: SRIUtils.extraerTextoCelda(celdas[h.rucEmisorRaw]),
        tipoSerie: SRIUtils.extraerTextoCelda(celdas[h.numero]),
        claveAcceso: SRIUtils.extraerTextoCelda(celdas[h.claveAcceso]),
        fechaEmision: SRIUtils.extraerTextoCelda(celdas[h.fechaEmision]),
        fechaAutorizacion: SRIUtils.extraerTextoCelda(celdas[h.fechaAutorizacion]),
      };

      const rucRazonData = SRIUtils.separarRucRazonSocial(datos.rucEmisorRaw);
      const tipoSerieData = SRIUtils.separarTipoSerie(datos.tipoSerie);

      return {
        rowIndex,
        id: `${datos.claveAcceso || Date.now()}`,
        numero: datos.tipoSerie,
        ruc: rucRazonData[0],
        razonSocial: rucRazonData[1],
        tipoComprobante: tipoSerieData[0],
        serie: tipoSerieData[1],
        numeroComprobante: tipoSerieData[2],
        claveAcceso: datos.claveAcceso,
        fechaEmision: SRIUtils.formatearFecha(datos.fechaEmision),
        fechaAutorizacion: SRIUtils.formatearFechaHora(datos.fechaAutorizacion),
        valorSinImpuestos: valorSinImpuestos,
        iva: iva,
        importeTotal: importeTotal
      };
    } catch (error) {
      console.warn('⚠️ Error procesando fila ' + index + ' con mapeo:', error, 'Mapeo:', this.extractor.headerMap);
      return null;
    }
  }

  async updateProgress(progress) {
    try {
      await chrome.storage.local.set({
        progressStatus: {
          mensaje: progress,
          documentosEncontrados: this.extractor.allDocuments.length,
          currentPage: this.extractor.currentPage,
          totalPages: this.extractor.totalPages
        }
      });
    } catch (error) { console.warn('No se pudo actualizar progreso:', error); }
  }

  async guardarResultadoFinalCompleto(resumen) {
    try {
      await chrome.storage.local.set({
        progressStatus: { completed: true, allDocuments: this.extractor.allDocuments, paginationInfo: this.getPaginationInfoRobusta(), resumen },
        facturasData: this.extractor.allDocuments,
        lastExtraction: new Date().toISOString()
      });
    } catch (error) { console.warn('No se pudo guardar resultado final:', error); }
  }

  getPaginationInfoRobusta() {
    try {
      const paginator = document.querySelector(`#frmPrincipal\\:tabla${this.extractor.tipo_emisi}_paginator_bottom`);
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
}

// Clase principal del extractor
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
    this.headerMap = {};

    // Variables adaptadas para paginación robusta
    this.tipo_emisi = "";
    this.movimiento = "PROCESAR";
    this.regs_total = 0;
    this.intentos = 0;
    this.view_state = "";
    this.body_tabla = null;
    this.fila_tabla = null;

    // Inicializar módulos
    this.pagination = new SRIPagination(this);
    this.downloader = new SRIDownloader(this);

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

        case 'buscarTodasLasPaginasSRI':
        case 'buscarTodasLasPaginasRobusta':
          this.pagination.procesarTodasLasPaginasRobusta(message.config || {}).then(result => {
            sendResponse(result);
          }).catch(error => {
            sendResponse({ success: false, error: error.message });
          });
          return true;

        case 'getPaginationInfo':
          const paginationInfo = this.pagination.getPaginationInfoRobusta();
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
          return true;

        default:
          console.warn('⚠️ Acción no reconocida:', message.action);
          sendResponse({ success: false, error: 'Acción no reconocida' });
          return true;
      }
    });
  }

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

  detectCurrentPagination() {
    const paginationInfo = this.pagination.getPaginationInfoRobusta();
    this.currentPage = paginationInfo.current;
    this.totalPages = paginationInfo.total;
  }

  async extractCurrentPageData() {
    try {
      const resultado = this.pagination.detectarTablaRobusta();
      if (!resultado.encontrada) throw new Error('No se encontró tabla de comprobantes');

      this.tipoComprobante = resultado.tipo;
      this.tablaDetectada = resultado.tabla;
      this.extraerDocumentos(resultado.tabla, this.tipoComprobante);
      this.paginationInfo = this.pagination.getPaginationInfoRobusta();

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

    const tablaElement = tbody.closest('table');
    if(tablaElement) {
      this.pagination.mapearCabeceras(tablaElement);
    } else {
      console.error("No se encontró el elemento <table> padre para mapear cabeceras.");
      return;
    }

    for (let i = 0; i < regsTotal; i++) {
      try {
        const fila = tbody.getElementsByTagName("tr")[i];
        const regsActual = Number(fila.getElementsByClassName("ui-dt-c")[0].innerHTML) - 1;
        const filaEspecifica = tbody.querySelector(`tr[data-ri="${regsActual}"]`);
        if (filaEspecifica) {
          const celdas = filaEspecifica.querySelectorAll('td[role="gridcell"]');
          if (celdas.length >= 8) {
            const documento = this.pagination.extraerDatosFilaEspecifica(celdas, tipoComprobante, i, regsActual);
            if (documento) this.documentos.push(documento);
          }
        }
      } catch (error) { console.warn('⚠️ Error extrayendo fila ' + i + ':', error); }
    }
    this.guardarDatos();
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

  // Delegar métodos a módulos
  async verificarDescargasEnPagina(facturas) {
    return this.downloader.verificarDescargasEnPagina(facturas);
  }

  async descargarDocumentosSeleccionados(facturas, formato) {
    return this.downloader.descargarDocumentosSeleccionados(facturas, formato);
  }
}

// Inicializar el extractor y hacerlo globalmente accesible
window.SRIExtractorLoaded = true;
console.log('🔍 Content Script cargado correctamente - Acontplus SRI Tools v1.4.1-Final');
window.sriExtractorInstance = new SRIDocumentosExtractor();