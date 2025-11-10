// Sistema de mensajería tipado entre scripts

import type { ChromeMessage, PingResponse } from './types';

/**
 * Envía un mensaje y espera respuesta con reintentos
 */
export async function sendMessageWithRetry<T = any>(
  tabId: number,
  message: ChromeMessage,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      return response as T;
    } catch (error) {
      console.warn(`Intento ${attempt} fallido:`, error);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error('Max retries reached');
}

/**
 * Envía un mensaje al background script
 */
export async function sendToBackground<T = any>(message: ChromeMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response as T);
      }
    });
  });
}

/**
 * Envía un mensaje al content script de la pestaña activa
 */
export async function sendToActiveTab<T = any>(message: ChromeMessage): Promise<T> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab || !tab.id) {
    throw new Error('No se pudo encontrar la pestaña activa');
  }
  
  return sendMessageWithRetry<T>(tab.id, message);
}

/**
 * Ping al content script para verificar si está cargado
 */
export async function pingContentScript(tabId: number): Promise<PingResponse> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    return response as PingResponse;
  } catch {
    return {
      success: false,
      message: 'Content script no disponible',
      version: '',
      url: '',
      ready: false,
    };
  }
}

/**
 * Actualiza el badge de la extensión
 */
export async function updateBadge(count: number): Promise<void> {
  if (count > 0) {
    await chrome.action.setBadgeText({ text: count.toString() });
    await chrome.action.setBadgeBackgroundColor({ color: '#D61672' });
    await chrome.action.setTitle({ 
      title: `ACONTPLUS SRI Tools - ${count} documentos sincronizados` 
    });
  } else {
    await chrome.action.setBadgeText({ text: '' });
    await chrome.action.setTitle({ title: 'ACONTPLUS SRI Tools' });
  }
}

/**
 * Clase para manejar listeners de mensajes
 */
export class MessageListener {
  private handlers: Map<string, (message: ChromeMessage, sender: chrome.runtime.MessageSender) => Promise<any>>;

  constructor() {
    this.handlers = new Map();
    this.setupListener();
  }

  /**
   * Registra un handler para una acción específica
   */
  on(action: string, handler: (message: ChromeMessage, sender: chrome.runtime.MessageSender) => Promise<any>): void {
    this.handlers.set(action, handler);
  }

  /**
   * Remueve un handler
   */
  off(action: string): void {
    this.handlers.delete(action);
  }

  /**
   * Configura el listener principal
   */
  private setupListener(): void {
    chrome.runtime.onMessage.addListener((message: ChromeMessage, sender, sendResponse) => {
      const handler = this.handlers.get(message.action);
      
      if (handler) {
        handler(message, sender)
          .then(response => sendResponse(response))
          .catch(error => sendResponse({ success: false, error: error.message }));
        
        return true; // Mantener el canal abierto para respuestas asíncronas
      }
      
      sendResponse({ success: false, error: 'Acción no reconocida' });
      return true;
    });
  }
}
