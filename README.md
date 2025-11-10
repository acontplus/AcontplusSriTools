# SRI Documentos Extractor - Extensión Chrome (TypeScript)

Una extensión de Google Chrome desarrollada para **Acontplus S.A.S.** que analiza automáticamente las páginas del sistema de comprobantes electrónicos del SRI de Ecuador y extrae la información de documentos electrónicos sin necesidad de filtros manuales.

## 🚀 Migrado a TypeScript + Webpack

Este proyecto ha sido completamente migrado a TypeScript con Webpack para mejor mantenibilidad, type safety y optimización del bundle.

## 🚀 Características

- **Detección Automática Inteligente**: Analiza la página y encuentra automáticamente las tablas de documentos electrónicos del SRI
- **Múltiples Patrones de Detección**: Compatible con diferentes versiones y estructuras del sistema SRI
- **Interfaz Simplificada**: Tabla limpia con checkboxes para selección múltiple
- **Sin Filtros Manuales**: La extensión hace todo el trabajo de análisis automáticamente
- **Exportación Dual**: JSON para APIs y CSV para Excel
- **Estadísticas en Tiempo Real**: Muestra totales de documentos seleccionados
- **Monitoreo Continuo**: Detecta nuevas tablas que aparezcan dinámicamente

## ✅ Estado de Migración

- ✅ **100% migrado a TypeScript** (19 archivos .ts, 0 archivos .js)
- ✅ **Webpack configurado y funcionando**
- ✅ **Código duplicado eliminado completamente** (16 archivos JS eliminados)
- ✅ **Type safety completo**
- ✅ **Build optimizado con code splitting**
- ✅ **Todas las funcionalidades preservadas**
- ✅ **Tamaño reducido**: src/ 196KB (antes ~500KB+)

## 📋 Datos Extraídos Automáticamente

- RUC del emisor
- Razón social completa
- Tipo de comprobante (Factura, Nota de Crédito, etc.)
- Serie y número de comprobante
- Clave de acceso (49 dígitos)
- Fechas de emisión y autorización
- Valores: subtotal, IVA y total

## 🔍 Métodos de Detección Inteligente

La extensión utiliza 4 niveles de detección automática:

### 1. **Detección por Estructura Grid**
Busca tablas con `role="grid"` y analiza los headers para identificar columnas típicas del SRI.

### 2. **Detección por ID de Elemento** 
Busca elementos con IDs comunes del sistema SRI:
- `tablaCompRecibidos`
- `tablaComprobantes` 
- `gridComprobantes`

### 3. **Detección por Contenido**
Analiza el contenido de las tablas buscando patrones típicos:
- RUC (13 dígitos)
- Clave de acceso (49 dígitos)
- Fechas en formato DD/MM/YYYY
- Valores monetarios

### 4. **Detección General**
Como último recurso, busca tablas con múltiples columnas que contengan palabras clave relacionadas con documentos electrónicos.

## 🛠️ Instalación y Desarrollo

### Requisitos Previos
- Node.js 18+ y npm
- Chrome/Chromium

### Instalación

1. **Clonar e instalar dependencias**:
   ```bash
   git clone <repo-url>
   cd AcontplusSriTools
   npm install
   ```

2. **Compilar el proyecto**:
   ```bash
   # Desarrollo (watch mode)
   npm run dev
   
   # Producción
   npm run build
   ```

3. **Cargar en Chrome**:
   - Abre `chrome://extensions/`
   - Activa "Modo de desarrollador"
   - Clic en "Cargar extensión descomprimida"
   - Selecciona la carpeta `dist/`

### Comandos Disponibles

```bash
npm run dev          # Watch mode (recompila automáticamente)
npm run build        # Build de producción
npm run clean        # Limpiar carpeta dist/
npm run rebuild      # Clean + Build
npm run type-check   # Verificar tipos TypeScript
npm run lint         # Linting con ESLint
```

### Estructura del Proyecto (TypeScript)

