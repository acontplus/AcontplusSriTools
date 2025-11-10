// Auto-Sync - Migrado a TypeScript

import { updateBadge } from '@shared/messaging';
import type { SRIDocumentosExtractor } from './extractor';

export class SRIAutoSync {
  private extractor: SRIDocumentosExtractor;
  private isMonitoring = false;
  private consultarButton: HTMLElement | null = null;
  private syncInProgress = false;
  private chromeApiAvailable: boolean;

  constructor(extractorInstance: SRIDocumentosExtractor) {
    this.extractor = extractorInstance;
    this.chromeApiAvailable = this.checkChromeAPI();
    console.log('🔄 SRI Auto-Sync inicializado - Chrome API:', this.chromeApiAvailable ? 'Disponible' : 'No disponible');
    this.init();
  }

  private checkChromeAPI(): boolean {
    try {
      return typeof chrome !== 'undefined' && !!chrome.runtime?.sendMessage;
    } catch (error) {
      console.warn('⚠️ Chrome API no completamente disponible:', error);
      return false;
    }
  }

  private init(): void {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupAutoSync());
    } else {
      this.setupAutoSync();
    }
  }

  private setupAutoSync(): void {
    this.findConsultarButton();
    this.setupTableObserver();
    this.setupButtonObserver();

    setInterval(() => {
      if (!this.consultarButton || !document.contains(this.consultarButton)) {
        this.findConsultarButton();
      }
    }, 5000);
  }

  private findConsultarButton(): void {
    const button = document.getElementById('btnRecaptcha');
    if (button && button !== this.consultarButton) {
      this.consultarButton = button;
      this.setupButtonObserver();
      console.log('✅ Botón "Consultar" del SRI encontrado');
    }
  }

  private setupButtonObserver(): void {
    if (!this.consultarButton) return;

    if ((this.consultarButton as any)._autoSyncListener) {
      this.consultarButton.removeEventListener('click', (this.consultarButton as any)._autoSyncListener);
    }

    const clickHandler = () => {
      console.log('🔍 Usuario hizo clic en "Consultar" - Preparando auto-sync...');
      this.prepareForSync();
    };

    this.consultarButton.addEventListener('click', clickHandler);
    (this.consultarButton as any)._autoSyncListener = clickHandler;
  }

  private setupTableObserver(): void {
    const tableSelectors = [
      '#frmPrincipal\\:tablaCompRecibidos_data',
      '#frmPrincipal\\:tablaCompEmitidos_data',
    ];

    tableSelectors.forEach((selector) => {
      const table = document.querySelector(selector);
      if (table) {
        this.observeTable(table as HTMLElement);
      }
    });

    const bodyObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            tableSelectors.forEach((selector) => {
              const newTable = (node as Element).querySelector?.(selector);
              if (newTable && !(newTable as any)._autoSyncObserved) {
                this.observeTable(newTable as HTMLElement);
              }
            });
          }
        });
      });
    });

    bodyObserver.observe(document.body, { childList: true, subtree: true });
  }

  private observeTable(table: HTMLElement): void {
    if ((table as any)._autoSyncObserved) return;

    (table as any)._autoSyncObserved = true;
    console.log('👀 Observando tabla:', table.id);

    const observer = new MutationObserver((mutations) => {
      let hasNewData = false;

      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'TR') {
              hasNewData = true;
            }
          });
        }
      });

      if (hasNewData && this.isMonitoring && !this.syncInProgress) {
        console.log('📊 Nuevos datos detectados en tabla');
        this.handleNewData();
      }
    });

    observer.observe(table, { childList: true, subtree: true, attributes: false });
  }

  private prepareForSync(): void {
    this.isMonitoring = true;
    this.syncInProgress = false;

    setTimeout(() => {
      console.log('⏳ Esperando resultados de la consulta...');
      this.waitForResults();
    }, 2000);
  }

  private waitForResults(): void {
    let attempts = 0;
    const maxAttempts = 15;

    const checkForResults = () => {
      attempts++;

      const hasData = this.checkForTableData();

      if (hasData) {
        console.log('✅ Datos encontrados, iniciando sincronización automática...');
        this.handleNewData();
      } else if (attempts < maxAttempts) {
        setTimeout(checkForResults, 2000);
      } else {
        console.log('⏰ Timeout esperando resultados de consulta SRI');
        this.isMonitoring = false;
      }
    };

    checkForResults();
  }

  private checkForTableData(): boolean {
    const tables = [
      document.querySelector('#frmPrincipal\\:tablaCompRecibidos_data'),
      document.querySelector('#frmPrincipal\\:tablaCompEmitidos_data'),
    ];

    for (const table of tables) {
      if (table && table.children.length > 0) {
        const rows = table.querySelectorAll('tr');
        if (rows.length > 0) {
          const firstRow = rows[0];
          const cellText = firstRow.textContent?.toLowerCase() || '';
          if (
            !cellText.includes('no hay registros') &&
            !cellText.includes('no se encontraron') &&
            !cellText.includes('sin resultados')
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private async handleNewData(): Promise<void> {
    if (this.syncInProgress) return;

    this.syncInProgress = true;
    this.isMonitoring = false;

    try {
      console.log('🔄 Iniciando sincronización automática...');

      const result = await this.extractor.extractCurrentPageData();

      if (result?.success && result.documentos && result.documentos.length > 0) {
        console.log(`✅ Auto-sync completado: ${result.documentos.length} documentos sincronizados`);
        this.showSyncNotification(result.documentos.length);
        this.updateExtensionBadge(result.documentos.length);
      } else {
        console.log('⚠️ Auto-sync: No se encontraron documentos para sincronizar');
      }
    } catch (error) {
      console.error('❌ Error en auto-sync:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  private showSyncNotification(count: number): void {
    const notification = document.createElement('div');
    notification.className = 'acontplus-auto-sync-notification';
    notification.innerHTML = `
      <div class="sync-notification-content">
        <i class="fa-solid fa-sync-alt"></i>
        <span>ACONTPLUS: ${count} documentos sincronizados</span>
        <button class="close-notification" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

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

    if (!document.getElementById('acontplus-sync-styles')) {
      const styles = document.createElement('style');
      styles.id = 'acontplus-sync-styles';
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

    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.animation = 'slideInRight 0.3s ease-out reverse';
        setTimeout(() => notification.remove(), 300);
      }
    }, 5000);
  }

  private updateExtensionBadge(count: number): void {
    updateBadge(count).catch((error) => {
      console.warn('⚠️ Badge update not available:', error);
    });
  }

  public disable(): void {
    this.isMonitoring = false;
    console.log('🔄 Auto-sync desactivado');
  }

  public enable(): void {
    this.setupAutoSync();
    console.log('🔄 Auto-sync reactivado');
  }
}

// Exportar globalmente
declare global {
  interface Window {
    SRIAutoSync: typeof SRIAutoSync;
  }
}

if (typeof window !== 'undefined') {
  window.SRIAutoSync = SRIAutoSync;
}
