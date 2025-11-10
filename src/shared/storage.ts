// Gestión centralizada de Chrome Storage

import { STORAGE_KEYS } from './constants';
import type {
  Documento,
  ProgressStatus,
  ExtensionState,
  VerificationResult,
  Statistics,
  ExtractionInfo,
} from './types';

/**
 * Clase para gestionar Chrome Storage de forma tipada
 */
export class StorageManager {
  /**
   * Guarda documentos extraídos
   */
  static async saveDocuments(documentos: Documento[]): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.FACTURAS_DATA]: documentos,
      [STORAGE_KEYS.LAST_EXTRACTION]: new Date().toISOString(),
    });
  }

  /**
   * Obtiene documentos guardados
   */
  static async getDocuments(): Promise<Documento[]> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.FACTURAS_DATA);
    return result[STORAGE_KEYS.FACTURAS_DATA] || [];
  }

  /**
   * Guarda estado de progreso
   */
  static async saveProgress(progress: ProgressStatus): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.PROGRESS_STATUS]: progress,
    });
  }

  /**
   * Obtiene estado de progreso
   */
  static async getProgress(): Promise<ProgressStatus | null> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.PROGRESS_STATUS);
    return result[STORAGE_KEYS.PROGRESS_STATUS] || null;
  }

  /**
   * Limpia estado de progreso
   */
  static async clearProgress(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEYS.PROGRESS_STATUS);
  }

  /**
   * Guarda estado de la extensión
   */
  static async saveExtensionState(state: Partial<ExtensionState>): Promise<void> {
    await chrome.storage.local.set(state);
  }

  /**
   * Obtiene estado de la extensión
   */
  static async getExtensionState(): Promise<Partial<ExtensionState>> {
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.ESTADO_ACTUAL,
      STORAGE_KEYS.PROCESO_ACTIVO,
      STORAGE_KEYS.ULTIMA_EXTRACCION,
      STORAGE_KEYS.ESTADISTICAS_ROBUSTAS,
    ]);
    return result;
  }

  /**
   * Guarda ruta de descarga
   */
  static async saveDownloadPath(path: string): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.DOWNLOAD_PATH]: path,
    });
  }

  /**
   * Obtiene ruta de descarga
   */
  static async getDownloadPath(): Promise<string | null> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.DOWNLOAD_PATH);
    return result[STORAGE_KEYS.DOWNLOAD_PATH] || null;
  }

  /**
   * Guarda resultado de verificación
   */
  static async saveVerification(verification: VerificationResult): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.LAST_VERIFICATION]: verification,
    });
  }

  /**
   * Obtiene resultado de verificación
   */
  static async getVerification(): Promise<VerificationResult | null> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.LAST_VERIFICATION);
    return result[STORAGE_KEYS.LAST_VERIFICATION] || null;
  }

  /**
   * Guarda estadísticas
   */
  static async saveStatistics(stats: Statistics): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.ESTADISTICAS_ROBUSTAS]: stats,
    });
  }

  /**
   * Obtiene estadísticas
   */
  static async getStatistics(): Promise<Statistics | null> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.ESTADISTICAS_ROBUSTAS);
    return result[STORAGE_KEYS.ESTADISTICAS_ROBUSTAS] || null;
  }

  /**
   * Guarda información de última extracción
   */
  static async saveExtractionInfo(info: ExtractionInfo): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.ULTIMA_EXTRACCION]: info,
    });
  }

  /**
   * Obtiene información de última extracción
   */
  static async getExtractionInfo(): Promise<ExtractionInfo | null> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.ULTIMA_EXTRACCION);
    return result[STORAGE_KEYS.ULTIMA_EXTRACCION] || null;
  }

  /**
   * Limpia todos los datos
   */
  static async clearAll(): Promise<void> {
    await chrome.storage.local.clear();
  }

  /**
   * Obtiene todos los datos
   */
  static async getAll(): Promise<Record<string, any>> {
    return await chrome.storage.local.get(null);
  }
}

/**
 * Hook para escuchar cambios en storage
 */
export function onStorageChange(
  callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void
): void {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      callback(changes);
    }
  });
}