```
src/
├── background/          # Service Worker
│   └── index.ts
├── content/            # Content Scripts
│   ├── index.ts
│   ├── extractor.ts
│   ├── pagination.ts
│   └── downloader.ts
├── popup/             # Interfaz de usuario
│   ├── index.ts
│   ├── components/
│   │   ├── export.ts
│   │   ├── table.ts
│   │   └── notifications.ts
│   └── services/
│       ├── data.ts
│       └── ui.ts
├── services/          # Servicios compartidos
│   └── supabase.ts
└── shared/            # Código compartido
    ├── constants.ts   # Constantes centralizadas
    ├── types.ts       # Tipos TypeScript
    ├── utils.ts       # Utilidades
    ├── storage.ts     # Chrome Storage Manager
    └── messaging.ts   # Sistema de mensajería
```

### Instalación Manual (Legacy - Solo para referencia)

1. **Estructura de archivos legacy**:
   ```
   AcontplusSriTools/
   ├── manifest.json
   ├── content.js
   ├── package.json
   ├── package-lock.json
   ├── README.md
   ├── .gitignore
   ├── assets/
   │   ├── css/
   │   │   ├── content.css
   │   │   ├── feedback-modal.css
   │   │   ├── fontawesome-all.min.css
   │   │   ├── local-fonts.css
   │   │   ├── popup.css
   │   │   └── tailwind.min.css
   │   ├── fonts/
   │   │   ├── fa-brands-400.ttf
   │   │   ├── fa-regular-400.ttf
   │   │   ├── fa-regular-400.woff
   │   │   ├── fa-regular-400.woff2
   │   │   ├── fa-solid-900.ttf
   │   │   ├── fa-solid-900.woff
   │   │   └── fa-solid-900.woff2
   │   └── js/
   │       ├── lucide-init.js
   │       ├── lucide.min.js
   │       ├── supabase.js
   │       └── xlsx.full.min.js
   ├── database/
   │   ├── rls-policies.sql
   │   └── supabase.sql
   ├── icons/
   │   ├── icon16.png
   │   ├── icon32.png
   │   ├── icon48.png
   │   ├── icon128.png
   │   ├── ICONO COLOR.png
   │   ├── logo_app.png
   │   └── logo.png
   ├── popup/
   │   └── popup.html
   ├── src/
   │   ├── background/
   │   │   └── index.js
   │   ├── content/
   │   │   ├── downloader.js
   │   │   ├── extractor.js
   │   │   ├── index.js
   │   │   └── pagination.js
   │   ├── popup/
   │   │   ├── auth-component.js
   │   │   ├── index.js
   │   │   ├── components/
   │   │   │   ├── export.js
   │   │   │   ├── notifications.js
   │   │   │   ├── tab-manager.js
   │   │   │   └── table.js
   │   │   └── services/
   │   │       ├── data.js
   │   │       └── ui.js
   │   ├── services/
   │   │   ├── download-counter.js
   │   │   ├── feedback-integration.js
   │   │   └── feedback-modal.js
   │   └── shared/
   │       ├── config.js
   │       ├── http-client.js
   │       └── utils.js
   └── supabase/
       └── .gitignore
   ```

2. **Instalar en Chrome**:
   - Abre Chrome y ve a `chrome://extensions/`
   - Activa el "Modo de desarrollador"
   - Haz clic en "Cargar extensión descomprimida"
   - Selecciona la carpeta con los archivos

3. **Generar iconos automáticamente**:
   ```bash
   pip install Pillow
   python generate_icons.py
   ```

## 📖 Uso Simplificado

### 1. Navegar al SRI
- Ve al portal de comprobantes electrónicos del SRI
- Inicia sesión y navega a cualquier sección con documentos electrónicos

### 2. Detección Automática
- La extensión analizará automáticamente la página
- No necesitas hacer clic en nada - la detección es automática
- Aparecerá un indicador verde cuando encuentre documentos

### 3. Ver Resultados
- Haz clic en el icono de la extensión en la barra de herramientas
- Verás todos los documentos encontrados en una tabla organizada
- El estado mostrará: "✅ X documentos electrónicos encontrados"

### 4. Seleccionar y Exportar
- Usa los checkboxes para seleccionar documentos específicos
- O haz clic en "Seleccionar Todas" para seleccionar todos
- Haz clic en "Exportar" para descargar JSON y CSV

## 📊 Información de Estado

La interfaz muestra información en tiempo real:

- **Estado de Análisis**: "🔍 Analizando documentos electrónicos del SRI..."
- **Documentos Encontrados**: "✅ 25 documentos electrónicos encontrados"  
- **Timestamp de Extracción**: "Extraído: 13/07/2025 14:30"
- **Totales**: Cantidad total y seleccionada
- **Valores**: Total general y IVA de documentos seleccionados

