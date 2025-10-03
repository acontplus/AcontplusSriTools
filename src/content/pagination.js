// Módulo de paginación para Acontplus SRI Tools v1.4.1
// Maneja la navegación y procesamiento de múltiples páginas

class SRIPagination {
  constructor(extractorInstance) {
    this.extractor = extractorInstance;
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
                    await SRIUtils.esperar(4000);
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
            await this.updateProgress("Cambiando a la siguiente página...");
            await this.navegarSiguientePaginaRobusta();
            await SRIUtils.esperar(4000);
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
        await this.updateProgress("Procesando documentos " + i + " de " + this.extractor.regs_total);
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

  detectCurrentPagination() {
    const paginationInfo = this.getPaginationInfoRobusta();
    this.extractor.currentPage = paginationInfo.current;
    this.extractor.totalPages = paginationInfo.total;
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
}

// Exportar para uso global
window.SRIPagination = SRIPagination;