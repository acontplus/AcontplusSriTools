// Content Script principal - Migrado a TypeScript

import { IFRAME_ID, DELAYS } from '@shared/constants';
import { StorageManager } from '@shared/storage';
import { SRIDocumentosExtractor } from './extractor';

// Exportar la clase globalmente
(window as any).SRIDocumentosExtractor = SRIDocumentosExtractor;

// Marcar que el content script está cargado
(window as any).SRIExtractorLoaded = true;

// Inicializar extensión
async function initializeExtension(): Promise<void> {
  try {
    // Limpiar cache al iniciar para evitar datos persistentes entre sesiones
    await StorageManager.clearDocuments();
    await StorageManager.clearProgress();
    console.log('🧹 Cache limpiado al iniciar');

    (window as any).sriExtractorInstance = new SRIDocumentosExtractor();
    
    // Inicializar Supabase si está disponible
    if (typeof (window as any).initSupabase !== 'undefined') {
      await (window as any).initSupabase();
    } else {
      console.warn('⚠️ initSupabase no está disponible');
    }
    
    // Inicializar DownloadCounter si está disponible
    if (typeof (window as any).DownloadCounter !== 'undefined' && !(window as any).downloadCounter) {
      (window as any).downloadCounter = new (window as any).DownloadCounter();
    }
  } catch (error) {
    console.error('❌ Error inicializando extensión:', error);
  }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Esperar un poco más para asegurar que todos los scripts se carguen
    setTimeout(initializeExtension, DELAYS.INIT_DELAY);
  });
} else {
  setTimeout(initializeExtension, DELAYS.INIT_DELAY);
}

// --- Lógica para la interfaz inyectada ---

let iframe: HTMLIFrameElement | null = null;
let isUIVisible = false;

function createUI(): HTMLIFrameElement {
  const existing = document.getElementById(IFRAME_ID) as HTMLIFrameElement;
  if (existing) {
    return existing;
  }

  const iframeElement = document.createElement('iframe');
  iframeElement.id = IFRAME_ID;
  iframeElement.src = chrome.runtime.getURL('popup/popup.html');

  // Estilos del panel lateral
  Object.assign(iframeElement.style, {
    backgroundColor: 'white',
    position: 'fixed',
    top: '16px',
    right: '16px',
    width: '1000px',
    height: 'calc(100% - 32px)',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    zIndex: '999999', // Reducido para que el modal (2147483647) aparezca encima
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    transition: 'transform 0.3s ease-out',
    transform: 'translateX(105%)',
  });

  document.body.appendChild(iframeElement);
  return iframeElement;
}

function toggleUI(): void {
  if (!iframe) {
    iframe = createUI();
  }

  if (isUIVisible) {
    iframe.style.transform = 'translateX(105%)';
  } else {
    iframe.style.transform = 'translateX(0)';
  }

  isUIVisible = !isUIVisible;
}

// Listener para mensajes del background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'toggleUI') {
    toggleUI();
    sendResponse({ success: true });
  }
  return true;
});
