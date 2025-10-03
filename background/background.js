// Background Script para Acontplus SRI Tools v1.4.1-Final
// Manejo de estado global y comunicación entre componentes

console.log('🚀 Background Script cargado - Acontplus SRI Tools v1.4.1-Final');

// Estado global de la aplicación
let estadoActual = "Esperando conexión...";
let procesoActivo = false;
let ultimaExtraccion = null;
let estadisticasRobustas = {
  totalExtracciones: 0,
  documentosProcesados: 0,
  paginasOptimizadas: 0,
  tiempoPromedio: 0
};

// Listener principal de mensajes
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Background recibió mensaje:', message);

  switch (message.action) {
    case 'obtenerEstado':
      sendResponse({ 
        res: estadoActual,
        procesoActivo: procesoActivo,
        ultimaExtraccion: ultimaExtraccion,
        estadisticasRobustas: estadisticasRobustas,
        version: '1.4.1-Final'
      });
      return true;

    case 'updateProgress':
      estadoActual = message.progress;
      procesoActivo = true;
      
      // Log específico para progreso
      if (message.progress.includes('optimizacion') || message.progress.includes('repaginando')) {
        console.log('📊 Progreso con optimización:', message.progress);
        estadisticasRobustas.paginasOptimizadas++;
      }
      
      // Guardar progreso en storage
      chrome.storage.local.set({
        estadoActual: estadoActual,
        procesoActivo: procesoActivo,
        timestamp: Date.now()
      });
      
      sendResponse({ success: true });
      return true;

    case 'procesoCompletado':
      estadoActual = message.mensaje || "Proceso completado";
      procesoActivo = false;
      ultimaExtraccion = {
        fecha: new Date().toISOString(),
        documentos: message.documentos || 0,
        metodo: 'Tecnicas-Robustas-v1.4.1',
        optimizacionAplicada: message.optimizacionAplicada || false
      };
      
      // Actualizar estadísticas
      estadisticasRobustas.totalExtracciones++;
      estadisticasRobustas.documentosProcesados += (message.documentos || 0);
      
      // Guardar estadísticas persistentes
      chrome.storage.local.set({
        estadoActual: estadoActual,
        procesoActivo: procesoActivo,
        ultimaExtraccion: ultimaExtraccion,
        estadisticasRobustas: estadisticasRobustas
      });
      
      console.log('✅ Proceso completado:', ultimaExtraccion);
      sendResponse({ success: true });
      return true;

    case 'resetearEstado':
      estadoActual = "Listo para nueva búsqueda...";
      procesoActivo = false;
      
      chrome.storage.local.set({
        estadoActual: estadoActual,
        procesoActivo: procesoActivo
      });
      
      sendResponse({ success: true });
      return true;

    case 'obtenerEstadisticas':
      sendResponse({
        success: true,
        estadisticas: estadisticasRobustas,
        ultimaExtraccion: ultimaExtraccion
      });
      return true;

    default:
      console.warn('⚠️ Acción no reconocida en background:', message.action);
      sendResponse({ success: false, error: 'Acción no reconocida' });
      return true;
  }
});

// Inicialización del background script
chrome.runtime.onStartup.addListener(() => {
  console.log('🔄 Acontplus SRI Tools iniciado - v1.4.1-Final');
  inicializarExtension();
});

chrome.runtime.onInstalled.addListener((details) => {
  console.log('📦 Extensión instalada/actualizada:', details);
  
  if (details.reason === 'install') {
    console.log('🎉 Primera instalación de Acontplus SRI Tools v1.4.1-Final');
    mostrarBienvenida();
  } else if (details.reason === 'update') {
    console.log('⬆️ Actualización a v1.4.1-Final completada');
    mostrarActualizacion(details.previousVersion);
  }
  
  inicializarExtension();
});

// Función de inicialización
async function inicializarExtension() {
  try {
    // Cargar estadísticas previas
    const result = await chrome.storage.local.get([
      'estadisticasRobustas',
      'ultimaExtraccion',
      'estadoActual'
    ]);
    
    if (result.estadisticasRobustas) {
      estadisticasRobustas = { ...estadisticasRobustas, ...result.estadisticasRobustas };
    }
    
    if (result.ultimaExtraccion) {
      ultimaExtraccion = result.ultimaExtraccion;
    }
    
    if (result.estadoActual) {
      estadoActual = result.estadoActual;
    } else {
      estadoActual = "Listo para usar tecnicas robustas...";
    }
    
    console.log('✅ Extensión inicializada correctamente');
    console.log('📊 Estadísticas cargadas:', estadisticasRobustas);
    
  } catch (error) {
    console.error('❌ Error inicializando extensión:', error);
    estadoActual = "Error en inicialización...";
  }
}

