# ✅ CHECKLIST DE PRUEBA - Acontplus SRI Tools v1.4.1

## 🔥 PASOS CRÍTICOS (HACER AHORA)

### 1️⃣ Recargar la Extensión
- [ ] Ir a `chrome://extensions/`
- [ ] Encontrar "Acontplus SRI Tools v1.4.1-Final"
- [ ] Hacer clic en el botón de **recargar** (🔄)
- [ ] Verificar que no haya errores en rojo

### 2️⃣ Abrir el Portal del SRI
- [ ] Navegar a: https://srienlinea.sri.gob.ec/
- [ ] Iniciar sesión
- [ ] Ir a **Comprobantes Recibidos** o **Comprobantes Emitidos**
- [ ] Esperar a que cargue la tabla de documentos

### 3️⃣ Probar la Extensión
- [ ] Hacer clic en el icono de la extensión (barra de herramientas)
- [ ] Hacer clic en el botón **"Buscar"**
- [ ] Observar el mensaje: "Cargando módulos..." (si es primera vez)
- [ ] Esperar a ver: "Búsqueda iniciada en todas las páginas disponibles"
- [ ] Verificar que la tabla se llene con documentos

### 4️⃣ Verificar Funcionalidades
- [ ] **Selección**: Hacer clic en checkboxes de documentos
- [ ] **Exportar Excel**: Hacer clic en "Exportar Excel" → Descargar archivo
- [ ] **Descargar XML/PDF**: Seleccionar formato → Hacer clic en "Descargar"
- [ ] **Verificar Descargas**: Hacer clic en "Verificar Descargas" → Seleccionar carpeta

---

## 🐛 SOLUCIÓN DE PROBLEMAS RÁPIDA

### ❌ Error: "Could not establish connection"
**SOLUCIÓN**: 
1. Recargar extensión en `chrome://extensions/`
2. Recargar página del SRI (F5)
3. Esperar 5 segundos
4. Volver a hacer clic en "Buscar"

### ❌ Error: "Navega a una página del SRI"
**SOLUCIÓN**: 
- Asegurarse de estar en una URL válida del SRI
- Verificar que la URL contenga: `sri.gob.ec`

### ❌ La tabla no se llena
**SOLUCIÓN**:
1. Abrir consola del navegador (F12)
2. Buscar mensajes con 🔍, ✅ o ❌
3. Verificar que haya documentos en la página del SRI

### ❌ Botones deshabilitados
**SOLUCIÓN**:
- Primero hacer clic en "Buscar"
- Esperar a que se llene la tabla
- Seleccionar al menos un documento

---

## 📊 SEÑALES DE ÉXITO

### ✅ TODO FUNCIONA SI VES:
1. **En el botón "Buscar"**:
   - "Conectando..." → "Cargando módulos..." → "Iniciando..." → "Procesando..."

2. **En la notificación**:
   - "🔍 Búsqueda iniciada en todas las páginas disponibles"

3. **En la tabla**:
   - Filas con documentos
   - Checkboxes funcionales
   - Totales calculados

4. **En la consola (F12)**:
   - `✅ Scripts inyectados correctamente`
   - `✅ Content script respondiendo correctamente`
   - `📊 Progreso: X% - Página Y/Z - N documentos`

---

## 🎯 PRUEBA COMPLETA (5 MINUTOS)

### Escenario 1: Primera Vez
1. Abrir página del SRI (sin haber usado la extensión)
2. Hacer clic en icono de extensión
3. Hacer clic en "Buscar"
4. **ESPERAR**: Verás "Cargando módulos..." (esto es NORMAL)
5. Debería funcionar automáticamente

### Escenario 2: Uso Normal
1. Página del SRI ya tiene la extensión cargada
2. Hacer clic en "Buscar"
3. Debería iniciar inmediatamente (sin "Cargando módulos...")

### Escenario 3: Después de Recargar Página
1. Recargar página del SRI (F5)
2. Hacer clic en "Buscar"
3. Debería cargar módulos automáticamente y funcionar

---

## 📝 NOTAS IMPORTANTES

### ⚠️ Comportamiento Esperado:
- **Primera vez en una página**: Tarda 2-3 segundos (carga scripts)
- **Usos posteriores**: Instantáneo
- **Después de F5**: Vuelve a cargar scripts (2-3 segundos)

### ⚠️ Limitaciones Conocidas:
- Solo funciona en páginas del SRI (*.sri.gob.ec)
- Requiere que haya documentos en la página
- La descarga de archivos puede tardar según cantidad

### ⚠️ Console Logs:
- Los mensajes en consola son para debugging
- Se pueden eliminar después de confirmar que funciona
- NO afectan la funcionalidad

---

## 🚀 SI TODO FUNCIONA

### Próximos Pasos:
1. ✅ Probar con diferentes tipos de documentos
2. ✅ Probar con múltiples páginas
3. ✅ Probar descarga de XML y PDF
4. ✅ Probar verificación de descargas
5. ✅ Probar exportación a Excel

### Opcional (Después):
- Limpiar console.logs excesivos
- Optimizar tiempos de espera
- Agregar más validaciones

---

## 📞 CONTACTO DE EMERGENCIA

Si nada funciona:
1. Captura de pantalla del error
2. Abrir consola (F12) → Copiar mensajes de error
3. Verificar URL actual
4. Verificar versión de Chrome

---

**¡ÉXITO! 🎉**

Si completaste todos los checkboxes, la extensión está funcionando correctamente.

---

**Acontplus S.A.S. - Ecuador**  
*Versión: 1.4.1-Final (Hotfix - Inyección Automática)*  
*Fecha: Octubre 2025*
