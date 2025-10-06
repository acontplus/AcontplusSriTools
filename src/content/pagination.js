// Módulo de paginación para Acontplus SRI Tools v1.4.1
// Maneja la navegación y procesamiento de múltiples páginas

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
    console.log('📊 Iniciando extracción de documentos de página actual...');
    this.extractor.documentos = [];
    this.extractor.intentos = 0;

    const tablaElement = this.extractor.body_tabla.closest('table');
    console.log('🔍 Elemento tabla encontrado:', !!tablaElement);
    if(tablaElement) {
      this.mapearCabeceras(tablaElement);
    } else {
      console.error("❌ No se encontró el elemento <table> padre para mapear cabeceras.");
      return;
    }

    console.log('📋 Procesando', this.extractor.regs_total, 'filas...');
    for (let i = 1; i <= this.extractor.regs_total; i++) {
      try {
        this.extractor.intentos++;
        this.extractor.fila_tabla = this.extractor.body_tabla.getElementsByTagName("tr")[i-1];
        console.log(`🔎 Procesando fila ${i}/${this.extractor.regs_total}, elemento encontrado:`, !!this.extractor.fila_tabla);

        if (this.extractor.fila_tabla) {
          const numeroCelda = this.extractor.fila_tabla.getElementsByClassName("ui-dt-c")[0];
          console.log('📊 Número de celda encontrado:', !!numeroCelda, numeroCelda ? numeroCelda.innerHTML : 'N/A');

          const regs_actual = Number(this.extractor.fila_tabla.getElementsByClassName("ui-dt-c")[0].innerHTML) - 1;
          console.log(`🔢 Número de registro calculado: ${regs_actual}`);

          const filaEspecifica = this.extractor.body_tabla.querySelector(`tr[data-ri="${regs_actual}"]`);
          console.log(`🎯 Fila específica encontrada para data-ri="${regs_actual}":`, !!filaEspecifica);

          if (filaEspecifica) {
            const celdas = filaEspecifica.querySelectorAll('td[role="gridcell"]');
            console.log(`📊 Celdas encontradas: ${celdas.length}`);

            if (celdas.length >= 8) {
              const documento = this.extraerDatosFilaEspecifica(celdas, this.extractor.tipoComprobante, i, regs_actual);
              console.log(`📄 Documento extraído:`, documento ? '✅ Éxito' : '❌ Falló');
              if (documento) {
                this.extractor.documentos.push(documento);
                console.log('➕ Documento agregado a la lista');
              }
            } else {
              console.warn(`⚠️ Insuficientes celdas (${celdas.length}) en fila ${i}`);
            }
          }
        }
        await this.extractor.updateProgress("Procesando documentos " + i + " de " + this.extractor.regs_total);
        this.extractor.intentos = 0;
      } catch (error) {
        console.error(`❌ Error procesando fila ${i}:`, error);
        if (this.extractor.intentos < 2) i--;
      }
    }

    console.log(`✅ Extracción completada: ${this.extractor.documentos.length} documentos extraídos`);
    this.extractor.allDocuments.push(...this.extractor.documentos);
  }

  detectarTablaRobusta() {
    console.log('🔍 Detectando tabla...');
    const tablaRecibidos = document.querySelector('#frmPrincipal\\:tablaCompRecibidos_data');
    console.log('📋 Tabla recibidos encontrada:', !!tablaRecibidos);
    if (tablaRecibidos && tablaRecibidos.childElementCount > 0) {
      console.log('✅ Usando tabla CompRecibidos, elementos:', tablaRecibidos.childElementCount);
      return { encontrada: true, tabla: tablaRecibidos, tipo: 'R' };
    }

    const tablaEmitidos = document.querySelector('#frmPrincipal\\:tablaCompEmitidos_data');
    console.log('📋 Tabla emitidos encontrada:', !!tablaEmitidos);
    if (tablaEmitidos && tablaEmitidos.childElementCount > 0) {
      console.log('✅ Usando tabla CompEmitidos, elementos:', tablaEmitidos.childElementCount);
      return { encontrada: true, tabla: tablaEmitidos, tipo: 'E' };
    }

    console.log('❌ No se encontraron tablas válidas');
    return { encontrada: false };
  }

  mapearCabeceras(tablaElement) {
    console.log('🗂️ Iniciando mapeo de cabeceras...');
    const headerMap = {};
    const headerCells = tablaElement.querySelectorAll('thead th');

    console.log('📊 Cabeceras encontradas en thead:', headerCells.length);
    headerCells.forEach((th, index) => {
      const text = (th.textContent || '').trim().toLowerCase().replace(/\s+/g, ' ');
      console.log(`📋 Cabecera ${index}: "${text}"`);

      // Aplicar reglas de mapeo
      if (text.includes('ruc') && (text.includes('social') || text.includes('receptor'))) {
        headerMap.rucEmisorRaw = index;
        console.log(`   ✅ Mapeado rucEmisorRaw -> ${index}`);
      }
      if (text.includes('número de comprobante') || text.includes('tipo y serie')) {
        headerMap.numero = index;
        console.log(`   ✅ Mapeado numero -> ${index}`);
      }
      if (text.includes('clave de acceso')) {
        headerMap.claveAcceso = index;
        console.log(`   ✅ Mapeado claveAcceso -> ${index}`);
      }
      if (text.includes('fecha') && text.includes('emisión') && !text.includes('autorización')) {
        headerMap.fechaEmision = index;
        console.log(`   ✅ Mapeado fechaEmision -> ${index}`);
      }
      if (text.includes('fecha') && text.includes('autorización')) {
        headerMap.fechaAutorizacion = index;
        console.log(`   ✅ Mapeado fechaAutorizacion -> ${index}`);
      }
      if (text.includes('valor sin impuestos')) {
        headerMap.valorSinImpuestos = index;
        console.log(`   ✅ Mapeado valorSinImpuestos -> ${index}`);
      }
      if (text.includes('iva') && text.length < 10) {
        headerMap.iva = index;
        console.log(`   ✅ Mapeado iva -> ${index}`);
      }
      if (text.includes('importe total')) {
        headerMap.importeTotal = index;
        console.log(`   ✅ Mapeado importeTotal -> ${index}`);
      }
    });

    this.extractor.headerMap = headerMap;
    console.log('🎯 Mapeo de cabeceras final:', this.extractor.headerMap);
    console.log('📊 Total de cabeceras mapeadas:', Object.keys(headerMap).length);
  }

  extraerDatosFilaEspecifica(celdas, tipoComprobante, index, rowIndex) {
    try {
      console.log(`🔧 Extrayendo datos de fila ${index}, celdas disponibles: ${celdas.length}`);
      const h = this.extractor.headerMap;
      console.log('🗂️ Mapeo de cabeceras actual:', h);

      if (Object.keys(h).length < 7) {
        console.error("❌ Mapeo de cabeceras incompleto, no se puede extraer la fila. Cabeceras mapeadas:", Object.keys(h).length);
        return null;
      }

      console.log('✅ Mapeo de cabeceras válido, extrayendo valores...');

      const importeTotal = SRIUtils.extraerNumeroCelda(celdas[h.importeTotal]);
      const valorSinImpuestos = SRIUtils.extraerNumeroCelda(celdas[h.valorSinImpuestos]);
      const iva = h.iva !== undefined ? SRIUtils.extraerNumeroCelda(celdas[h.iva]) : parseFloat((importeTotal - valorSinImpuestos).toFixed(2));

      console.log(`💰 Valores numéricos - Total: ${importeTotal}, Sin Impuestos: ${valorSinImpuestos}, IVA: ${iva}`);

      const datos = {
        rucEmisorRaw: SRIUtils.extraerTextoCelda(celdas[h.rucEmisorRaw]),
        tipoSerie: SRIUtils.extraerTextoCelda(celdas[h.numero]),
        claveAcceso: SRIUtils.extraerTextoCelda(celdas[h.claveAcceso]),
        fechaEmision: SRIUtils.extraerTextoCelda(celdas[h.fechaEmision]),
        fechaAutorizacion: SRIUtils.extraerTextoCelda(celdas[h.fechaAutorizacion]),
      };

      console.log('📝 Datos extraídos:', datos);

      const rucRazonData = SRIUtils.separarRucRazonSocial(datos.rucEmisorRaw);
      const tipoSerieData = SRIUtils.separarTipoSerie(datos.tipoSerie);

      console.log('🏢 RUC/Razón social:', rucRazonData);
      console.log('📄 Tipo/Serie/Número:', tipoSerieData);

      const documentoFinal = {
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

      console.log('📋 Documento final creado:', documentoFinal);
      return documentoFinal;

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

// Exportar globalmente para compatibilidad con extensiones
window.SRIPagination = SRIPagination;
console.log('✅ SRIPagination exportado globalmente');