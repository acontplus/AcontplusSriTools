// Constantes compartidas

export const VERSION = '1.4.6';
export const EXTENSION_NAME = 'Acontplus SRI Tools';

export const STORAGE_KEYS = {
  FACTURAS_DATA: 'facturasData',
  LAST_EXTRACTION: 'lastExtraction',
  PROGRESS_STATUS: 'progressStatus',
  ESTADO_ACTUAL: 'estadoActual',
  PROCESO_ACTIVO: 'procesoActivo',
  ULTIMA_EXTRACCION: 'ultimaExtraccion',
  ESTADISTICAS_ROBUSTAS: 'estadisticasRobustas',
  DOWNLOAD_PATH: 'downloadPath',
  LAST_VERIFICATION: 'lastVerification',
  METRICAS: 'metricas',
  ULTIMA_LIMPIEZA: 'ultimaLimpieza',
  PRIMERA_INSTALACION: 'primeraInstalacion',
  FECHA_INSTALACION: 'fechaInstalacion',
  VERSION: 'version',
} as const;

export const SELECTORS = {
  TABLA_RECIBIDOS: '#frmPrincipal\\:tablaCompRecibidos_data',
  TABLA_EMITIDOS: '#frmPrincipal\\:tablaCompEmitidos_data',
  PAGINATOR_RECIBIDOS: '#frmPrincipal\\:tablaCompRecibidos_paginator_bottom',
  PAGINATOR_EMITIDOS: '#frmPrincipal\\:tablaCompEmitidos_paginator_bottom',
  VIEW_STATE: '#javax\\.faces\\.ViewState',
  PAGINATOR_CURRENT: '.ui-paginator-current',
  PAGINATOR_NEXT: '.ui-paginator-next.ui-state-default.ui-corner-all',
  PAGINATOR_NEXT_DISABLED: '.ui-paginator-next.ui-state-default.ui-corner-all.ui-state-disabled',
  PAGINATOR_RPP_OPTIONS: '.ui-paginator-rpp-options',
} as const;

export const DELAYS = {
  REPAGINATION: 4000,
  PAGE_NAVIGATION: 4000,
  DOWNLOAD_BETWEEN: 500,
  DOWNLOAD_FORMAT: 250,
  INIT_DELAY: 500,
  AUTO_SYNC_DELAY: 1000,
  RETRY_DELAY: 1000,
} as const;

export const LIMITS = {
  MAX_ROWS_PER_PAGE: 300,
  MAX_RETRIES: 3,
  PROGRESS_UPDATE_INTERVAL: 10,
  MAX_METRICS: 100,
  METRICS_RETENTION_DAYS: 7,
} as const;

export const URLS = {
  SRI_DOMAIN: 'sri.gob.ec',
  SRI_ONLINE: 'srienlinea.sri.gob.ec',
  COMPROBANTES_RECIBIDOS: 'https://srienlinea.sri.gob.ec/comprobantes-electronicos-internet/pages/consultas/recibidos/comprobantesRecibidos.jsf',
} as const;

export const MESSAGES = {
  EXTENSION_LOADED: '🔍 SRI Documentos Extractor iniciado - Acontplus S.A.S.',
  ANALYZING_PAGE: '🔍 Analizando estructura de la página...',
  TABLE_FOUND: '✅ Tabla encontrada',
  EXTRACTING_DATA: '📊 Extrayendo datos de documentos...',
  DATA_SAVED: '💾 Datos guardados en storage',
  SESSION_EXPIRED: 'Sesión expirada. Recarga la página del SRI e inicia sesión nuevamente.',
  SESSION_LOST: 'Sesión perdida. Recarga la página del SRI e inicia sesión nuevamente.',
  NO_DOCUMENTS: 'No se encontraron documentos electrónicos',
  SEARCH_STARTED: '🔍 Búsqueda iniciada en todas las páginas disponibles',
  DOWNLOAD_CANCELLED: 'Descarga cancelada por el usuario',
} as const;

export const NOTIFICATION_DURATION = 5000;

export const IFRAME_ID = 'acontplus-sri-tools-iframe';

export const BRAND_COLORS = {
  PRIMARY: '#D61672',
  PRIMARY_HOVER: '#B8145F',
  SECONDARY: '#1E293B',
  SUCCESS: '#10B981',
  WARNING: '#F59E0B',
  ERROR: '#EF4444',
  INFO: '#3B82F6',
} as const;
