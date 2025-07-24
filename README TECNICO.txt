# SRI Documentos Extractor - Extensión Chrome v1.2.4 (Versión Mejorada)

Una extensión de Google Chrome desarrollada para **Acontplus S.A.S.** que utiliza **detección automática inteligente** para analizar las páginas del sistema de comprobantes electrónicos del SRI de Ecuador y extraer automáticamente toda la información de documentos electrónicos, incluyendo **claves de acceso completas**.

## 🚀 Novedades v1.2.4 - Mejoras Solicitadas

### ✨ **Nuevas Características Implementadas**

- **📊 Columna Contador**: Nueva columna numerada antes de "Número" para contar filas automáticamente
- **🔑 Columna Clave de Acceso**: Visualización completa de claves de acceso de 49 dígitos con formato mejorado
- **🎨 Logotipo Corporativo SVG**: Nuevo logo Acontplus con identidad de marca actualizada
- **📱 Interfaz Ampliada**: Ancho ajustado a 1600px para acomodar todas las columnas sin pérdida de información
- **🔄 Scroll Optimizado**: Navegación mejorada con scrollbars personalizados para visualizar todas las filas

### 🎯 **Mejoras de UX/UI**

- **Elimación de columna Acciones**: Interfaz más limpia sin botones innecesarios
- **Iconos limpiados**: Removidos caracteres especiales problemáticos
- **Clave de acceso clickeable**: Click para copiar automáticamente al portapapeles
- **Formato de clave legible**: Separación visual cada 10 dígitos para mejor lectura
- **Contador automático**: Numeración secuencial de documentos

## 📋 Estructura de Datos Extraídos

| # | Tipo | RUC Emisor | Razón Social | Número | Fecha | Clave de Acceso | Subtotal | IVA | Total |
|---|------|------------|--------------|--------|-------|-----------------|----------|-----|-------|
| 1 | F | 1791287541001 | MEGADATOS S.A. | 001-012-013055049 | 01/07/25 | 0107202501179128754100120010120130550491641754519 | 23.00 | 3.45 | 26.45 |

## 🔍 Sistema de Detección Inteligente v1.2.4

La extensión utiliza **5 niveles de detección automática** optimizados para la estructura del SRI:

### 1. **Detección Específica del SRI**
```javascript
// Busca elementos por IDs específicos del sistema SRI
✅ frmPrincipal:tablaCompRecibidos_data (ID exacto del SRI)
✅ frmPrincipal:tablaCompEmitidos_data (ID exacto del SRI)
✅ Validación de estructura PrimeFaces
```

### 2. **Extracción de Clave de Acceso Completa**
```javascript
// Maneja claves de acceso de 49 dígitos
✅ Extracción directa desde celdas específicas
✅ Limpieza automática de caracteres no numéricos
✅ Validación de longitud exacta (49 dígitos)
✅ Formato visual mejorado con espacios cada 10 dígitos
```

### 3. **Detección por Grid con Headers Anidados**
```javascript
// Maneja la estructura anidada específica del SRI
✅ <th><div class="ui-dt-c"><span>RUC y Razón social emisor</span></div></th>
✅ Extrae texto de múltiples niveles de anidación
✅ Valida al menos 8 headers específicos del SRI (incluyendo clave de acceso)
```

### 4. **Detección por Clases PrimeFaces**
```javascript
// Busca clases específicas de la interfaz del SRI
✅ table.ui-datatable-table
✅ .ui-datatable-data
✅ Elementos con clases ui-widget, ui-state-default
```

### 5. **Detección por Contenido Específico del SRI**
```javascript
// Analiza patrones específicos en los datos
✅ RUC ecuatoriano (10-13 dígitos)
✅ Clave de acceso (49 dígitos exactos)
✅ Fechas en formato DD/MM/YYYY
✅ Valores monetarios con decimales
✅ Links con onclick de PrimeFaces
```

## 🛠️ Instalación

### Instalación Manual (Desarrollo)

1. **Crear estructura de archivos**:
   ```
   sri-documentos-extractor-v124/
   ├── manifest.json
   ├── content.js
   ├── content.css
   ├── popup.html
   ├── popup.js
   ├── popup.css
   └── icons/
       ├── icon16.png
       ├── icon48.png
       └── icon128.png
   ```

2. **Instalar en Chrome**:
   - Abre Chrome y ve a `chrome://extensions/`
   - Activa el "Modo de desarrollador"
   - Haz clic en "Cargar extensión descomprimida"
   - Selecciona la carpeta con los archivos

## 📖 Uso Detallado v1.2.4

