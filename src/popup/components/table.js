// Componente de tabla para el popup de Acontplus SRI Tools v1.4.1
// Manejo del renderizado y gestión de la tabla de documentos

class TableComponent {
  constructor(manager) {
    this.manager = manager;
    this.tbodyEl = null;
  }

  initialize(tbodyEl) {
    this.tbodyEl = tbodyEl;
  }

  updateCounts() {
    const totalCountEl = document.getElementById('total-docs');
    const selectedCountEl = document.getElementById('selected-docs');
    const downloadedCountEl = document.getElementById('downloaded-docs');
    const totalSumEl = document.getElementById('total-sum');

    // Get visible rows to calculate counts only for filtered results
    const visibleRows = this.manager.tbodyEl ? 
      Array.from(this.manager.tbodyEl.querySelectorAll('tr[data-id]')).filter(row => row.style.display !== 'none') : 
      [];

    let facturasToCount, selectedVisibleCount;
    
    if (visibleRows.length > 0 && visibleRows.length < this.manager.dataManager.facturas.length) {
      // There's a filter active, use only visible facturas
      const visibleIds = new Set(visibleRows.map(row => row.dataset.id));
      facturasToCount = this.manager.dataManager.facturas.filter(factura => visibleIds.has(factura.id));
      selectedVisibleCount = Array.from(this.manager.dataManager.selectedFacturas).filter(id => visibleIds.has(id)).length;
    } else {
      // No filter or all visible, use all facturas
      facturasToCount = this.manager.dataManager.facturas;
      selectedVisibleCount = this.manager.dataManager.selectedFacturas.size;
    }

    if (totalCountEl) {
      PopupUI.safeSetText(totalCountEl, facturasToCount.length.toString());
    }

    if (selectedCountEl) {
      PopupUI.safeSetText(selectedCountEl, selectedVisibleCount.toString());
    }

    if (downloadedCountEl) {
      PopupUI.safeSetText(downloadedCountEl, '0'); // TODO: track downloaded count
    }

    if (totalSumEl) {
      const totalAmount = facturasToCount.reduce((sum, f) => sum + (f.importeTotal || 0), 0);
      PopupUI.safeSetText(totalSumEl, '$' + totalAmount.toFixed(2));
    }
  }

  renderTable() {
    if (!this.tbodyEl) {
      console.warn('No se puede renderizar tabla: tbody no encontrado');
      return;
    }

    if (this.manager.dataManager.facturas.length === 0) {
      PopupUI.safeSetHTML(this.tbodyEl,
        '<tr class="text-center"><td colspan="8" class="p-8 text-gray-500">Aún no se han analizado los comprobantes. Presione \'Analizar\'.</td></tr>'
      );
      this.renderTotals(); // Also clear totals
      return;
    }

    const tableHTML = this.manager.dataManager.facturas.map((factura, index) => {
      const contador = index + 1;

      return `
      <tr class="${(this.manager.dataManager.selectedFacturas.has(factura.id) ? 'selected' : '')}"
            data-id="${factura.id}"
            data-row-index="${index}"
            style="animation: fadeInRow 0.3s ease-out ${index * 0.01}s both;">
          <td class="p-4">
            <input type="checkbox" ${(this.manager.dataManager.selectedFacturas.has(factura.id) ? 'checked' : '')} data-id="${factura.id}" class="w-4 h-4 text-pink-600 bg-gray-100 border-gray-300 rounded focus:ring-pink-500">
          </td>
          <td class="px-6 py-3">${contador}</td>
          <td class="px-6 py-3">${factura.numero || ''}</td>
          <td class="px-6 py-3">${factura.ruc || ''}</td>
          <td class="px-6 py-3">${factura.razonSocial || ''}</td>
          <td class="px-6 py-3">${factura.fechaEmision || ''}</td>
          <td class="px-6 py-3 text-right">$${(factura.importeTotal || 0).toFixed(2)}</td>
          <td class="px-6 py-3 text-center">${factura.tieneXml ? '✅' : ''}${factura.tienePdf ? ` <span class="pdf-icon cursor-pointer hover:bg-gray-100 p-1 rounded" data-factura-id="${factura.id}" title="Abrir PDF">📄</span>` : ''}${factura.fueVerificado && !factura.tieneXml && !factura.tienePdf ? '❌' : ''}</td>
      </tr>`;
    }).join('');

    PopupUI.safeSetHTML(this.tbodyEl, tableHTML);
    
    // Preserve search filter after rendering
    const searchInput = document.getElementById('search-input');
    if (searchInput && searchInput.value.trim()) {
      this.manager.handleSearch(searchInput.value);
    }
    
    this.renderTotals(); // Render totals after rendering table
  }

