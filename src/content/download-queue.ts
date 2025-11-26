// Download Queue Manager - Sistema de descarga por lotes con control de concurrencia

import { DOWNLOAD_CONFIG, LIMITS, STORAGE_KEYS } from '@shared/constants';
import { StorageManager } from '@shared/storage';
import type {
  Documento,
  FormatoDescarga,
  DownloadJob,
  DownloadSession,
  BatchConfig,
  BatchProgress,
  DownloadStatus,
} from '@shared/types';

export class DownloadQueue {
  private queue: DownloadJob[] = [];
  private processing: Set<string> = new Set();
  private completed: Set<string> = new Set();
  private failed: DownloadJob[] = [];
  private config: BatchConfig;
  private sessionId: string;
  private isPaused: boolean = false;
  private startTime: number = 0;
  private completedCount: number = 0;

  constructor(config?: Partial<BatchConfig>) {
    this.config = {
      batchSize: config?.batchSize || DOWNLOAD_CONFIG.DEFAULT_BATCH_SIZE,
      concurrency: config?.concurrency || DOWNLOAD_CONFIG.DEFAULT_CONCURRENCY,
      delayBetweenBatches: config?.delayBetweenBatches || DOWNLOAD_CONFIG.DELAY_BETWEEN_BATCHES,
      maxRetries: config?.maxRetries || LIMITS.MAX_RETRIES,
      retryDelay: config?.retryDelay || DOWNLOAD_CONFIG.RETRY_BACKOFF_BASE,
      enableNotifications: config?.enableNotifications ?? true,
    };
    this.sessionId = this.generateSessionId();
  }

