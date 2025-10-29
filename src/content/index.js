// Content Script principal para Acontplus SRI Tools v1.4.1 - Final
// Punto de entrada modular

// MARCAR QUE EL CONTENT SCRIPT ESTÁ CARGADO
window.SRIExtractorLoaded = true;

// Los módulos se cargan automáticamente por el manifest.json
// Inicializar el extractor y hacerlo globalmente accesible
function initializeExtension() {
  if (typeof SRIDocumentosExtractor === "undefined") {
    console.error(
      "❌ SRIDocumentosExtractor no está definido. Verificar orden de carga de scripts."
    );
    return;
  }

  try {
    window.sriExtractorInstance = new SRIDocumentosExtractor();

    // Esperar un poco más para que las APIs de Chrome estén completamente disponibles
    setTimeout(() => {
      if (typeof SRIAutoSync !== "undefined") {
        window.sriAutoSyncInstance = new SRIAutoSync(
          window.sriExtractorInstance
        );
      } else {
        console.warn("⚠️ SRIAutoSync no está disponible");
      }
    }, 1000); // Delay de 1 segundo para asegurar que Chrome APIs estén listas
  } catch (error) {
    console.error("❌ Error inicializando extensión:", error);
  }
}

// Inicializar cuando el DOM esté listo y las APIs disponibles
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeExtension);
} else {
  // Si el DOM ya está listo, inicializar con un pequeño delay
  setTimeout(initializeExtension, 500);
}

// --- Lógica para la interfaz inyectada ---

const IFRAME_ID = "acontplus-sri-tools-iframe";
let iframe = null;
let isUIVisible = false; // Variable para rastrear el estado de visibilidad

function createUI() {
  if (document.getElementById(IFRAME_ID)) {
    return document.getElementById(IFRAME_ID);
  }

  const iframeElement = document.createElement("iframe");
  iframeElement.id = IFRAME_ID;
  iframeElement.src = chrome.runtime.getURL("popup/popup.html");

  // Estilos mejorados para el panel lateral
  iframeElement.style.backgroundColor = "white";
  iframeElement.style.position = "fixed";
  iframeElement.style.top = "16px";
  iframeElement.style.right = "16px";
  iframeElement.style.width = "1000px"; // Ancho que ajustaste
  iframeElement.style.height = "calc(100% - 32px)"; // Altura con márgenes
  iframeElement.style.border = "1px solid #e0e0e0";
  iframeElement.style.borderRadius = "8px";
  iframeElement.style.zIndex = "99999999";
  iframeElement.style.boxShadow = "0 4px 20px rgba(0,0,0,0.15)";
  iframeElement.style.transition = "transform 0.3s ease-out";
  iframeElement.style.transform = "translateX(105%)"; // Oculto fuera de la pantalla

  document.body.appendChild(iframeElement);
  return iframeElement;
}

function toggleUI() {
  if (!iframe) {
    iframe = createUI();
  }

  // Alternar visibilidad usando la variable de estado, que es más robusto
  if (isUIVisible) {
    iframe.style.transform = "translateX(105%)";
  } else {
    iframe.style.transform = "translateX(0)";
  }

  // Invertir el estado para el próximo clic
  isUIVisible = !isUIVisible;
}

// Listener para mensajes del background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "toggleUI") {
    toggleUI();
    sendResponse({ success: true });
  }
  return true; // Mantener el canal de mensajes abierto para respuestas asíncronas
});