### 1. Navegación al SRI
- Ve al portal de comprobantes electrónicos del SRI
- Inicia sesión y navega a cualquier sección con documentos electrónicos

### 2. Detección Automática Mejorada
- La extensión analizará automáticamente la página
- Detectará tanto comprobantes **recibidos** como **emitidos**
- Aparecerá un indicador verde cuando encuentre documentos

### 3. Visualización Completa
- Haz clic en el icono de la extensión en la barra de herramientas
- Verás todos los documentos en una tabla organizada con:
  - **Contador automático** de filas
  - **Clave de acceso completa** formateada
  - **Scroll optimizado** para navegar por todos los registros
  - **Logotipo corporativo Acontplus** actualizado

### 4. Funcionalidades de Clave de Acceso
- **Click para copiar**: Haz clic en cualquier clave de acceso para copiarla
- **Formato legible**: Claves separadas cada 10 dígitos para fácil lectura
- **Validación automática**: Solo claves de 49 dígitos válidas

### 5. Exportación Mejorada
- Usa los checkboxes para seleccionar documentos específicos
- La exportación incluye la **columna contador** y **clave de acceso**
- Formatos disponibles: Excel (.xlsx) con estilos corporativos

## 📊 Información de Estado v1.2.4

La interfaz muestra información en tiempo real:

- **Estado de Análisis**: "🔍 Analizando documentos electrónicos del SRI..."
- **Documentos Encontrados**: "✅ 25 documentos electrónicos encontrados"  
- **Timestamp de Extracción**: "Extraído: 14/07/2025 14:30"
- **Totales con Contador**: Cantidad total, seleccionada y valores monetarios
- **Indicador de Clave**: "🔑 Claves de acceso extraídas correctamente"

## 🔧 Integración con Acontplus ERP v1.2.4

### Formato de Exportación Optimizado

```json
{
  "metadata": {
    "exported_at": "2025-07-14T...",
    "total_records": 25,
    "exported_by": "SRI Facturas Extractor - Acontplus S.A.S. v1.2.4",
    "extraction_source": "Documentos Electrónicos SRI",
    "includes_clave_acceso": true
  },
  "documentos": [
    {
      "contador": 1,
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
// Ejemplo para .NET 9 + SQL Server con nueva estructura
[HttpPost("api/documentos/import-sri-v124")]
public async Task<IActionResult> ImportDocumentosSRIv124([FromBody] SRIImportRequest request)
{
    var documentosImportados = 0;
    
    foreach (var documento in request.Documentos)
    {
        // Validar clave de acceso de 49 dígitos
        if (documento.ClaveAcceso?.Length != 49)
        {
            continue; // Skip invalid access keys
        }
        
        // Validar que no existe previamente
        var existe = await _context.DocumentosElectronicos
            .AnyAsync(d => d.ClaveAcceso == documento.ClaveAcceso);
            
        if (!existe)
        {
            await _documentoService.ImportFromSRIv124(documento);
            documentosImportados++;
        }
    }
    
    return Ok($"Importados {documentosImportados} nuevos documentos con claves de acceso");
}
```

## 🎯 Ventajas de la Versión v1.2.4

### ✅ **Para Usuarios Finales**
- **Navegación mejorada**: Scroll optimizado para ver todos los documentos
- **Información completa**: Claves de acceso visibles y copiables
- **Contador automático**: Fácil referencia de número de documentos
- **Interfaz ampliada**: Todas las columnas visibles sin pérdida de información

### ✅ **Para Acontplus como Empresa**
- **Diferenciador competitivo**: Primera extensión con clave de acceso integrada
- **Identidad de marca**: Logo corporativo SVG actualizado
- **Mayor valor agregado**: Funcionalidad completa de gestión documental
- **Compliance mejorado**: Acceso directo a claves de validación SRI

### ✅ **Técnicamente Superior**
- **Arquitectura responsive**: Adaptable a diferentes tamaños de pantalla
- **Performance optimizada**: Scroll virtual para grandes volúmenes de datos
- **Validación robusta**: Verificación automática de integridad de claves
- **Logging detallado**: Diagnóstico completo para soporte técnico

## 🔒 Seguridad y Privacidad v1.2.4

- ✅ **Procesamiento local**: Claves de acceso procesadas solo en el navegador
- ✅ **No transmisión externa**: Datos sensibles nunca salen del equipo del usuario
- ✅ **Validación de integridad**: Verificación automática de claves de 49 dígitos
- ✅ **Auditoría completa**: Logs detallados de todas las operaciones

## 🐛 Debugging y Diagnóstico v1.2.4

