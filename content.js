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

  async descargarDocumentosSeleccionados(facturas, formato) {
    console.log(`Iniciando descarga de ${facturas.length} documentos en formato ${formato}`);
    let descargados = 0;
    let fallidos = 0;
    
    for (let i = 0; i < facturas.length; i++) {
        // Se actualiza el ViewState antes de cada descarga para máxima estabilidad
        this.view_state = document.querySelector("#javax\\.faces\\.ViewState")?.value || this.view_state;
        const factura = facturas[i];
        
        // Notificar al popup sobre el progreso
        chrome.runtime.sendMessage({ action: 'updateDownloadProgress', current: i + 1, total: facturas.length });
  
        try {
            const originalIndex = factura.rowIndex;
            if (originalIndex === undefined || originalIndex < 0) {
                console.warn(`No se encontró el índice de fila para el documento con ID ${factura.id}. Saltando.`);
                fallidos++;
                continue;
            }

            const exito = await this.descargarUnicoDocumento(factura, formato, originalIndex);
            if(exito) descargados++;
            else fallidos++;

            await this.esperar(300); // Pausa para estabilidad
        } catch (error) {
            console.error(`Error descargando ${factura.claveAcceso}:`, error);
            fallidos++;
        }
    }
  
    // Enviar mensaje final al popup
    chrome.runtime.sendMessage({
      action: 'descargaFinalizada',
      exitosos: descargados,
      fallidos: fallidos,
      total: facturas.length
    });
  }

  async descargarUnicoDocumento(factura, formato, originalIndex) {
    const url_links = window.location.href;
    // MODIFICACIÓN: El nombre del archivo ahora usa el contenido de la columna "Numero"
    const name_files = `${factura.numero.replace(/ /g, '_')}.${formato}`;
    
    let text_body = `frmPrincipal=frmPrincipal&javax.faces.ViewState=${encodeURIComponent(this.view_state)}&g-recaptcha-response=`;

    if (this.tipo_emisi === "CompRecibidos") {
        const fecha = new Date(factura.fechaEmision);
        text_body += `&frmPrincipal%3Aopciones=ruc&frmPrincipal%3Aano=${fecha.getFullYear()}&frmPrincipal%3Ames=${fecha.getMonth() + 1}&frmPrincipal%3Adia=${fecha.getDate()}`;
    } else {
        text_body += `&frmPrincipal%3Aopciones=ruc&frmPrincipal%3AcalendarFechaDesde_input=${new Date(factura.fechaEmision).toLocaleDateString('es-EC')}`;
    }
    
    text_body += `&frmPrincipal%3Atabla${this.tipo_emisi}%3A${originalIndex}%3Alnk${formato.charAt(0).toUpperCase() + formato.slice(1)}=frmPrincipal%3Atabla${this.tipo_emisi}%3A${originalIndex}%3Alnk${formato.charAt(0).toUpperCase() + formato.slice(1)}`;

    const exito = await this.fetchParaDescarga(url_links, text_body, formato, name_files);
    return exito;
  }

  async fetchParaDescarga(urlSRI, frmBody, frmFile, nameFile) {
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

        const contentType = frmFile === 'xml' ? 'application/xml' : 'application/pdf';
        const data = await response.blob();
        const blob = new Blob([data], { type: contentType });
        const downloadLink = document.createElement('a');
        downloadLink.href = window.URL.createObjectURL(blob);
        downloadLink.download = nameFile;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        
        return new Promise(resolve => {
            setTimeout(() => {
                window.URL.revokeObjectURL(downloadLink.href);
                document.body.removeChild(downloadLink);
                resolve(true); // Download initiated successfully
            }, 500);
        });

    } catch (error) {
        console.error("Error en fetchParaDescarga:", error);
        return false; // Download failed
    }
  }


  // Detectar tipo de emisión usando técnica robusta
  detectarTipoEmisionRobusta() {
    try {
      // Usar selectores específicos del portal SRI
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
        // Fallback basado en URL
        if (window.location.href.includes('recibidos')) {
          this.tipo_emisi = "CompRecibidos";
        } else {
          this.tipo_emisi = "CompEmitidos";
        }
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
      // PASO 1: Detectar tabla usando método robusto
      const resultadoInicial = this.detectarTablaRobusta();
      
      if (!resultadoInicial.encontrada) {
        throw new Error('No se encontró tabla de comprobantes en la página actual');
      }

      this.tipoComprobante = resultadoInicial.tipo;
      const tipoTexto = this.tipoComprobante === 'R' ? 'RECIBIDOS' : 'EMITIDOS';
      console.log('✅ Tabla detectada: Documentos', tipoTexto);

      // PASO 2: Ejecutar lógica de descarga adaptada
      await this.ejecutarLogicaDescargaRobusta();

      // PASO 3: Finalizar y guardar resultados
      const resumenFinal = {
        documentosEncontrados: this.allDocuments.length,
        paginasProcesadas: this.totalPages,
        tipoComprobante: tipoTexto,
        optimizacionAplicada: this.movimiento === "REPAGINAR"
      };

      console.log('🎉 === BÚSQUEDA COMPLETA FINALIZADA ===', resumenFinal);

      // Guardar resultados finales
      await this.guardarResultadoFinalCompleto(resumenFinal);

      this.isProcessingPagination = false;

      return {
        success: true,
        message: 'Búsqueda completa finalizada: ' + this.allDocuments.length + ' documentos encontrados',
        allDocuments: this.allDocuments,
        paginationInfo: { current: this.totalPages, total: this.totalPages },
        totalPages: this.totalPages,
        optimization: resumenFinal.optimizacionAplicada ? { optimized: true, message: 'Páginas optimizadas usando técnica robusta' } : { optimized: false }
      };

    } catch (error) {
      console.error('❌ Error en búsqueda completa:', error);
      this.isProcessingPagination = false;
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Lógica principal de descarga
  async ejecutarLogicaDescargaRobusta() {
    console.log('🔄 Ejecutando lógica robusta adaptada...');
    
    // Aplicar repaginación si está configurada
    if (this.movimiento === "REPAGINAR") {
      console.log('⚡ Aplicando repaginación robusta...');
      await this.aplicarRepaginacionRobusta();
      this.movimiento = "PROCESAR"; // Cambiar a proceso después de repaginar
    }

    // Procesar todas las páginas
    await this.procesarPaginasRecursivamente();
  }

  // Repaginación automática robusta
  async aplicarRepaginacionRobusta() {
    try {
      const paginatorSelector = '#frmPrincipal\\:tabla' + this.tipo_emisi + '_paginator_bottom';
      const paginator = document.querySelector(paginatorSelector);
      
      if (paginator) {
        const currentElement = paginator.querySelector('.ui-paginator-current');
        if (currentElement) {
          const paginatorText = currentElement.textContent;
          const numbers = paginatorText.match(/\d+/g);
          
          if (numbers && numbers.length >= 2) {
            const paginaActual = parseInt(numbers[1]);
            console.log('📊 Página actual detectada:', paginaActual);
            
            if (paginaActual > 1) {
              await this.updateProgress("Espere..Repaginado la cantidad visible...");
              
              // Aplicar técnica robusta: maximizar a 300
              const dmax = 300;
              const po = document.querySelector('.ui-paginator-rpp-options');
              
              if (po) {
                const nd = po.querySelector('option');
                if (nd) {
                  nd.value = dmax;
                  nd.textContent = dmax;
                  nd.selected = true;
                  
                  const tmp_evento = new Event('change');
                  po.dispatchEvent(tmp_evento);
                  
                  console.log('✅ Repaginación aplicada: ' + dmax + ' registros por página');
                  
                  // Esperar tiempo optimizado
                  await this.esperar(4000);
                  return true;
                }
              }
            }
          }
        }
      }
      
      console.log('ℹ️ Repaginación no necesaria o no disponible');
      return false;
      
    } catch (error) {
      console.error('❌ Error en repaginación:', error);
      return false;
    }
  }

  // Procesamiento recursivo página por página
  async procesarPaginasRecursivamente() {
    try {
      // Detectar tabla actual
      const tablaActual = this.detectarTablaRobusta();
      
      if (tablaActual.encontrada) {
        this.body_tabla = tablaActual.tabla;
        this.regs_total = this.body_tabla.childElementCount;
        
        // Obtener ViewState (necesario para JSF)
        const viewStateElement = document.querySelector('#javax\\.faces\\.ViewState');
        if (viewStateElement) {
          this.view_state = viewStateElement.value;
        }
        
        if (this.regs_total > 0) {
          console.log('📊 Procesando página con ' + this.regs_total + ' registros');
          
          // Extraer documentos de la página actual
          await this.extraerDocumentosPaginaActual();
          
          // Verificar si hay página siguiente
          const hayPaginaSiguiente = await this.verificarPaginaSiguienteRobusta();
          
          if (hayPaginaSiguiente) {
            await this.updateProgress("Cambiando a la siguiente página...");
            console.log('🔄 Avanzando a la siguiente página');
            
            // Navegar usando método robusto
            await this.navegarSiguientePaginaRobusta();
            
            // Esperar carga y continuar recursivamente
            await this.esperar(4000);
            await this.procesarPaginasRecursivamente();
          } else {
            await this.updateProgress("Terminado... :-)");
            console.log("✅ Ya no hay más páginas..!!");
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error en procesamiento recursivo:', error);
    }
  }

  // Verificar página siguiente usando método robusto
  async verificarPaginaSiguienteRobusta() {
    try {
      // Método robusto para detectar si hay página siguiente
      const paginaSiguienteDeshabilitada = document.getElementsByClassName('ui-paginator-next ui-state-default ui-corner-all ui-state-disabled');
      
      // Si no hay elementos deshabilitados, hay página siguiente
      return paginaSiguienteDeshabilitada.length === 0;
      
    } catch (error) {
      console.error('❌ Error verificando página siguiente:', error);
      return false;
    }
  }

  // Navegar a siguiente página usando método robusto
  async navegarSiguientePaginaRobusta() {
    try {
      // Método robusto para navegar
      const botonSiguiente = document.getElementsByClassName('ui-icon ui-icon-seek-next')[0];
      
      if (botonSiguiente) {
        botonSiguiente.click();
        return true;
      }
      
      console.warn('⚠️ No se encontró botón de página siguiente');
      return false;
      
    } catch (error) {
      console.error('❌ Error navegando a página siguiente:', error);
      return false;
    }
  }

  // Extraer documentos de página actual
  async extraerDocumentosPaginaActual() {
    console.log('📊 Extrayendo documentos de página actual...');
    
    this.documentos = []; // Limpiar documentos de página actual
    this.intentos = 0;
    
    for (let i = 1; i <= this.regs_total; i++) {
      try {
        this.intentos++;
        this.fila_tabla = this.body_tabla.getElementsByTagName("tr")[i-1];
        
        if (this.fila_tabla) {
          const regs_actual = Number(this.fila_tabla.getElementsByClassName("ui-dt-c")[0].innerHTML) - 1;
          const filaEspecifica = this.body_tabla.querySelector('tr[data-ri="' + regs_actual + '"]');
          
          if (filaEspecifica) {
            const celdas = filaEspecifica.querySelectorAll('td[role="gridcell"]');
            
            if (celdas.length >= 8) {
              const documento = this.extraerDatosFilaEspecifica(celdas, this.tipoComprobante, i, regs_actual);
              if (documento) {
                this.documentos.push(documento);
              }
            }
          }
        }
        
        await this.updateProgress("Procesando documentos " + i + " de " + this.regs_total);
        this.intentos = 0;
        
      } catch (error) {
        console.warn('⚠️ Error extrayendo fila ' + i + ':', error);
        if (this.intentos < 2) {
          i--; // Reintentar
        }
      }
    }
    
    // Agregar documentos de esta página al total
    this.allDocuments.push(...this.documentos);
    
    console.log('✅ Página procesada: ' + this.documentos.length + ' documentos extraídos');
    console.log('📊 Total acumulado: ' + this.allDocuments.length + ' documentos');
  }

  // Detectar tabla usando método robusto
  detectarTablaRobusta() {
    console.log('🔍 Detectando tabla usando método robusto...');
    
    // Verificar tablas específicas primero
    const tablaRecibidos = document.querySelector('#frmPrincipal\\:tablaCompRecibidos_data');
    const tablaEmitidos = document.querySelector('#frmPrincipal\\:tablaCompEmitidos_data');
    
    if (tablaRecibidos && tablaRecibidos.childElementCount > 0) {
      console.log('✅ Tabla CompRecibidos detectada con ' + tablaRecibidos.childElementCount + ' registros');
      return {
        encontrada: true,
        tabla: tablaRecibidos,
        tipo: 'R',
        registros: tablaRecibidos.childElementCount
      };
    }
    
    if (tablaEmitidos && tablaEmitidos.childElementCount > 0) {
      console.log('✅ Tabla CompEmitidos detectada con ' + tablaEmitidos.childElementCount + ' registros');
      return {
        encontrada: true,
        tabla: tablaEmitidos,
        tipo: 'E',
        registros: tablaEmitidos.childElementCount
      };
    }
    
    // Fallback: método genérico
    const tbodyElements = document.querySelectorAll('tbody');
    
    for (const elemento of tbodyElements) {
      if (elemento.childElementCount >= 1) {
        const primeraFila = elemento.querySelector('tr[data-ri="0"]');
        
        if (primeraFila) {
          const celdas = primeraFila.querySelectorAll('td[role="gridcell"]');
          
          if (celdas.length >= 8) {
            console.log('✅ Tabla genérica detectada con ' + celdas.length + ' columnas');
            
            return {
              encontrada: true,
              tabla: elemento,
              tipo: celdas.length === 9 ? 'R' : 'E',
              registros: elemento.childElementCount
            };
          }
        }
      }
    }
    
    console.log('ℹ️ No se encontraron tablas válidas en esta página');
    return { encontrada: false };
  }

  // Obtener información de paginación usando método robusto
  getPaginationInfoRobusta() {
    try {
      const paginatorSelector = '#frmPrincipal\\:tabla' + this.tipo_emisi + '_paginator_bottom';
      const paginator = document.querySelector(paginatorSelector);
      
      if (paginator) {
        const currentElement = paginator.querySelector('.ui-paginator-current');
        if (currentElement) {
          const paginatorText = currentElement.textContent;
          const numbers = paginatorText.match(/\d+/g);
          
          if (numbers && numbers.length >= 2) {
            const currentPage = parseInt(numbers[1]) || 1;
            const totalPages = parseInt(numbers[1]) || 1;
            
            return {
              current: currentPage,
              total: totalPages
            };
          }
        }
      }
      
      // Fallback: método genérico
      return this.getPaginationInfoGenerico();
      
    } catch (error) {
      console.warn('Error detectando paginación:', error);
      return { current: 1, total: 1 };
    }
  }

  // Función auxiliar para paginación genérica
  getPaginationInfoGenerico() {
    try {
      let currentPage = 1;
      let totalPages = 1;
      
      const activePageSelectors = [
        '.ui-paginator-page.ui-state-active',
        '.ui-paginator-current',
        '.paginator-current'
      ];
      
      for (const selector of activePageSelectors) {
        const activeElement = document.querySelector(selector);
        if (activeElement) {
          const pageText = activeElement.textContent.trim();
          const pageNum = parseInt(pageText);
          if (!isNaN(pageNum) && pageNum > 0) {
            currentPage = pageNum;
            break;
          }
        }
      }

      const totalPagesSelectors = [
        '.ui-paginator-pages .ui-paginator-page:last-child'
      ];
      
      for (const selector of totalPagesSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          if (!element.classList.contains('ui-paginator-next') && 
              !element.classList.contains('ui-paginator-last')) {
            const pageText = element.textContent.trim();
            const pageNum = parseInt(pageText);
            if (!isNaN(pageNum) && pageNum > 0) {
              totalPages = Math.max(totalPages, pageNum);
            }
          }
        }
      }

      return {
        current: currentPage,
        total: totalPages
      };

    } catch (error) {
      console.warn('Error detectando paginación genérica:', error);
      return { current: 1, total: 1 };
    }
  }

  // Detectar información de paginación actual
  detectCurrentPagination() {
    try {
      const paginationInfo = this.getPaginationInfoRobusta();
      this.currentPage = paginationInfo.current;
      this.totalPages = paginationInfo.total;
      
      console.log('📄 Paginación detectada: ' + this.currentPage + '/' + this.totalPages);
    } catch (error) {
      console.warn('No se pudo detectar paginación:', error);
      this.currentPage = 1;
      this.totalPages = 1;
    }
  }

  // Extraer datos de la página actual
  async extractCurrentPageData() {
    console.log('📊 Extrayendo datos de página actual...');

    try {
      const resultado = this.detectarTablaRobusta();
      
      if (!resultado.encontrada) {
        throw new Error('No se encontró tabla de comprobantes en la página actual');
      }

      this.tipoComprobante = resultado.tipo;
      this.tablaDetectada = resultado.tabla;

      this.extraerDocumentos(resultado.tabla, this.tipoComprobante);

      const paginationInfo = this.getPaginationInfoRobusta();
      this.paginationInfo = paginationInfo;

      return {
        success: true,
        documentos: this.documentos,
        tipoComprobante: this.tipoComprobante,
        paginationInfo: paginationInfo,
        message: this.documentos.length + ' documentos extraídos de página ' + paginationInfo.current
      };

    } catch (error) {
      console.error('❌ Error extrayendo datos de página actual:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  extraerDocumentos(tbody, tipoComprobante) {
    console.log('📊 Extrayendo documentos del SRI...');
    console.log('📋 Tipo:', tipoComprobante === 'R' ? 'Recibidos' : 'Emitidos');
    
    const regsTotal = tbody.childElementCount;
    this.documentos = [];

    for (let i = 0; i < regsTotal; i++) {
      try {
        const fila = tbody.getElementsByTagName("tr")[i];
        const regsActual = Number(fila.getElementsByClassName("ui-dt-c")[0].innerHTML) - 1;
        
        const filaEspecifica = tbody.querySelector('tr[data-ri="' + regsActual + '"]');
        if (!filaEspecifica) {
          console.warn('⚠️ No se encontró fila con data-ri="' + regsActual + '"');
          continue;
        }
        
        const celdas = filaEspecifica.querySelectorAll('td[role="gridcell"]');
        if (celdas.length < 8) {
          console.warn('⚠️ Fila ' + i + ' tiene pocas celdas: ' + celdas.length);
          continue;
        }
        
        const documento = this.extraerDatosFilaEspecifica(celdas, tipoComprobante, i, regsActual);
        if (documento) {
          this.documentos.push(documento);
        }
        
      } catch (error) {
        console.warn('⚠️ Error extrayendo fila ' + i + ':', error);
      }
    }

    console.log('✅ ' + this.documentos.length + ' documentos extraídos correctamente');
    this.guardarDatos();
  }

  extraerDatosFilaEspecifica(celdas, tipoComprobante, index, rowIndex) {
    try {
      let datos;
      
      if (tipoComprobante === 'R') {
        datos = {
          numero: this.extraerTextoCelda(celdas[0]),
          rucEmisorRaw: this.extraerTextoCelda(celdas[1]),
          tipoSerie: this.extraerTextoCelda(celdas[2]),
          claveAcceso: this.extraerTextoCelda(celdas[3]),
          fechaAutorizacion: this.extraerTextoCelda(celdas[4]),
          fechaEmision: this.extraerTextoCelda(celdas[5]),
          valorSinImpuestos: this.extraerNumeroCelda(celdas[6]),
          iva: this.extraerNumeroCelda(celdas[7]),
          importeTotal: this.extraerNumeroCelda(celdas[8])
        };
      } else {
        datos = {
          numero: this.extraerTextoCelda(celdas[0]),
          rucEmisorRaw: this.extraerTextoCelda(celdas[1]),
          claveAcceso: this.extraerTextoCelda(celdas[2]),
          tipoSerie: this.extraerTextoCelda(celdas[3]),
          fechaAutorizacion: this.extraerTextoCelda(celdas[4]),
          fechaEmision: this.extraerTextoCelda(celdas[5]),
          valorSinImpuestos: this.extraerNumeroCelda(celdas[6]),
          iva: this.extraerNumeroCelda(celdas[7]),
          importeTotal: this.extraerNumeroCelda(celdas[8])
        };
      }
      
      const rucRazonData = this.separarRucRazonSocial(datos.rucEmisorRaw);
      const ruc = rucRazonData[0];
      const razonSocial = rucRazonData[1];
      
      const tipoSerieData = this.separarTipoSerie(datos.tipoSerie);
      const tipoComprobanteFinal = tipoSerieData[0];
      const serie = tipoSerieData[1];
      const numeroComprobante = tipoSerieData[2];
      
      const documentoProcesado = {
        rowIndex: rowIndex,
        id: tipoComprobanteFinal + '_' + serie + '_' + numeroComprobante + '_' + index + '_' + Date.now(),
        numero: datos.tipoSerie,
        ruc: ruc,
        razonSocial: razonSocial,
        tipoComprobante: tipoComprobanteFinal,
        serie: serie,
        numeroComprobante: numeroComprobante,
        claveAcceso: datos.claveAcceso,
        fechaAutorizacion: this.formatearFecha(datos.fechaAutorizacion),
        fechaEmision: this.formatearFecha(datos.fechaEmision),
        valorSinImpuestos: datos.valorSinImpuestos,
        iva: datos.iva,
        importeTotal: datos.importeTotal
      };
      
      return documentoProcesado;
      
    } catch (error) {
      console.warn('⚠️ Error procesando fila ' + index + ':', error);
      return null;
    }
  }

  extraerTextoCelda(celda) {
    if (!celda) return '';
    const texto = celda.textContent;
    return texto ? texto.trim() : '';
  }

  extraerNumeroCelda(celda) {
    if (!celda) return 0;
    
    const texto = celda.textContent;
    if (!texto) return 0;
    
    const textoLimpio = texto.trim();
    const numeroLimpio = textoLimpio.replace(/[^\d.-]/g, '').replace(',', '.');
    
    const numero = parseFloat(numeroLimpio);
    return isNaN(numero) ? 0 : Math.abs(numero);
  }

  separarRucRazonSocial(texto) {
    if (!texto) return ['', ''];
    
    const lineas = texto.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0);
    
    if (lineas.length >= 2) {
      const ruc = lineas[0];
      const razonSocial = lineas.slice(1).join(' ').trim();
      
      if (/^\d{10,13}$/.test(ruc)) {
        return [ruc, razonSocial];
      }
    }
    
    const match = texto.match(/(\d{10,13})\s+(.+)/);
    if (match) {
      return [match[1].trim(), match[2].trim()];
    }
    
    const rucMatch = texto.match(/\d{10,13}/);
    if (rucMatch) {
      const ruc = rucMatch[0];
      const razonSocial = texto.replace(ruc, '').trim();
      return [ruc, razonSocial];
    }
    
    return ['', texto.trim()];
  }

  separarTipoSerie(texto) {
    if (!texto) return ['', '', ''];
    
    const match = texto.match(/([^0-9]+)\s*(\d{1,3}-\d{1,3}-\d+)/);
    if (match) {
      const tipo = match[1].trim();
      const serieCompleta = match[2];
      const partes = serieCompleta.split('-');
      
      if (partes.length >= 3) {
        const establecimiento = partes[0];
        const puntoEmision = partes[1];
        const secuencial = partes.slice(2).join('');
        
        return [tipo, establecimiento + '-' + puntoEmision, secuencial];
      }
    }
    
    return [texto.trim(), '', ''];
  }

  formatearFecha(fechaTexto) {
    if (!fechaTexto) return '';
    
    const match = fechaTexto.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      const dia = match[1];
      const mes = match[2];
      const año = match[3];
      return año + '-' + mes.padStart(2, '0') + '-' + dia.padStart(2, '0');
    }
    
    return fechaTexto;
  }

  async updateProgress(progress) {
    const progreso = {
      currentPage: this.currentPage,
      totalPages: this.totalPages,
      completed: false,
      allDocuments: this.allDocuments,
      mensaje: progress,
      documentosEncontrados: this.allDocuments.length,
      porcentaje: Math.round((this.allDocuments.length / Math.max(this.allDocuments.length + 10, 100)) * 100),
      timestamp: new Date().toISOString()
    };

    try {
      await chrome.storage.local.set({ progressStatus: progreso });
      console.log('📊 Progreso actualizado: ' + progress + ' - ' + this.allDocuments.length + ' docs');
    } catch (error) {
      console.warn('No se pudo actualizar progreso:', error);
    }
  }

  async guardarResultadoFinalCompleto(resumen) {
    const resultadoFinal = {
      currentPage: this.totalPages,
      totalPages: this.totalPages,
      completed: true,
      allDocuments: this.allDocuments,
      paginationInfo: { current: this.totalPages, total: this.totalPages },
      resumen: resumen,
      timestamp: new Date().toISOString(),
      optimization: resumen.optimizacionAplicada ? {
        optimized: true,
        message: 'Búsqueda optimizada usando técnicas robustas en ' + this.totalPages + ' páginas'
      } : { optimized: false }
    };

    try {
      await chrome.storage.local.set({ 
        progressStatus: resultadoFinal,
        facturasData: this.allDocuments,
        lastExtraction: new Date().toISOString()
      });
      console.log('✅ Resultado final completo guardado en storage');
    } catch (error) {
      console.warn('No se pudo guardar resultado final:', error);
    }
  }

  guardarDatos() {
    const datos = {
      documentos: this.documentos,
      timestamp: new Date().toISOString(),
      tipoComprobante: this.tipoComprobante,
      paginationInfo: this.paginationInfo
    };

    try {
      chrome.storage.local.set({ 
        facturasData: this.documentos,
        lastExtraction: new Date().toISOString()
      });
    } catch (error) {
      console.warn('No se pudieron guardar los datos:', error);
    }
  }

  esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Inicializar el extractor y hacerlo globalmente accesible
window.sriExtractorInstance = new SRIDocumentosExtractor();