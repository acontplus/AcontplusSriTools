// Servicio de gestión de datos - Migrado a TypeScript

import type { Documento, PaginationInfo, FileInfo, ProgressStatus } from '@shared/types';
import type { FacturasManager } from '../index';
import { PopupUI } from './ui';

export class DataManager {
  public facturas: Documento[] = [];
  public selectedFacturas = new Set<string>();
  public paginationInfo: PaginationInfo = { current: 1, total: 1 };
  public fileInfo = new Map<string, FileInfo>();

  constructor(private manager: FacturasManager) {}

  async loadStoredData(): Promise<void> {
    const result = await chrome.storage.local.get([
      'facturasData',
      'lastExtraction',
      'lastVerification',
    ]);

    if (result.facturasData && result.facturasData.length > 0) {
      this.facturas = result.facturasData;
      this.manager.facturas = this.facturas;
      this.manager.updateDisplay();

      if (result.lastExtraction) {
        const extractionDate = new Date(result.lastExtraction);
        const extractionTimestamp = document.getElementById('extraction-timestamp');
        if (extractionTimestamp) {
          extractionTimestamp.textContent = PopupUI.formatTimestamp(extractionDate);
        }
      }

      if (result.lastVerification && Date.now() - result.lastVerification.timestamp < 10000) {
        this.handleVerificationComplete(
          result.lastVerification.foundIds,
          result.lastVerification.foundPdfIds || [],
          result.lastVerification.total,
          false
        );
        chrome.storage.local.remove('lastVerification');
      }
    } else {
      this.manager.updateDisplay();
    }
  }

  handleVerificationComplete(
    foundXmlIds: string[],
    foundPdfIds: string[],
    _total: number,
    selectedOnly: boolean
  ): void {
    const xmlSet = new Set(foundXmlIds);
    const pdfSet = new Set(foundPdfIds);

    this.facturas.forEach((factura) => {
      if (!selectedOnly || this.selectedFacturas.has(factura.id)) {
        (factura as any).tieneXml = xmlSet.has(factura.id);
        (factura as any).tienePdf = pdfSet.has(factura.id);
        (factura as any).fueVerificado = true;
      }
    });

    this.manager.renderTable();
  }

  updateSelectionCount(): void {
    this.manager.updateCounts();

    const hasSelection = this.selectedFacturas.size > 0;

    if (this.manager.downloadBtn) {
      this.manager.downloadBtn.disabled = !hasSelection;
    }

    this.manager.updatePopoverButtonStates();

    const masterCheckbox = document.getElementById('select-all') as HTMLInputElement;
    if (masterCheckbox) {
      const visibleRows = document.querySelectorAll<HTMLElement>(
        '#docs-table-body tr[data-id]:not([style*="display: none"])'
      );
      const visibleFacturaIds = Array.from(visibleRows)
        .map((row) => row.dataset.id)
        .filter((id): id is string => !!id);
      const selectedVisibleCount = visibleFacturaIds.filter((id) =>
        this.selectedFacturas.has(id)
      ).length;

      masterCheckbox.checked =
        selectedVisibleCount === visibleFacturaIds.length && visibleFacturaIds.length > 0;
      masterCheckbox.indeterminate =
        selectedVisibleCount > 0 && selectedVisibleCount < visibleFacturaIds.length;
    }
  }

  toggleSelectAll(): void {
    const masterCheckbox = document.getElementById('select-all') as HTMLInputElement;
    const shouldSelectAll = masterCheckbox
      ? masterCheckbox.checked
      : this.selectedFacturas.size === 0;

    const visibleRows = document.querySelectorAll<HTMLElement>(
      '#docs-table-body tr[data-id]:not([style*="display: none"])'
    );

    if (shouldSelectAll) {
      visibleRows.forEach((row) => {
        const facturaId = row.dataset.id;
        if (facturaId) this.selectedFacturas.add(facturaId);
      });
    } else {
      visibleRows.forEach((row) => {
        const facturaId = row.dataset.id;
        if (facturaId) this.selectedFacturas.delete(facturaId);
      });
    }

    this.manager.renderTable();
    this.updateSelectionCount();
  }

  handleRowSelection(checkbox: HTMLInputElement): void {
    const row = checkbox.closest('tr');
    const facturaId = row?.dataset.id;

    if (!facturaId) return;

    if (checkbox.checked) {
      this.selectedFacturas.add(facturaId);
      row?.classList.add('selected');
    } else {
      this.selectedFacturas.delete(facturaId);
      row?.classList.remove('selected');
    }

    this.updateSelectionCount();
    this.manager.updatePopoverButtonStates();
  }

  handleSearchComplete(progress: ProgressStatus): void {
    this.facturas = progress.allDocuments || [];
    this.manager.facturas = this.facturas;
    this.paginationInfo = progress.paginationInfo || {
      current: progress.totalPages || 1,
      total: progress.totalPages || 1,
    };

    this.manager.updateDisplay();
    this.selectedFacturas.clear();
    this.updateSelectionCount();
    this.manager.updatePopoverButtonStates();

    const totalDocuments = this.facturas.length;
    const totalPages = this.paginationInfo.total;
    const optimization = progress.resumen?.optimizacionAplicada;

    let message = `Búsqueda completada: ${totalDocuments} documentos encontrados`;
    if (totalPages > 1) message += ` en ${totalPages} página(s)`;
    if (optimization) message += ' (Optimización aplicada)';

    this.manager.showNotification(message, 'success');

    PopupUI.enableButtonsAfterOperation(false);

    if (totalDocuments > 0) {
      PopupUI.showState(
        {
          loading: this.manager.loadingEl,
          table: this.manager.tableContainerEl,
          'no-data': this.manager.noDataEl,
        },
        'table'
      );
    } else {
      PopupUI.showState(
        {
          loading: this.manager.loadingEl,
          table: this.manager.tableContainerEl,
          'no-data': this.manager.noDataEl,
        },
        'no-data'
      );
    }
  }
}
