// Background Service Worker - Migrado a TypeScript

import { VERSION, STORAGE_KEYS, LIMITS } from '@shared/constants';
import { StorageManager } from '@shared/storage';
import { MessageListener, updateBadge } from '@shared/messaging';
import { sanitizePath } from '@shared/utils';
import { DownloadPathsManager } from '@services/download-paths';
import type { Statistics, ExtractionInfo } from '@shared/types';

// Estado de la extensión
class StateManager {
  public estadoActual = 'Esperando conexión...';
  public procesoActivo = false;
  public ultimaExtraccion: ExtractionInfo | null = null;
  public estadisticasRobustas: Statistics = {
    totalExtracciones: 0,
    documentosProcesados: 0,
    paginasOptimizadas: 0,
    tiempoPromedio: 0,
  };

  async init(): Promise<void> {
    try {
      const state = await StorageManager.getExtensionState();
      if (state.estadisticasRobustas) {
        this.estadisticasRobustas = { ...this.estadisticasRobustas, ...state.estadisticasRobustas };
      }
      if (state.ultimaExtraccion) {
        this.ultimaExtraccion = state.ultimaExtraccion;
      }
      if (state.estadoActual) {
        this.estadoActual = state.estadoActual;
      } else {
        this.estadoActual = 'Listo para usar técnicas robustas...';
      }
    } catch (error) {
      this.estadoActual = 'Error en inicialización...';
    }
  }

  async saveState(): Promise<void> {
    await StorageManager.saveExtensionState({
      estadoActual: this.estadoActual,
      procesoActivo: this.procesoActivo,
      ultimaExtraccion: this.ultimaExtraccion,
      estadisticasRobustas: this.estadisticasRobustas,
    });
  }
}

// Monitor de performance
class PerformanceMonitor {
  constructor() {
    this.setupHeartbeat();
    this.setupErrorHandling();
  }

  monitorearPerformance(evento: string, datos: Record<string, any> = {}): void {
    const registro = {
      evento,
      timestamp: Date.now(),
      datos,
      version: VERSION,
    };

    chrome.storage.local.get([STORAGE_KEYS.METRICAS]).then((result) => {
      const metricas = result[STORAGE_KEYS.METRICAS] || [];
      metricas.push(registro);

      if (metricas.length > LIMITS.MAX_METRICS) {
        metricas.splice(0, metricas.length - LIMITS.MAX_METRICS);
      }

      chrome.storage.local.set({ [STORAGE_KEYS.METRICAS]: metricas });
    });
  }

  limpiarDatosAntiguos(): void {
    const RETENTION_MS = LIMITS.METRICS_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const ahora = Date.now();

    chrome.storage.local.get([STORAGE_KEYS.METRICAS]).then((result) => {
      if (result[STORAGE_KEYS.METRICAS]) {
        const metricasLimpias = result[STORAGE_KEYS.METRICAS].filter(
          (metrica: any) => ahora - metrica.timestamp < RETENTION_MS
        );
        chrome.storage.local.set({
          [STORAGE_KEYS.METRICAS]: metricasLimpias,
          [STORAGE_KEYS.ULTIMA_LIMPIEZA]: ahora,
        });
      }
    });
  }

  private setupHeartbeat(): void {
    setInterval(() => this.limpiarDatosAntiguos(), 24 * 60 * 60 * 1000);
  }

  private setupErrorHandling(): void {
    self.addEventListener('error', (event) => {
      this.monitorearPerformance('error', {
        mensaje: event.error?.message,
        linea: event.lineno,
        archivo: event.filename,
      });
    });
  }
}

// Gestor de notificaciones
class NotificationManager {
  constructor(_stateManager: StateManager) {}

  mostrarBienvenida(): void {
    // Solo mostrar notificación si la API está disponible
    if (typeof chrome.notifications !== 'undefined' && chrome.notifications.create) {
      const mensaje = {
        type: 'basic' as chrome.notifications.TemplateType,
        iconUrl: 'icons/icon48.png',
        title: `Acontplus SRI Tools v${VERSION}`,
        message: '¡Bienvenido! Extracción robusta y optimizada de documentos SRI.',
      };

      chrome.notifications.create('bienvenida', mensaje);
    }
    
    chrome.storage.local.set({
      [STORAGE_KEYS.PRIMERA_INSTALACION]: true,
      [STORAGE_KEYS.FECHA_INSTALACION]: new Date().toISOString(),
      [STORAGE_KEYS.VERSION]: VERSION,
    });
  }

  mostrarActualizacion(versionAnterior: string): void {
    // Solo mostrar notificación si la API está disponible
    if (typeof chrome.notifications !== 'undefined' && chrome.notifications.create) {
      const mensaje = {
        type: 'basic' as chrome.notifications.TemplateType,
        iconUrl: 'icons/icon48.png',
        title: 'Acontplus SRI Tools - Actualizado',
        message: `Actualizado de v${versionAnterior} a v${VERSION} con mejoras de interfaz.`,
      };

      chrome.notifications.create('actualizacion', mensaje);
    }
  }
}

// Inicializar servicios
const stateManager = new StateManager();
new PerformanceMonitor(); // Inicializado para side effects
const notificationManager = new NotificationManager(stateManager);
const messageListener = new MessageListener();

