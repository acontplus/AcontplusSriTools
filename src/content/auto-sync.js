// Auto-Sync para Acontplus SRI Tools v1.4.4
// Detecta automáticamente cuando el usuario consulta en SRI y sincroniza

class SRIAutoSync {
  constructor(extractorInstance) {
    this.extractor = extractorInstance;
    this.isMonitoring = false;
    this.consultarButton = null;
    this.lastDocumentCount = 0;
    this.syncInProgress = false;
    this.chromeApiAvailable = this.checkChromeAPI();

    console.log("🔄 SRI Auto-Sync inicializado - Chrome API:", this.chromeApiAvailable ? 'Disponible' : 'No disponible');
    this.init();
  }

  checkChromeAPI() {
    try {
      return typeof chrome !== 'undefined' && 
             chrome.runtime && 
             chrome.runtime.sendMessage;
    } catch (error) {
      console.warn('⚠️ Chrome API no completamente disponible:', error);
      return false;
    }
  }

  init() {
    // Esperar a que la página esté completamente cargada
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.setupAutoSync());
    } else {
      this.setupAutoSync();
    }
  }

  setupAutoSync() {
    this.findConsultarButton();
    this.setupTableObserver();
    this.setupButtonObserver();

    // Verificar periódicamente si aparece el botón (en caso de navegación SPA)
    setInterval(() => {
      if (!this.consultarButton || !document.contains(this.consultarButton)) {
        this.findConsultarButton();
      }
    }, 5000);
  }

  findConsultarButton() {
    // Buscar el botón de consultar del SRI
    const button = document.getElementById("btnRecaptcha");
    if (button && button !== this.consultarButton) {
      this.consultarButton = button;
      this.setupButtonObserver();
      console.log('✅ Botón "Consultar" del SRI encontrado');
    }
  }

  setupButtonObserver() {
    if (!this.consultarButton) return;

    // Remover listener anterior si existe
    if (this.consultarButton._autoSyncListener) {
      this.consultarButton.removeEventListener(
        "click",
        this.consultarButton._autoSyncListener
      );
    }

    // Agregar nuevo listener
    const clickHandler = () => {
      console.log(
        '🔍 Usuario hizo clic en "Consultar" - Preparando auto-sync...'
      );
      this.prepareForSync();
    };

    this.consultarButton.addEventListener("click", clickHandler);
    this.consultarButton._autoSyncListener = clickHandler;
  }

  setupTableObserver() {
    // Observar cambios en las tablas de comprobantes
    const tableSelectors = [
      "#frmPrincipal\\:tablaCompRecibidos_data",
      "#frmPrincipal\\:tablaCompEmitidos_data",
    ];

    tableSelectors.forEach((selector) => {
      const table = document.querySelector(selector);
      if (table) {
        this.observeTable(table);
      }
    });

    // Observer para detectar cuando aparecen nuevas tablas
    const bodyObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            tableSelectors.forEach((selector) => {
              const newTable = node.querySelector
                ? node.querySelector(selector)
                : null;
              if (newTable && !newTable._autoSyncObserved) {
                this.observeTable(newTable);
              }
            });
          }
        });
      });
    });

    bodyObserver.observe(document.body, { childList: true, subtree: true });
  }

  observeTable(table) {
    if (table._autoSyncObserved) return;

    table._autoSyncObserved = true;
    console.log("👀 Observando tabla:", table.id);

    const observer = new MutationObserver((mutations) => {
      let hasNewData = false;

      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          // Verificar si se agregaron nuevas filas
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "TR") {
              hasNewData = true;
            }
          });
        }
      });

      if (hasNewData && this.isMonitoring && !this.syncInProgress) {
        console.log("📊 Nuevos datos detectados en tabla");
        this.handleNewData();
      }
    });

    observer.observe(table, {
      childList: true,
      subtree: true,
      attributes: false,
    });
  }

  prepareForSync() {
    this.isMonitoring = true;
    this.syncInProgress = false;

    // Esperar un poco para que el reCAPTCHA y la consulta se procesen
    setTimeout(() => {
      console.log("⏳ Esperando resultados de la consulta...");
      this.waitForResults();
    }, 2000);
  }

  waitForResults() {
    let attempts = 0;
    const maxAttempts = 15; // 30 segundos máximo

    const checkForResults = () => {
      attempts++;

      // Verificar si hay datos en las tablas
      const hasData = this.checkForTableData();

      if (hasData) {
        console.log(
          "✅ Datos encontrados, iniciando sincronización automática..."
        );
        this.handleNewData();
      } else if (attempts < maxAttempts) {
        // Seguir esperando
        setTimeout(checkForResults, 2000);
      } else {
        console.log("⏰ Timeout esperando resultados de consulta SRI");
        this.isMonitoring = false;
      }
    };

    checkForResults();
  }

  checkForTableData() {
    const tables = [
      document.querySelector("#frmPrincipal\\:tablaCompRecibidos_data"),
      document.querySelector("#frmPrincipal\\:tablaCompEmitidos_data"),
    ];

    for (const table of tables) {
      if (table && table.children.length > 0) {
        // Verificar que no sea solo una fila de "no hay datos"
        const rows = table.querySelectorAll("tr");
        if (rows.length > 0) {
          // Verificar que no sea un mensaje de "no hay registros"
          const firstRow = rows[0];
          const cellText = firstRow.textContent.toLowerCase();
          if (
            !cellText.includes("no hay registros") &&
            !cellText.includes("no se encontraron") &&
            !cellText.includes("sin resultados")
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }

  async handleNewData() {
    if (this.syncInProgress) return;

    this.syncInProgress = true;
    this.isMonitoring = false;

    try {
      console.log("🔄 Iniciando sincronización automática...");

      // Extraer datos de la página actual
      const result = await this.extractor.extractCurrentPageData();

      if (
        result &&
        result.success &&
        result.documentos &&
        result.documentos.length > 0
      ) {
        console.log(
          `✅ Auto-sync completado: ${result.documentos.length} documentos sincronizados`
        );

        // Mostrar notificación sutil
        this.showSyncNotification(result.documentos.length);

        // Actualizar badge de la extensión
        this.updateExtensionBadge(result.documentos.length);
      } else {
        console.log(
          "⚠️ Auto-sync: No se encontraron documentos para sincronizar"
        );
      }
    } catch (error) {
      console.error("❌ Error en auto-sync:", error);
    } finally {
      this.syncInProgress = false;
    }
  }

  showSyncNotification(count) {
    // Crear notificación sutil que no interrumpa al usuario
    const notification = document.createElement("div");
    notification.className = "acontplus-auto-sync-notification";
    notification.innerHTML = `
      <div class="sync-notification-content">
        <i class="fa-solid fa-sync-alt"></i>
        <span>ACONTPLUS: ${count} documentos sincronizados</span>
        <button class="close-notification" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    // Estilos inline para evitar dependencias
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      background: linear-gradient(135deg, #D61672, #FFA901);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: Arial, sans-serif;
      font-size: 14px;
      animation: slideInRight 0.3s ease-out;
      max-width: 300px;
    `;

    // Agregar animación CSS
    if (!document.getElementById("acontplus-sync-styles")) {
      const styles = document.createElement("style");
      styles.id = "acontplus-sync-styles";
      styles.textContent = `
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .sync-notification-content {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .close-notification {
          background: none;
          border: none;
          color: white;
          font-size: 18px;
          cursor: pointer;
          padding: 0;
          margin-left: auto;
        }
        .close-notification:hover {
          opacity: 0.7;
        }
      `;
      document.head.appendChild(styles);
    }

    document.body.appendChild(notification);

    // Auto-remover después de 5 segundos
    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.animation = "slideInRight 0.3s ease-out reverse";
        setTimeout(() => notification.remove(), 300);
      }
    }, 5000);
  }

  updateExtensionBadge(count) {
    // Enviar mensaje al background script para actualizar el badge
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: "updateBadge",
          count: count,
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('⚠️ Error actualizando badge:', chrome.runtime.lastError);
          }
        });
      }
    } catch (error) {
      console.warn("⚠️ Badge update not available:", error);
    }
  }

  // Método para desactivar el auto-sync si es necesario
  disable() {
    this.isMonitoring = false;
    console.log("🔄 Auto-sync desactivado");
  }

  // Método para reactivar el auto-sync
  enable() {
    this.setupAutoSync();
    console.log("🔄 Auto-sync reactivado");
  }
}

// Exportar para uso global
window.SRIAutoSync = SRIAutoSync;
