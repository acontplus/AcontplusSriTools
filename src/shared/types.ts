// Tipos compartidos para toda la extensión

export interface Documento {
  id: string;
  rowIndex: number;
  pageNumber: number; // Página donde se encontró el documento (1-based)
  numero: string;
  ruc: string;
  razonSocial: string;
  tipoComprobante: string;
  serie: string;
  numeroComprobante: string;
  claveAcceso: string;
  fechaEmision: string;
  fechaAutorizacion: string;
  valorSinImpuestos: number;
  iva: number;
  importeTotal: number;
}

export interface PaginationInfo {
  current: number;
  total: number;
}

export interface HeaderMap {
  rucEmisorRaw?: number;
  numero?: number;
  claveAcceso?: number;
  fechaEmision?: number;
  fechaAutorizacion?: number;
  valorSinImpuestos?: number;
  iva?: number;
  importeTotal?: number;
}

export interface ProgressStatus {
  mensaje?: string;
  documentosEncontrados?: number;
  currentPage?: number;
  totalPages?: number;
  porcentaje?: number;
  completed?: boolean;
  allDocuments?: Documento[];
  paginationInfo?: PaginationInfo;
  resumen?: SearchSummary;
}

export interface SearchSummary {
  documentosEncontrados: number;
  paginasProcesadas: number;
  tipoComprobante: string;
  optimizacionAplicada: boolean;
}

export interface SearchConfig {
  optimizarPaginacion?: boolean;
  extraerTodos?: boolean;
  mostrarProgreso?: boolean;
}

export interface SearchResult {
  success: boolean;
  message?: string;
  error?: string;
  allDocuments?: Documento[];
  paginationInfo?: PaginationInfo;
  totalPages?: number;
  optimization?: {
    optimized: boolean;
    message?: string;
  };
}

export interface ExtractResult {
  success: boolean;
  documentos?: Documento[];
  tipoComprobante?: string;
  paginationInfo?: PaginationInfo;
  error?: string;
}

export interface SessionStatus {
  success: boolean;
  sessionActive: boolean;
  message: string;
  details?: string;
  error?: string;
}

export interface DownloadResult {
  exitosos: number;
  fallidos: number;
  total: number;
}

export type FileStatus = 'exists' | 'deleted' | 'never_downloaded' | 'downloading';

export interface FileDetail {
  downloadId?: number;
  path?: string;
  status: FileStatus;  // Estado preciso del archivo
  exists: boolean;     // ¿Existe físicamente?
  wasDownloaded: boolean;  // ¿Alguna vez fue descargado?
  fileSize?: number;   // Tamaño del archivo (si existe)
  lastModified?: number; // Última modificación (timestamp)
}

export interface FileInfo {
  xml?: FileDetail;
  pdf?: FileDetail;
}

export interface VerificationResult {
  foundIds: string[];
  foundPdfIds?: string[];
  total: number;
  timestamp: number;
}

export interface ExportMetadata {
  exported_at: string;
  total_records: number;
  exported_by: string;
  extraction_source: string;
}

export interface ExportData {
  metadata: ExportMetadata;
  documentos: Documento[];
}

export type TipoEmision = 'CompRecibidos' | 'CompEmitidos';
export type TipoComprobante = 'R' | 'E';
export type FormatoDescarga = 'xml' | 'pdf' | 'both';
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

// Mensajes entre scripts
export interface ChromeMessage {
  action: string;
  [key: string]: any;
}

export interface CallbackResponse {
  success: boolean;
  message: string;
}

// === Download Paths System ===

export interface DownloadPath {
  id: string;
  name: string;        // Display name
  path: string;        // Relative path: "SRI/2025/Enero"
  isDefault: boolean;  // If it's the default path
  lastUsed: number;    // Timestamp
  createdAt: number;   // Timestamp
}

export interface DownloadPathsConfig {
  paths: DownloadPath[];
  activePathId: string | 'default' | 'ask';
  askEveryTime: boolean;
}
export interface PingResponse {
  success: boolean;
  message: string;
  version: string;
  url: string;
  ready: boolean;
}

// Estado de la extensión
export interface ExtensionState {
  estadoActual: string;
  procesoActivo: boolean;
  ultimaExtraccion: ExtractionInfo | null;
  estadisticasRobustas: Statistics;
}

export interface ExtractionInfo {
  fecha: string;
  documentos: number;
  metodo: string;
  optimizacionAplicada: boolean;
}

export interface Statistics {
  totalExtracciones: number;
  documentosProcesados: number;
  paginasOptimizadas: number;
  tiempoPromedio: number;
}

// Supabase types
export interface AppUser {
  id: string;
  auth_uid?: string;
  email: string;
  full_name: string;
  telefono?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface FeedbackResponse {
  id: string;
  user_id?: string;
  comentarios: string;
  extension_instance_id: string;
  extension_version: string;
  detected_types: string[];
  scan_timestamp?: string;
  metadata?: Record<string, any>;
  handled: boolean;
  created_at: string;
}

export interface FeedbackData {
  comentarios: string;
  extension_instance_id: string;
  extension_version: string;
  detected_types: string[];
  scan_timestamp?: string;
  email?: string;
  full_name?: string;
  telefono?: string;
  ruc?: string;
  metadata?: Record<string, any>;
}

// Batch Download System Types
export type DownloadStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';

export interface DownloadJob {
  id: string;
  documento: Documento;
  formato: FormatoDescarga;
  status: DownloadStatus;
  retryCount: number;
  error?: string;
  startTime?: number;
  endTime?: number;
}

export interface DownloadSession {
  sessionId: string;
  totalDocuments: number;
  completed: string[];
  failed: DownloadJob[];
  pending: string[];
  timestamp: number;
  isPaused: boolean;
  startTime: number;
  lastUpdateTime: number;
}

export interface BatchConfig {
  batchSize: number;         // Documentos por lote (default: 15)
  concurrency: number;       // Descargas paralelas (default: 5)
  delayBetweenBatches: number; // ms (default: 2000)
  maxRetries: number;        // (default: 3)
  retryDelay: number;        // ms inicial (default: 1000)
  enableNotifications: boolean; // Notificaciones del navegador
}

export interface BatchProgress {
  currentBatch: number;
  totalBatches: number;
  completedDocs: number;
  failedDocs: number;
  pendingDocs: number;
  currentSpeed: number; // docs/min
  estimatedTimeRemaining: number; // segundos
}