## 🔧 Integración con Acontplus ERP

### Formato de Exportación Optimizado

```json
{
  "metadata": {
    "exported_at": "2025-07-13T...",
    "total_records": 25,
    "exported_by": "SRI Facturas Extractor - Acontplus S.A.S.",
    "extraction_source": "Documentos Electrónicos SRI"
  },
  "documentos": [
    {
      "ruc_emisor": "1791287541001",
      "razon_social": "MEGADATOS S.A.",
      "tipo_comprobante": "Factura",
      "establecimiento": "001",
      "punto_emision": "012", 
      "secuencial": "013055049",
      "clave_acceso": "0107202501179128754100120010120130550491641754519",
      "fecha_emision": "2025-07-01",
      "fecha_autorizacion": "2025-07-01",
      "subtotal": 23.0,
      "iva": 3.45,
      "total": 26.45
    }
  ]
}
```

### Endpoint de Integración Sugerido

```csharp
// Ejemplo para .NET 9 + SQL Server
[HttpPost("api/documentos/import-sri")]
public async Task<IActionResult> ImportDocumentosSRI([FromBody] SRIImportRequest request)
{
    var documentosImportados = 0;
    
    foreach (var documento in request.Documentos)
    {
        // Validar que no existe previamente
        var existe = await _context.DocumentosElectronicos
            .AnyAsync(d => d.ClaveAcceso == documento.ClaveAcceso);
            
        if (!existe)
        {
            await _documentoService.ImportFromSRI(documento);
            documentosImportados++;
        }
    }
    
    return Ok($"Importados {documentosImportados} nuevos documentos");
}
```

## 🎯 Ventajas de la Versión Simplificada

### ✅ **Para Usuarios Finales**
- Sin configuración ni filtros complejos
- Detección completamente automática
- Interfaz más limpia y enfocada
- Menos posibilidad de errores de usuario

### ✅ **Para Acontplus como Empresa**
- Diferenciador competitivo significativo
- Fácil de demostrar a clientes potenciales
- Reduce tiempo de capacitación
- Mayor adopción por simplicidad

### ✅ **Técnicamente Superior**
- Algoritmos de detección más robustos
- Compatible con múltiples versiones del SRI
- Monitoreo continuo de cambios dinámicos
- Logging detallado para debugging

## 🔒 Seguridad y Privacidad

- ✅ Todo el procesamiento es local en el navegador
- ✅ No se envían datos a servidores externos
- ✅ Solo funciona en páginas autorizadas del SRI
- ✅ Código fuente auditable y transparente

## 🐛 Resolución de Problemas

### "No se encontraron documentos electrónicos"
- Verifica que estés en una página del SRI con documentos
- Espera unos segundos - la detección puede tomar tiempo
- La extensión funciona en diferentes secciones del SRI

### El indicador no aparece
- Refresca la página del SRI
- Verifica que la extensión esté habilitada
- Revisa la consola del navegador (F12) para logs

### Datos incorrectos en la exportación
- La extracción se adapta automáticamente a la estructura
- Reporta problemas con capturas de pantalla
- Incluye la URL específica donde ocurre el problema

## 🚀 Monitoreo y Logs

La extensión incluye logging detallado en la consola:

```
🔍 SRI Documentos Extractor iniciado - Acontplus S.A.S.
🔍 Analizando estructura de la página...
✅ Tabla encontrada usando patrón 1
📋 Tabla con grid detectada: 6 headers coinciden
🗂️ Mapeo de columnas: {numero: 0, rucEmisor: 1, ...}
📊 Extrayendo datos de documentos...
✅ 25 documentos extraídos correctamente
💾 Datos guardados en storage
```

## 📞 Soporte Técnico

Para soporte especializado:
- **Email**: soporte@acontplus.com
- **Teléfono**: +593-XX-XXXXXXX  
- **Web**: https://acontplus.com
- **Documentación**: Incluida en cada instalación

---

**Desarrollado por Acontplus S.A.S. - Ecuador**  
*Automatizando la contabilidad digital para PyMEs ecuatorianas*

**Stack Tecnológico**: Angular 20+, .NET 9, SQL Server 2022+, Flutter, AWS Services