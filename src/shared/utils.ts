// Utilidades compartidas - Migrado de utils.js

/**
 * Extrae texto limpio de una celda HTML
 */
export function extraerTextoCelda(celda: Element | null): string {
  if (!celda) return '';
  return (celda.textContent || '').trim();
}

/**
 * Extrae número de una celda, manejando formatos con comas y puntos
 */
export function extraerNumeroCelda(celda: Element | null): number {
  if (!celda) return 0;
  const texto = extraerTextoCelda(celda);
  const numeroLimpio = texto.replace(/,/g, '');
  const numero = parseFloat(numeroLimpio);
  return isNaN(numero) ? 0 : parseFloat(numero.toFixed(2));
}

/**
 * Separa RUC y Razón Social de un texto combinado
 * Formato esperado: "1234567890001 - EMPRESA S.A."
 */
export function separarRucRazonSocial(texto: string): [string, string] {
  if (!texto) return ['', ''];
  
  const partes = texto.split('-').map(p => p.trim());
  if (partes.length >= 2) {
    return [partes[0], partes.slice(1).join('-').trim()];
  }
  
  // Si no hay guión, intentar separar por espacio después del RUC (13 dígitos)
  const match = texto.match(/^(\d{13})\s+(.+)$/);
  if (match) {
    return [match[1], match[2].trim()];
  }
  
  return [texto, ''];
}

/**
 * Separa tipo de comprobante y serie/número
 * Formato esperado: "FACTURA 001-001-000123456"
 */
export function separarTipoSerie(texto: string): [string, string, string] {
  if (!texto) return ['', '', ''];
  
  const partes = texto.split(/\s+/);
  if (partes.length >= 2) {
    const tipo = partes[0];
    const serie = partes.slice(1).join(' ');
    
    // Extraer establecimiento-punto-secuencial
    const match = serie.match(/(\d{3})-(\d{3})-(\d+)/);
    if (match) {
      return [tipo, serie, match[3]];
    }
    
    return [tipo, serie, ''];
  }
  
  return [texto, '', ''];
}

/**
 * Formatea fecha de DD/MM/YYYY a YYYY-MM-DD
 */
export function formatearFecha(fecha: string): string {
  if (!fecha) return '';
  
  const match = fecha.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    const [, dia, mes, anio] = match;
    return `${anio}-${mes}-${dia}`;
  }
  
  return fecha;
}

/**
 * Formatea fecha y hora de DD/MM/YYYY HH:MM:SS a formato ISO
 */
export function formatearFechaHora(fechaHora: string): string {
  if (!fechaHora) return '';
  
  const match = fechaHora.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, dia, mes, anio, hora, minuto, segundo] = match;
    return `${anio}-${mes}-${dia}T${hora}:${minuto}:${segundo}`;
  }
  
  return fechaHora;
}

/**
 * Genera un ID único basado en timestamp y random
 */
export function generarIdUnico(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Espera un tiempo determinado (promesa)
 */
export function esperar(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Obtiene fecha formateada para Ecuador
 */
export function obtenerFechaFormateada(): string {
  return new Date().toLocaleString('es-EC', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Valida si una URL pertenece al dominio SRI
 */
export function isDomainValid(url: string): boolean {
  return url.includes('srienlinea.sri.gob.ec') || url.includes('sri.gob.ec');
}

/**
 * Sanitiza una ruta de archivo para evitar path traversal
 */
export function sanitizePath(path: string): string {
  return path
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .filter(part => part !== '..' && part !== '.')
    .join('/')
    .replace(/^\/+/, '')
    .replace(/[^a-zA-Z0-9_\-/]/g, '');
}

/**
 * Formatea un número como moneda
 */
export function formatearMoneda(valor: number): string {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor);
}

/**
 * Calcula hash simple de un string (para comparaciones)
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

/**
 * Verifica si el contexto de la extensión es válido
 */
export function isExtensionContextValid(): boolean {
  try {
    return chrome.runtime?.id !== undefined;
  } catch {
    return false;
  }
}

/**
 * Safe HTML set (previene XSS)
 */
export function safeSetHTML(element: HTMLElement | null, html: string): void {
  if (!element) return;
  element.innerHTML = html;
}

/**
 * Safe text set
 */
export function safeSetText(element: HTMLElement | null, text: string): void {
  if (!element) return;
  element.textContent = text;
}

/**
 * Safe element getter
 */
export function safeGetElement<T extends HTMLElement = HTMLElement>(id: string): T | null {
  if (typeof document === 'undefined') return null;
  return document.getElementById(id) as T | null;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Exportar como objeto para compatibilidad con código legacy
export const SRIUtils = {
  extraerTextoCelda,
  extraerNumeroCelda,
  separarRucRazonSocial,
  separarTipoSerie,
  formatearFecha,
  formatearFechaHora,
  generarIdUnico,
  esperar,
  obtenerFechaFormateada,
  isDomainValid,
  sanitizePath,
  formatearMoneda,
  simpleHash,
  isExtensionContextValid,
  safeSetHTML,
  safeSetText,
  safeGetElement,
  debounce,
  throttle,
};

// Hacer disponible globalmente para compatibilidad
if (typeof window !== 'undefined') {
  (window as any).SRIUtils = SRIUtils;
}