### **Logs Detallados en Consola**
```javascript
🔍 === INICIO ANÁLISIS DE PÁGINA SRI v1.2.4 ===
🌐 URL actual: https://comprobantes-electronicos-internet/...
📊 Estadísticas iniciales: {tablasTotales: 5, tablasConGrid: 1, ...}
🔍 Detectando tabla específica del SRI...
📋 Tabla encontrada: frmPrincipal:tablaCompRecibidos_data
✅ === TABLA ENCONTRADA ===
📋 Información: {id: "...", headers: 10, filas: 25}
🔑 Extrayendo claves de acceso...
📊 Extrayendo datos de documentos...
✅ 25 documentos extraídos con claves de acceso válidas
💾 Datos guardados en storage
```

### **Diagnóstico de Claves de Acceso**
```javascript
🔑 === VALIDACIÓN DE CLAVES DE ACCESO ===
📊 Total claves encontradas: 25
✅ Claves válidas (49 dígitos): 25
❌ Claves inválidas: 0
🔍 Formato detectado: Numérico puro
📋 Columna de origen: Posición 3 (Recibidos) / Posición 2 (Emitidos)
```

### **Estados del Indicador Visual v1.2.4**
- 🔍 **Azul**: Analizando página
- ✅ **Verde**: Documentos y claves extraídos correctamente
- 🔑 **Verde con llave**: Claves de acceso detectadas y validadas
- ⚠️ **Amarillo**: Tabla detectada pero pocas claves válidas
- ❌ **Rojo**: No se pudo detectar tabla o claves

## 📱 Responsive Design v1.2.4

### **Breakpoints Optimizados**
- **1600px+**: Vista completa con todas las columnas
- **1400px**: Clave de acceso comprimida a 400px
- **1200px**: Layout de 2 columnas en estadísticas
- **1000px**: Clave de acceso a 300px, tabla compacta
- **768px**: Modo móvil con scroll horizontal

### **Adaptaciones por Pantalla**
```css
/* Pantallas grandes: Vista completa */
@media (min-width: 1600px) {
  .clave-col { width: 500px; }
  .facturas-table { min-width: 1550px; }
}

/* Pantallas medianas: Comprimido */
@media (max-width: 1450px) {
  .clave-col { width: 350px; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
}

/* Pantallas pequeñas: Móvil */
@media (max-width: 768px) {
  .table-wrapper { overflow-x: auto; }
  .clave-col { width: 250px; font-size: 8px; }
}
```

## 🚀 Roadmap v1.2.5 (Próximas Mejoras)

### **Funcionalidades Planificadas**
- **🔄 Sincronización automática** con Acontplus ERP
- **📊 Dashboard de métricas** en tiempo real  
- **🔍 Filtros avanzados** por fecha, tipo, monto
- **📧 Alertas automáticas** de nuevos documentos
- **🏷️ Etiquetado inteligente** de documentos
- **📋 Plantillas personalizadas** de exportación

### **Mejoras Técnicas**
- **⚡ Performance**: Virtualización de tabla para 1000+ documentos
- **🔒 Seguridad**: Encriptación local de datos sensibles
- **🌐 Multi-idioma**: Soporte para inglés y portugués
- **📱 PWA**: Versión Progressive Web App
- **🤖 IA**: Clasificación automática de documentos

## 📞 Soporte Técnico v1.2.4

Para soporte especializado con la nueva versión:
- **Email**: soporte@acontplus.com
- **Teléfono**: +593-XX-XXXXXXX  
- **Web**: https://acontplus.com
- **Documentación técnica**: Incluida en cada instalación
- **Tickets de soporte**: Sistema integrado en extensión

### **Información para Tickets de Soporte**
```javascript
// Comando para obtener información técnica v1.2.4:
console.log('Info técnica v1.2.4:', {
  version: '1.2.4',
  url: window.location.href,
  title: document.title,
  tablas: document.querySelectorAll('table').length,
  grids: document.querySelectorAll('table[role="grid"]').length,
  claves_detectadas: document.querySelectorAll('[id*="clave"]').length,
  userAgent: navigator.userAgent,
  timestamp: new Date().toISOString()
});
```

---

**Desarrollado por Acontplus S.A.S. - Ecuador**  
*Automatizando la contabilidad digital para PyMEs ecuatorianas*

**Stack Tecnológico v1.2.4**: Angular 20+, .NET 9, SQL Server 2022+, Flutter, AWS Services  
**Extensión Chrome**: Vanilla JS, CSS3, Web APIs, Chrome Extensions Manifest V3