  renderTotals() {
    const footerEl = document.getElementById('docs-table-footer');
    if (!footerEl) return;

    const facturas = this.manager.dataManager.facturas;

    if (facturas.length === 0) {
      PopupUI.safeSetHTML(footerEl, '');
      return;
    }

    // Get visible rows to calculate totals only for filtered results
    const visibleRows = this.manager.tbodyEl ? 
      Array.from(this.manager.tbodyEl.querySelectorAll('tr[data-id]')).filter(row => row.style.display !== 'none') : 
      [];

    let facturasToCalculate;
    
    if (visibleRows.length > 0 && visibleRows.length < facturas.length) {
      // There's a filter active, use only visible facturas
      const visibleIds = new Set(visibleRows.map(row => row.dataset.id));
      facturasToCalculate = facturas.filter(factura => visibleIds.has(factura.id));
    } else {
      // No filter or all visible, use all facturas
      facturasToCalculate = facturas;
    }

    const totals = facturasToCalculate.reduce((acc, factura) => {
      acc.subtotal += factura.valorSinImpuestos || 0;
      acc.iva += factura.iva || 0;
      acc.total += factura.importeTotal || 0;
      return acc;
    }, { subtotal: 0, iva: 0, total: 0 });

    const footerHTML = `
      <tr class="border-t border-gray-200">
        <td colspan="6" class="px-6 py-3 text-right text-gray-800"></td>
        <td class="px-6 py-3 text-right text-gray-800">$${totals.total.toFixed(2)}</td>
        <td></td>
      </tr>
    `;

    PopupUI.safeSetHTML(footerEl, footerHTML);
  }

  applyTheme() {
    const tipoTexto = this.detectDocumentType(this.manager.dataManager.facturas);
    const themeClass = tipoTexto.includes('recibidos') ? 'theme-received' : 'theme-issued';
    document.body.classList.remove('theme-received', 'theme-issued');
    document.body.classList.add(themeClass);
  }

  detectDocumentType(facturas) {
    if (facturas.length === 0) return 'documentos';

    const tipos = facturas.map(f => (f.tipoComprobante || '').toLowerCase());
    const facturaCount = tipos.filter(t => t.includes('factura')).length;
    const retencionCount = tipos.filter(t => t.includes('retencion')).length;

    if (facturaCount > retencionCount) return 'facturas';
    if (retencionCount > 0) return 'retenciones';
    return 'documentos';
  }

  convertirTipoDocumento(tipoOriginal) {
    const conversiones = {
      'factura': 'F',
      'comprobante de retencion': 'CR',
      'liquidacion de compra': 'LC',
      'nota de credito': 'NC',
      'nota de debito': 'ND'
    };

    const tipoLower = tipoOriginal.toLowerCase();
    for (const key in conversiones) {
      if (tipoLower.includes(key.split(' ')[0])) {
        return conversiones[key];
      }
    }

    return tipoOriginal.substring(0, 2).toUpperCase();
  }

  getDocumentTypeClass(tipo) {
    const typeMap = {
      'F': 'doc-type-f',
      'CR': 'doc-type-cr',
      'LC': 'doc-type-lc',
      'NC': 'doc-type-nc',
      'ND': 'doc-type-nd'
    };

    return typeMap[tipo] || 'doc-type-f';
  }
}

// Exportar para uso global
window.TableComponent = TableComponent;