// Función de bienvenida para nuevas instalaciones
function mostrarBienvenida() {
  const mensajeBienvenida = {
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'Acontplus SRI Tools v1.4.1',
    message: '¡Bienvenido! Extracción robusta y optimizada de documentos SRI.'
  };
  
  // Verificar si las notificaciones están disponibles
  if (chrome.notifications) {
    chrome.notifications.create('bienvenida', mensajeBienvenida);
  }
  
  // Configurar valores por defecto
  chrome.storage.local.set({
    primeraInstalacion: true,
    fechaInstalacion: new Date().toISOString(),
    version: '1.4.1-Final'
  });
}

// Función para mostrar información de actualización
function mostrarActualizacion(versionAnterior) {
  const mensajeActualizacion = {
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'Acontplus SRI Tools - Actualizado',
    message: `Actualizado de v${versionAnterior} a v1.4.1 con mejoras de interfaz.`
  };
  
  if (chrome.notifications) {
    chrome.notifications.create('actualizacion', mensajeActualizacion);
  }
  
  // Marcar migración de datos si es necesario
  if (versionAnterior && (versionAnterior.startsWith('1.3') || versionAnterior.startsWith('1.4.0'))) {
    migrarDatosVersionAnterior(versionAnterior);
  }
}

// Función de migración de datos de versiones anteriores
async function migrarDatosVersionAnterior(versionAnterior) {
  try {
    console.log('🔄 Migrando datos de v' + versionAnterior + ' a v1.4.1...');
    
    const datosAnteriores = await chrome.storage.local.get([
      'facturasData',
      'lastExtraction',
      'progressStatus'
    ]);
    
    // Mantener datos existentes pero agregar metadatos v1.4.1
    if (datosAnteriores.facturasData) {
      await chrome.storage.local.set({
        facturasDataBackup: datosAnteriores.facturasData, // Backup
        migracionCompletada: true,
        fechaMigracion: new Date().toISOString(),
        versionAnterior: versionAnterior
      });
    }
    
    console.log('✅ Migración completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error en migración:', error);
  }
}

// Monitoreo de performance
function monitorearPerformance(evento, datos = {}) {
  const registro = {
    evento: evento,
    timestamp: Date.now(),
    datos: datos,
    version: '1.4.1-Final'
  };
  
  console.log('📈 Performance:', registro);
  
  // Guardar métricas de performance
  chrome.storage.local.get(['metricas']).then(result => {
    const metricas = result.metricas || [];
    metricas.push(registro);
    
    // Mantener solo las últimas 100 métricas
    if (metricas.length > 100) {
      metricas.splice(0, metricas.length - 100);
    }
    
    chrome.storage.local.set({ metricas: metricas });
  });
}

// Limpieza de datos antiguos (ejecutar semanalmente)
function limpiarDatosAntiguos() {
  const SEMANA_EN_MS = 7 * 24 * 60 * 60 * 1000;
  const ahora = Date.now();
  
  chrome.storage.local.get(['metricas']).then(result => {
    if (result.metricas) {
      const metricasLimpias = result.metricas.filter(
        metrica => (ahora - metrica.timestamp) < SEMANA_EN_MS
      );
      
      chrome.storage.local.set({ 
        metricas: metricasLimpias,
        ultimaLimpieza: ahora
      });
      
      console.log('🧹 Limpieza de datos completada');
    }
  });
}

// Ejecutar limpieza cada 24 horas
setInterval(limpiarDatosAntiguos, 24 * 60 * 60 * 1000);

// Heartbeat para mantener el service worker activo
setInterval(() => {
  console.log('💓 Background script activo - v1.4.1-Final');
}, 5 * 60 * 1000); // Cada 5 minutos

// Manejo de errores globales
self.addEventListener('error', (event) => {
  console.error('❌ Error global en background:', event.error);
  
  // Registrar error para análisis
  monitorearPerformance('error', {
    mensaje: event.error.message,
    linea: event.lineno,
    archivo: event.filename
  });
});

// Funciones de utilidad
function obtenerFechaFormateada() {
  return new Date().toLocaleString('es-EC', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function generarIdUnico() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Manejo de comunicación con tabs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('sri.gob.ec')) {
    console.log('🔗 Página del SRI detectada:', tab.url);
    
    // Opcional: inyectar content script si no está cargado
    // (El manifest ya maneja esto automáticamente)
  }
});

// Eventos de extensión
chrome.runtime.onSuspend.addListener(() => {
  console.log('😴 Background script suspendido - guardando estado...');
  
  // Guardar estado final antes de suspender
  chrome.storage.local.set({
    ultimoEstado: estadoActual,
    fechaSuspension: new Date().toISOString()
  });
});

// Inicialización inmediata
inicializarExtension();