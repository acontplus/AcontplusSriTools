var estadoActual = "...";
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'obtenerEstado') {
    sendResponse({res: estadoActual});
    return true; // Mantener el canal abierto para enviar la respuesta asincrónica
  } else if (message.action === 'updateProgress') {
    estadoActual = message.progress;
  }
});