  /**
   * Genera un ID único para la sesión de descarga
   */
  private generateSessionId(): string {
    return `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Inicializa la cola con documentos
   */
  public initializeQueue(documentos: Documento[], formato: FormatoDescarga): void {
    this.queue = documentos.map((doc) => ({
      id: doc.id,
      documento: doc,
      formato,
      status: 'pending' as DownloadStatus,
      retryCount: 0,
    }));
    this.startTime = Date.now();
    this.completedCount = 0;
    console.log(`📋 Cola inicializada: ${this.queue.length} documentos`);
  }

  /**
   * Obtiene el progreso actual de la descarga
   */
  public getProgress(): BatchProgress {
    const totalBatches = Math.ceil(
      (this.queue.length + this.completed.size) / this.config.batchSize
    );
    const currentBatch = Math.ceil(this.completed.size / this.config.batchSize) + 1;
    const pendingDocs = this.queue.filter((job) => job.status === 'pending').length;

    // Calcular velocidad (docs/min)
    const elapsedMinutes = (Date.now() - this.startTime) / 60000;
    const currentSpeed = elapsedMinutes > 0 ? this.completedCount / elapsedMinutes : 0;

    // Estimar tiempo restante
    const remainingDocs = pendingDocs + this.processing.size;
    const estimatedTimeRemaining =
      currentSpeed > 0 ? (remainingDocs / currentSpeed) * 60 : 0;

    return {
      currentBatch,
      totalBatches,
      completedDocs: this.completed.size,
      failedDocs: this.failed.length,
      pendingDocs,
      currentSpeed: Math.round(currentSpeed * 10) / 10,
      estimatedTimeRemaining: Math.round(estimatedTimeRemaining),
    };
  }

  /**
   * Procesa la cola completa por lotes
   */
  public async processQueue(
    downloadFunction: (job: DownloadJob) => Promise<boolean>
  ): Promise<void> {
    console.log(`🚀 Iniciando procesamiento por lotes...`);

    while (this.queue.length > 0 && !this.isPaused) {
      const batch = this.getNextBatch();
      if (batch.length === 0) break;

      console.log(
        `📦 Procesando lote de ${batch.length} documentos (${this.completed.size}/${this.queue.length + this.completed.size} totales)`
      );

      await this.processBatch(batch, downloadFunction);

      // Guardar progreso cada cierto intervalo
      if (this.completed.size % DOWNLOAD_CONFIG.PROGRESS_SAVE_INTERVAL === 0) {
        await this.saveProgress();
      }

      // Delay entre lotes
      if (this.queue.length > 0 && !this.isPaused) {
        await this.sleep(this.config.delayBetweenBatches);
      }
    }

    // Guardar progreso final
    await this.saveProgress();
    console.log(`✅ Procesamiento completado: ${this.completed.size} exitosos, ${this.failed.length} fallidos`);
  }

  /**
   * Obtiene el siguiente lote de documentos para procesar
   */
  private getNextBatch(): DownloadJob[] {
    const pendingJobs = this.queue.filter((job) => job.status === 'pending');
    return pendingJobs.slice(0, this.config.batchSize);
  }

  /**
   * Procesa un lote con control de concurrencia
   */
  private async processBatch(
    batch: DownloadJob[],
    downloadFunction: (job: DownloadJob) => Promise<boolean>
  ): Promise<void> {
    const promises: Promise<void>[] = [];
    let activeDownloads = 0;

    for (const job of batch) {
      // Esperar si alcanzamos el límite de concurrencia
      while (activeDownloads >= this.config.concurrency) {
        await this.sleep(100);
      }

      activeDownloads++;
      this.processing.add(job.id);

      const promise = this.processJob(job, downloadFunction).finally(() => {
        activeDownloads--;
        this.processing.delete(job.id);
      });

      promises.push(promise);
    }

    await Promise.all(promises);
  }

  /**
   * Procesa un trabajo individual con reintentos
   */
  private async processJob(
    job: DownloadJob,
    downloadFunction: (job: DownloadJob) => Promise<boolean>
  ): Promise<void> {
    job.status = 'processing';
    job.startTime = Date.now();

    try {
      const success = await downloadFunction(job);

      if (success) {
        job.status = 'completed';
        job.endTime = Date.now();
        this.completed.add(job.id);
        this.completedCount++;
        this.removeFromQueue(job.id);
        
        // Notificar progreso
        chrome.runtime.sendMessage({
          action: 'batchDownloadProgress',
          progress: this.getProgress(),
        });
      } else {
        await this.handleFailedJob(job, downloadFunction);
      }
    } catch (error: any) {
      job.error = error.message;
      await this.handleFailedJob(job, downloadFunction);
    }
  }

  /**
   * Maneja un trabajo fallido con reintentos
   */
  private async handleFailedJob(
    job: DownloadJob,
    downloadFunction: (job: DownloadJob) => Promise<boolean>
  ): Promise<void> {
    if (job.retryCount < this.config.maxRetries) {
      job.retryCount++;
      job.status = 'retrying';

      // Backoff exponencial: 1s, 2s, 4s
      const delay = this.config.retryDelay * Math.pow(2, job.retryCount - 1);
      console.log(`🔄 Reintentando ${job.documento.numero} (intento ${job.retryCount}/${this.config.maxRetries}) en ${delay}ms`);

      await this.sleep(delay);

      // Reintentar
      job.status = 'pending';
      await this.processJob(job, downloadFunction);
    } else {
      job.status = 'failed';
      job.endTime = Date.now();
      this.failed.push(job);
      this.removeFromQueue(job.id);
      console.error(`❌ Documento ${job.documento.numero} falló después de ${this.config.maxRetries} intentos`);
    }
  }

  /**
   * Elimina un trabajo de la cola
   */
  private removeFromQueue(jobId: string): void {
    this.queue = this.queue.filter((job) => job.id !== jobId);
  }

  /**
   * Pausa el procesamiento de la cola
   */
  public pauseQueue(): void {
    this.isPaused = true;
    console.log('⏸️ Cola de descargas pausada');
  }

  /**
   * Reanuda el procesamiento de la cola
   */
  public resumeQueue(): void {
    this.isPaused = false;
    console.log('▶️ Cola de descargas reanudada');
  }

  /**
   * Guarda el progreso actual en Chrome Storage
   */
  public async saveProgress(): Promise<void> {
    const session: DownloadSession = {
      sessionId: this.sessionId,
      totalDocuments: this.queue.length + this.completed.size + this.failed.length,
      completed: Array.from(this.completed),
      failed: this.failed,
      pending: this.queue.filter((job) => job.status === 'pending').map((job) => job.id),
      timestamp: Date.now(),
      isPaused: this.isPaused,
      startTime: this.startTime,
      lastUpdateTime: Date.now(),
    };

    await StorageManager.set(STORAGE_KEYS.DOWNLOAD_SESSION, session);
  }

  /**
   * Carga una sesión anterior
   */
  public async loadProgress(): Promise<DownloadSession | null> {
    const session = await StorageManager.get<DownloadSession>(STORAGE_KEYS.DOWNLOAD_SESSION);
    if (session) {
      this.sessionId = session.sessionId;
      this.completed = new Set(session.completed);
      this.failed = session.failed;
      this.isPaused = session.isPaused;
      this.startTime = session.startTime;
      console.log(`📂 Sesión cargada: ${session.completed.length} completados, ${session.pending.length} pendientes`);
    }
    return session;
  }

  /**
   * Limpia la sesión de descarga
   */
  public async clearSession(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEYS.DOWNLOAD_SESSION);
    this.queue = [];
    this.completed.clear();
    this.failed = [];
    this.processing.clear();
    console.log('🧹 Sesión de descarga limpiada');
  }

  /**
   * Obtiene documentos fallidos para exportar
   */
  public getFailedDocuments(): DownloadJob[] {
    return this.failed;
  }

  /**
   * Utilidad para esperar
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
