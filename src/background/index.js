// Background Script principal modular para Acontplus SRI Tools v1.4.1 - Final
// Punto de entrada que integra todos los servicios de background

console.log('🚀 Background Script modular cargado - Acontplus SRI Tools v1.4.1-Final');

// [MÓDULOS INCLUIDOS INLINE PARA COMPATIBILIDAD CON SERVICE WORKER]

// Servicio de gestión de estado para background script
class StateManager {
  constructor() {
    this.estadoActual = "Esperando conexión...";
    this.procesoActivo = false;
    this.ultimaExtraccion = null;
    this.estadisticasRobustas = {
      totalExtracciones: 0,
      documentosProcesados: 0,
      paginasOptimizadas: 0,
      tiempoPromedio: 0
    };
  }

  setEstado(estado) { this.estadoActual = estado; }
  setProcesoActivo(activo) { this.procesoActivo = activo; }
  setUltimaExtraccion(extraccion) { this.ultimaExtraccion = extraccion; }
  updateEstadisticas(nuevasEstadisticas) { this.estadisticasRobustas = { ...this.estadisticasRobustas, ...nuevasEstadisticas }; }

  obtenerFechaFormateada() {
    return new Date().toLocaleString('es-EC', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  }

  generarIdUnico() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }
}

// Servicio de monitoreo de performance
class PerformanceMonitor {
  constructor() { this.setupHeartbeat(); this.setupCleanup(); this.setupErrorHandling(); }

  monitorearPerformance(evento, datos = {}) {
    const registro = { evento, timestamp: Date.now(), datos, version: '1.4.1-Final' };
    console.log('📈 Performance:', registro);
    chrome.storage.local.get(['metricas']).then(result => {
      const metricas = result.metricas || [];
      metricas.push(registro);
      if (metricas.length > 100) metricas.splice(0, metricas.length - 100);
      chrome.storage.local.set({ metricas });
    });
  }

  limpiarDatosAntiguos() {
    const SEMANA_EN_MS = 7 * 24 * 60 * 60 * 1000;
    const ahora = Date.now();
    chrome.storage.local.get(['metricas']).then(result => {
      if (result.metricas) {
        const metricasLimpias = result.metricas.filter(metrica => (ahora - metrica.timestamp) < SEMANA_EN_MS);
        chrome.storage.local.set({ metricas: metricasLimpias, ultimaLimpieza: ahora });
        console.log('🧹 Limpieza de datos completada');
      }
    });
  }

  setupHeartbeat() { setInterval(() => console.log('💓 Background script activo - v1.4.1-Final'), 5 * 60 * 1000); }
  setupCleanup() { setInterval(() => this.limpiarDatosAntiguos(), 24 * 60 * 60 * 1000); }

  setupErrorHandling() {
    self.addEventListener('error', (event) => {
      console.error('❌ Error global en background:', event.error);
      this.monitorearPerformance('error', { mensaje: event.error.message, linea: event.lineno, archivo: event.filename });
    });
  }
}

// Servicio de notificaciones
class NotificationManager {
  constructor(stateManager) { this.stateManager = stateManager; }

  mostrarBienvenida() {
    const mensajeBienvenida = { type: 'basic', iconUrl: 'icons/icon48.png', title: 'Acontplus SRI Tools v1.4.1', message: '¡Bienvenido! Extracción robusta y optimizada de documentos SRI.' };
    if (chrome.notifications) chrome.notifications.create('bienvenida', mensajeBienvenida);
    chrome.storage.local.set({ primeraInstalacion: true, fechaInstalacion: new Date().toISOString(), version: '1.4.1-Final' });
  }

  mostrarActualizacion(versionAnterior) {
    const mensajeActualizacion = { type: 'basic', iconUrl: 'icons/icon48.png', title: 'Acontplus SRI Tools - Actualizado', message: `Actualizado de v${versionAnterior} a v1.4.1 con mejoras de interfaz.` };
    if (chrome.notifications) chrome.notifications.create('actualizacion', mensajeActualizacion);
    if (versionAnterior && (versionAnterior.startsWith('1.3') || versionAnterior.startsWith('1.4.0'))) this.migrarDatosVersionAnterior(versionAnterior);
  }

  async migrarDatosVersionAnterior(versionAnterior) {
    try {
      console.log('🔄 Migrando datos de v' + versionAnterior + ' a v1.4.1...');
      const datosAnteriores = await chrome.storage.local.get(['facturasData', 'lastExtraction', 'progressStatus']);
      if (datosAnteriores.facturasData) {
        await chrome.storage.local.set({
          facturasDataBackup: datosAnteriores.facturasData,
          migracionCompletada: true,
          fechaMigracion: new Date().toISOString(),
          versionAnterior: versionAnterior
        });
      }
      console.log('✅ Migración completada exitosamente');
    } catch (error) { console.error('❌ Error en migración:', error); }
  }
}

// Servicio de manejo de mensajes
class MessageHandler {
  constructor(stateManager) { this.stateManager = stateManager; this.setupListeners(); }

  setupListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('📨 Background recibió mensaje:', message);
      this.handleMessage(message, sender, sendResponse);
      return true;
    });
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'obtenerEstado': sendResponse(await this.getEstado()); break;
        case 'updateProgress': sendResponse(await this.updateProgress(message)); break;
        case 'procesoCompletado': sendResponse(await this.procesoCompletado(message)); break;
        case 'resetearEstado': sendResponse(await this.resetearEstado()); break;
        case 'obtenerEstadisticas': sendResponse(await this.getEstadisticas()); break;
        default: console.warn('⚠️ Acción no reconocida:', message.action); sendResponse({ success: false, error: 'Acción no reconocida' });
      }
    } catch (error) { console.error('❌ Error procesando mensaje:', error); sendResponse({ success: false, error: error.message }); }
  }

  async getEstado() { return { res: this.stateManager.estadoActual, procesoActivo: this.stateManager.procesoActivo, ultimaExtraccion: this.stateManager.ultimaExtraccion, estadisticasRobustas: this.stateManager.estadisticasRobustas, version: '1.4.1-Final' }; }

  async updateProgress(message) {
    this.stateManager.estadoActual = message.progress; this.stateManager.procesoActivo = true;
    if (message.progress.includes('optimizacion') || message.progress.includes('repaginando')) {
      console.log('📊 Progreso con optimización:', message.progress); this.stateManager.estadisticasRobustas.paginasOptimizadas++;
    }
    await chrome.storage.local.set({ estadoActual: this.stateManager.estadoActual, procesoActivo: this.stateManager.procesoActivo, timestamp: Date.now() });
    return { success: true };
  }

  async procesoCompletado(message) {
    this.stateManager.estadoActual = message.mensaje || "Proceso completado"; this.stateManager.procesoActivo = false;
    this.stateManager.ultimaExtraccion = { fecha: new Date().toISOString(), documentos: message.documentos || 0, metodo: 'Tecnicas-Robustas-v1.4.1', optimizacionAplicada: message.optimizacionAplicada || false };
    this.stateManager.estadisticasRobustas.totalExtracciones++; this.stateManager.estadisticasRobustas.documentosProcesados += (message.documentos || 0);
    await chrome.storage.local.set({ estadoActual: this.stateManager.estadoActual, procesoActivo: this.stateManager.procesoActivo, ultimaExtraccion: this.stateManager.ultimaExtraccion, estadisticasRobustas: this.stateManager.estadisticasRobustas });
    console.log('✅ Proceso completado:', this.stateManager.ultimaExtraccion);
    return { success: true };
  }

  async resetearEstado() {
    this.stateManager.estadoActual = "Listo para nueva búsqueda..."; this.stateManager.procesoActivo = false;
    await chrome.storage.local.set({ estadoActual: this.stateManager.estadoActual, procesoActivo: this.stateManager.procesoActivo });
    return { success: true };
  }

  async getEstadisticas() { return { success: true, estadisticas: this.stateManager.estadisticasRobustas, ultimaExtraccion: this.stateManager.ultimaExtraccion }; }
}

// Servicio de gestión del ciclo de vida
class LifecycleManager {
  constructor(stateManager, notificationManager) { this.stateManager = stateManager; this.notificationManager = notificationManager; this.setupListeners(); }

  setupListeners() {
    chrome.runtime.onStartup.addListener(() => { console.log('🔄 Acontplus SRI Tools iniciado - v1.4.1-Final'); this.inicializarExtension(); });
    chrome.runtime.onInstalled.addListener((details) => {
      console.log('📦 Extensión instalada/actualizada:', details);
      if (details.reason === 'install') { console.log('🎉 Primera instalación'); this.notificationManager.mostrarBienvenida(); }
      else if (details.reason === 'update') { console.log('⬆️ Actualización completada'); this.notificationManager.mostrarActualizacion(details.previousVersion); }
      this.inicializarExtension();
    });
    chrome.runtime.onSuspend.addListener(() => { console.log('😴 Background script suspendido - guardando estado...'); this.onSuspend(); });
  }

  async inicializarExtension() {
    try {
      const result = await chrome.storage.local.get(['estadisticasRobustas', 'ultimaExtraccion', 'estadoActual']);
      if (result.estadisticasRobustas) this.stateManager.estadisticasRobustas = { ...this.stateManager.estadisticasRobustas, ...result.estadisticasRobustas };
      if (result.ultimaExtraccion) this.stateManager.ultimaExtraccion = result.ultimaExtraccion;
      if (result.estadoActual) this.stateManager.estadoActual = result.estadoActual;
      else this.stateManager.estadoActual = "Listo para usar tecnicas robustas...";
      console.log('✅ Extensión inicializada correctamente'); console.log('📊 Estadísticas cargadas:', this.stateManager.estadisticasRobustas);
    } catch (error) { console.error('❌ Error inicializando extensión:', error); this.stateManager.estadoActual = "Error en inicialización..."; }
  }

  async onSuspend() { await chrome.storage.local.set({ ultimoEstado: this.stateManager.estadoActual, fechaSuspension: new Date().toISOString() }); }
}

// Inicializar servicios en orden de dependencia
const stateManager = new StateManager();
const performanceMonitor = new PerformanceMonitor();
const notificationManager = new NotificationManager(stateManager);
const lifecycleManager = new LifecycleManager(stateManager, notificationManager);
const messageHandler = new MessageHandler(stateManager);

// Configurar monitoreo de tabs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('sri.gob.ec')) {
    console.log('🔗 Página del SRI detectada:', tab.url);
  }
});