// Módulo principal del extractor para Acontplus SRI Tools v1.4.1
// Maneja la detección y extracción básica de documentos

class SRIDocumentosExtractor {
  constructor() {
    console.log('🏗️ Construyendo SRIDocumentosExtractor...');
    this.documentos = [];
    this.allDocuments = [];
    this.tablaDetectada = null;
    this.tipoComprobante = null;
    this.version = '1.4.1-Final';
    this.paginationInfo = { current: 1, total: 1 };
    this.isProcessingPagination = false;
    this.currentPage = 1;
    this.totalPages = 1;
    this.headerMap = {}; // Mapa dinámico de columnas

    // Variables adaptadas para paginación robusta
    this.tipo_emisi = ""; // CompRecibidos o CompEmitidos
    this.movimiento = "PROCESAR"; // REPAGINAR o PROCESAR
    this.regs_total = 0;
    this.intentos = 0;
    this.view_state = "";
    this.body_tabla = null;
    this.fila_tabla = null;

    console.log('🔗 Inicializando módulos dependientes...');
    console.log('📄 Verificando SRIPagination:', typeof SRIPagination);
    this.pagination = new SRIPagination(this);
    console.log('📥 Verificando SRIDownloader:', typeof SRIDownloader);
    this.downloader = new SRIDownloader(this);
    console.log('✅ Módulos inicializados correctamente');

    this.init();
  }

  init() {
    console.log('🚀 SRI Documentos Extractor v' + this.version + ' iniciado - Acontplus S.A.S.');
    console.log('🔧 Configurando message listener...');
    this.setupMessageListener();
    console.log('🔍 Detectando tipo de emisión...');
    this.detectarTipoEmisionRobusta();
    console.log('📄 Detectando paginación actual...');
    this.detectCurrentPagination();
    console.log('✅ Inicialización completa del extractor');
  }

  setupMessageListener() {
    console.log('👂 Configurando message listener para comunicación con popup...');
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('📨 Mensaje recibido desde popup/background:', message);

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
      console.log('🔍 Buscando tablas de comprobantes en el DOM...');
      const tablaRecibidos = document.querySelector('#frmPrincipal\\:tablaCompRecibidos_data');
      const tablaEmitidos = document.querySelector('#frmPrincipal\\:tablaCompEmitidos_data');

      console.log('📊 Tabla recibidos encontrada:', !!tablaRecibidos, tablaRecibidos ? `con ${tablaRecibidos.childElementCount} filas` : '');
      console.log('📊 Tabla emitidos encontrada:', !!tablaEmitidos, tablaEmitidos ? `con ${tablaEmitidos.childElementCount} filas` : '');

      if (tablaRecibidos && tablaRecibidos.childElementCount > 0) {
        this.tipo_emisi = "CompRecibidos";
        this.body_tabla = tablaRecibidos;
        console.log('✅ Tipo detectado: CompRecibidos');
      } else if (tablaEmitidos && tablaEmitidos.childElementCount > 0) {
        this.tipo_emisi = "CompEmitidos";
        this.body_tabla = tablaEmitidos;
        console.log('✅ Tipo detectado: CompEmitidos');
      } else {
        if (window.location.href.includes('recibidos')) this.tipo_emisi = "CompRecibidos";
        else this.tipo_emisi = "CompEmitidos";
        console.log('⚠️ No se encontraron tablas con datos, tipo detectado por URL:', this.tipo_emisi);
      }
    } catch (error) {
      console.warn('❌ Error detectando tipo emisión:', error);
      this.tipo_emisi = "CompEmitidos";
    }
  }

  detectCurrentPagination() {
    this.pagination.detectCurrentPagination();
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

  // Delegar métodos de descarga al módulo correspondiente
  async verificarDescargasEnPagina(facturas) {
    return this.downloader.verificarDescargasEnPagina(facturas);
  }

  async descargarDocumentosSeleccionados(facturas, formato) {
    return this.downloader.descargarDocumentosSeleccionados(facturas, formato);
  }
}

// Exportar para uso global
window.SRIDocumentosExtractor = SRIDocumentosExtractor;
console.log('✅ SRIDocumentosExtractor exportado globalmente');