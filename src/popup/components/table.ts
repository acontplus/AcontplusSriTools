// Componente de tabla - Migrado a TypeScript

import { safeSetHTML, safeSetText } from '@shared/utils';
import type { Documento } from '@shared/types';
import type { FacturasManager } from '../index';

export class TableComponent {
  private tbodyEl: HTMLElement | null = null;

  constructor(private manager: FacturasManager) {}

  initialize(tbodyEl: HTMLElement | null): void {
    this.tbodyEl = tbodyEl;
  }

  async updateCounts(): Promise<void> {
    const totalCountEl = document.getElementById('total-docs');
    const selectedCountEl = document.getElementById('selected-docs');
    const downloadedCountEl = document.getElementById('downloaded-docs');
    const totalSumEl = document.getElementById('total-sum');

    const visibleRows = this.manager.tbodyEl
      ? Array.from(this.manager.tbodyEl.querySelectorAll<HTMLElement>('tr[data-id]')).filter(
          (row) => row.style.display !== 'none'
        )
      : [];

    let facturasToCount: Documento[];
    let selectedVisibleCount: number;

    if (visibleRows.length > 0 && visibleRows.length < this.manager.dataManager.facturas.length) {
      const visibleIds = new Set(visibleRows.map((row) => row.dataset.id));
      facturasToCount = this.manager.dataManager.facturas.filter((factura) =>
        visibleIds.has(factura.id)
      );
      selectedVisibleCount = Array.from(this.manager.dataManager.selectedFacturas).filter((id) =>
        visibleIds.has(id)
      ).length;
    } else {
      facturasToCount = this.manager.dataManager.facturas;
      selectedVisibleCount = this.manager.dataManager.selectedFacturas.size;
    }

    if (totalCountEl) safeSetText(totalCountEl, facturasToCount.length.toString());
    if (selectedCountEl) safeSetText(selectedCountEl, selectedVisibleCount.toString());
    
    // Obtener contador real de descargas del downloadCounter
    if (downloadedCountEl) {
      try {
        if (typeof (window as any).downloadCounter !== 'undefined') {
          const stats = await (window as any).downloadCounter.getStats();
          safeSetText(downloadedCountEl, stats.count.toString());
        } else {
          safeSetText(downloadedCountEl, '0');
        }
      } catch (error) {
        console.warn('Error obteniendo contador de descargas:', error);
        safeSetText(downloadedCountEl, '0');
      }
    }

    if (totalSumEl) {
      const totalAmount = facturasToCount.reduce((sum, f) => sum + (f.importeTotal || 0), 0);
      safeSetText(totalSumEl, '$' + totalAmount.toFixed(2));
    }
  }

  renderTable(): void {
    if (!this.tbodyEl) {
      console.warn('No se puede renderizar tabla: tbody no encontrado');
      return;
    }

    if (this.manager.dataManager.facturas.length === 0) {
      safeSetHTML(
        this.tbodyEl,
        '<tr class="text-center"><td colspan="8" class="p-8 text-gray-500">Aún no se han analizado los comprobantes. Presione \'Analizar\'.</td></tr>'
      );
      this.renderTotals();
      return;
    }

    const tableHTML = this.manager.dataManager.facturas
      .map((factura, index) => {
        const contador = index + 1;
        const isSelected = this.manager.dataManager.selectedFacturas.has(factura.id);

        return `
      <tr class="${isSelected ? 'selected' : ''}"
            data-id="${factura.id}"
            data-row-index="${index}"
            style="animation: fadeInRow 0.3s ease-out ${index * 0.01}s both;">
          <td class="p-4">
            <input type="checkbox" ${isSelected ? 'checked' : ''} data-id="${factura.id}" class="w-4 h-4 text-pink-600 bg-gray-100 border-gray-300 rounded focus:ring-pink-500">
          </td>
          <td class="px-6 py-3">${contador}</td>
          <td class="px-6 py-3">${factura.numero || ''}</td>
          <td class="px-6 py-3">${factura.ruc || ''}</td>
          <td class="px-6 py-3">${factura.razonSocial || ''}</td>
          <td class="px-6 py-3">${factura.fechaEmision || ''}</td>
          <td class="px-6 py-3 text-right">${(factura.importeTotal || 0).toFixed(2)}</td>
          <td class="px-6 py-3 text-center">${(factura as any).tieneXml ? '✅' : ''}${(factura as any).tienePdf ? ` <span class="pdf-icon cursor-pointer hover:bg-gray-100 p-1 rounded" data-factura-id="${factura.id}" title="Abrir PDF">📄</span>` : ''}${(factura as any).fueVerificado && !(factura as any).tieneXml && !(factura as any).tienePdf ? '❌' : ''}</td>
      </tr>`;
      })
      .join('');

    safeSetHTML(this.tbodyEl, tableHTML);

    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    if (searchInput?.value.trim()) {
      this.manager.handleSearch(searchInput.value);
    }

    this.renderTotals();
  }

  renderTotals(): void {
    const footerEl = document.getElementById('docs-table-footer');
    if (!footerEl) return;

    const facturas = this.manager.dataManager.facturas;

    if (facturas.length === 0) {
      safeSetHTML(footerEl, '');
      return;
    }

    const visibleRows = this.manager.tbodyEl
      ? Array.from(this.manager.tbodyEl.querySelectorAll<HTMLElement>('tr[data-id]')).filter(
          (row) => row.style.display !== 'none'
        )
      : [];

    let facturasToCalculate: Documento[];

    if (visibleRows.length > 0 && visibleRows.length < facturas.length) {
      const visibleIds = new Set(visibleRows.map((row) => row.dataset.id));
      facturasToCalculate = facturas.filter((factura) => visibleIds.has(factura.id));
    } else {
      facturasToCalculate = facturas;
    }

    const totals = facturasToCalculate.reduce(
      (acc, factura) => {
        acc.subtotal += factura.valorSinImpuestos || 0;
        acc.iva += factura.iva || 0;
        acc.total += factura.importeTotal || 0;
        return acc;
      },
      { subtotal: 0, iva: 0, total: 0 }
    );

    const footerHTML = `
      <tr class="border-t border-gray-200">
        <td colspan="6" class="px-6 py-3 text-right text-gray-800"></td>
        <td class="px-6 py-3 text-right text-gray-800">${totals.total.toFixed(2)}</td>
        <td></td>
      </tr>
    `;

    safeSetHTML(footerEl, footerHTML);
  }

  applyTheme(): void {
    const tipoTexto = this.detectDocumentType(this.manager.dataManager.facturas);
    const themeClass = tipoTexto.includes('recibidos') ? 'theme-received' : 'theme-issued';
    document.body.classList.remove('theme-received', 'theme-issued');
    document.body.classList.add(themeClass);
  }

  detectDocumentType(facturas: Documento[]): string {
    if (facturas.length === 0) return 'documentos';

    const tipos = facturas.map((f) => (f.tipoComprobante || '').toLowerCase());
    const facturaCount = tipos.filter((t) => t.includes('factura')).length;
    const retencionCount = tipos.filter((t) => t.includes('retencion')).length;

    if (facturaCount > retencionCount) return 'facturas';
    if (retencionCount > 0) return 'retenciones';
    return 'documentos';
  }
}
