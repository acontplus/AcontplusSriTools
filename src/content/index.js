// Content Script principal para Acontplus SRI Tools v1.4.1 - Final
// Punto de entrada modular

// MARCAR QUE EL CONTENT SCRIPT ESTÁ CARGADO
window.SRIExtractorLoaded = true;
console.log('🔍 Content Script modular cargado correctamente - Acontplus SRI Tools v1.4.1-Final');

// Los módulos se cargan automáticamente por el manifest.json
// Inicializar el extractor y hacerlo globalmente accesible
window.sriExtractorInstance = new SRIDocumentosExtractor();