// Configurar handlers de mensajes
messageListener.on('obtenerEstado', async () => ({
  res: stateManager.estadoActual,
  procesoActivo: stateManager.procesoActivo,
  ultimaExtraccion: stateManager.ultimaExtraccion,
  estadisticasRobustas: stateManager.estadisticasRobustas,
  version: VERSION,
}));

messageListener.on('updateProgress', async (message) => {
  stateManager.estadoActual = message.progress;
  stateManager.procesoActivo = true;
  await stateManager.saveState();
  return { success: true };
});

messageListener.on('procesoCompletado', async (message) => {
  stateManager.estadoActual = message.mensaje || 'Proceso completado';
  stateManager.procesoActivo = false;
  stateManager.ultimaExtraccion = {
    fecha: new Date().toISOString(),
    documentos: message.documentos || 0,
    metodo: `Tecnicas-Robustas-v${VERSION}`,
    optimizacionAplicada: message.optimizacionAplicada || false,
  };
  stateManager.estadisticasRobustas.totalExtracciones++;
  stateManager.estadisticasRobustas.documentosProcesados += message.documentos || 0;
  await stateManager.saveState();
  return { success: true };
});

messageListener.on('resetearEstado', async () => {
  stateManager.estadoActual = 'Listo para nueva búsqueda...';
  stateManager.procesoActivo = false;
  await stateManager.saveState();
  return { success: true };
});

messageListener.on('obtenerEstadisticas', async () => ({
  success: true,
  estadisticas: stateManager.estadisticasRobustas,
  ultimaExtraccion: stateManager.ultimaExtraccion,
}));

messageListener.on('closePanel', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'toggleUI' });
  }
  return { success: true };
});

messageListener.on('hideCancel', async () => {
  chrome.runtime.sendMessage({ action: 'hideCancelButton' });
  return { success: true };
});

messageListener.on('sessionLost', async (message) => {
  chrome.runtime.sendMessage({ action: 'sessionLost', message: message.message });
  return { success: true };
});

messageListener.on('updateBadge', async (message) => {
  await updateBadge(message.count || 0);
  return { success: true };
});

messageListener.on('storeData', async (message) => {
  try {
    await chrome.storage.local.set(message.data);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

messageListener.on('batchDownloadProgress', async (message) => {
  // Reenviar progreso de lote al popup
  chrome.runtime.sendMessage({
    action: 'batchDownloadProgress',
    progress: message.progress,
  });
  return { success: true };
});

messageListener.on('getExistingFiles', async () => {
  try {
    const downloads = await new Promise<chrome.downloads.DownloadItem[]>((resolve) => {
      chrome.downloads.search(
        {
          state: 'complete',
          exists: true,
        },
        (results) => {
          resolve(results || []);
        }
      );
    });

    const archivos = new Set<string>();
    downloads.forEach((download) => {
      const fileName = download.filename.split(/[/\\]/).pop();
      if (fileName) {
        archivos.add(fileName);
      }
    });

    return { success: true, files: Array.from(archivos) };
  } catch (error) {
    console.error('Error obteniendo archivos existentes:', error);
    return { success: false, files: [] };
  }
});

messageListener.on('downloadFile', async (message) => {
  try {
    const pathsManager = new DownloadPathsManager();
    
    // Obtener configuración de rutas
    const shouldAsk = await pathsManager.shouldAskEveryTime();
    const customPath = await pathsManager.getDownloadPath();
    
    let finalFilename = message.payload.filename;
    
    // Si no está configurado para preguntar y hay ruta personalizada, usarla
    if (!shouldAsk && customPath) {
      finalFilename = `${customPath}/${message.payload.filename}`;
    } else if (!customPath) {
      // Fallback: usar ruta guardada en storage (legacy)
      const downloadPath = await StorageManager.getDownloadPath();
      if (downloadPath && downloadPath.trim() !== '') {
        const sanitizedPath = sanitizePath(downloadPath);
        if (sanitizedPath) {
          finalFilename = `${sanitizedPath}/${message.payload.filename}`;
        }
      }
    }

    chrome.downloads.download(
      {
        url: message.payload.url,
        filename: finalFilename,
        saveAs: shouldAsk, // Preguntar si está configurado para ask
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error(`Error en descarga:`, chrome.runtime.lastError.message);
        } else {
          console.log(`Descarga iniciada: ${downloadId}`, finalFilename);
        }
      }
    );

    return { success: true };
  } catch (error: unknown) {
    console.error('Error procesando descarga:', error);
    chrome.downloads.download({
      url: message.payload.url,
      filename: message.payload.filename,
    });
    return { success: true };
  }
});

// Lifecycle events
chrome.runtime.onStartup.addListener(() => {
  stateManager.init();
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    notificationManager.mostrarBienvenida();
  } else if (details.reason === 'update') {
    notificationManager.mostrarActualizacion(details.previousVersion || 'unknown');
  }
  stateManager.init();
});

chrome.runtime.onSuspend.addListener(() => {
  chrome.storage.local.set({
    ultimoEstado: stateManager.estadoActual,
    fechaSuspension: new Date().toISOString(),
  });
});

// Monitoreo de tabs
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('sri.gob.ec')) {
    console.log('🔗 Página del SRI detectada:', tab.url);
  }
});

// Listener para clic en icono
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'toggleUI' }, () => {
      if (chrome.runtime.lastError) {
        console.log('Content script no responde en esta pestaña');
      }
    });
  }
});

console.log(`🚀 Background script iniciado - v${VERSION}`);
