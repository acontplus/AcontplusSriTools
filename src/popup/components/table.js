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

    if (totalCountEl) {
      PopupUI.safeSetText(totalCountEl, this.manager.dataManager.facturas.length.toString());
    }

    if (selectedCountEl) {
      PopupUI.safeSetText(selectedCountEl, this.manager.dataManager.selectedFacturas.size.toString());
    }

    if (downloadedCountEl) {
      PopupUI.safeSetText(downloadedCountEl, '0'); // TODO: track downloaded count
    }

    if (totalSumEl) {
      const totalAmount = this.manager.dataManager.facturas.reduce((sum, f) => sum + (f.importeTotal || 0), 0);
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
          <td class="px-6 py-3 text-right">$${(factura.valorSinImpuestos || 0).toFixed(2)}</td>
          <td class="px-6 py-3 text-right">$${(factura.iva || 0).toFixed(2)}</td>
          <td class="px-6 py-3 text-right">$${(factura.importeTotal || 0).toFixed(2)}</td>
          <td class="px-6 py-3 text-center" data-verified-id="${factura.id}">${factura.verificado === true ? '✔️' : (factura.verificado === false ? '❌' : '')}</td>
      </tr>`;
    }).join('');

    PopupUI.safeSetHTML(this.tbodyEl, tableHTML);

    const totalSubtotal = this.manager.dataManager.facturas.reduce((sum, f) => sum + (f.valorSinImpuestos || 0), 0);
    const totalIva = this.manager.dataManager.facturas.reduce((sum, f) => sum + (f.iva || 0), 0);
    const totalAmount = this.manager.dataManager.facturas.reduce((sum, f) => sum + (f.importeTotal || 0), 0);

    const totalSubtotalEl = document.getElementById('total-subtotal');
    if (totalSubtotalEl) PopupUI.safeSetText(totalSubtotalEl, '$' + totalSubtotal.toFixed(2));

    const totalIvaEl = document.getElementById('total-iva');
    if (totalIvaEl) PopupUI.safeSetText(totalIvaEl, '$' + totalIva.toFixed(2));

    const totalAmountEl = document.getElementById('total-amount');
    if (totalAmountEl) PopupUI.safeSetText(totalAmountEl, '$' + totalAmount.toFixed(2));

    const totalsEl = document.getElementById('facturas-totals');
    if (totalsEl) totalsEl.style.display = this.manager.dataManager.facturas.length > 0 ? 'table-footer-group' : 'none';
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