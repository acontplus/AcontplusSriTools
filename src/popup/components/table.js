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
    const totalCountEl = document.getElementById('total-count');
    const selectedCountEl = document.getElementById('selected-count');

    if (totalCountEl) {
      PopupUI.safeSetText(totalCountEl, this.manager.dataManager.facturas.length.toString());
    }

    if (selectedCountEl) {
      PopupUI.safeSetText(selectedCountEl, this.manager.dataManager.selectedFacturas.size.toString());
    }
  }

  renderTable() {
    if (!this.tbodyEl) {
      console.warn('No se puede renderizar tabla: tbody no encontrado');
      return;
    }

    if (this.manager.dataManager.facturas.length === 0) {
      PopupUI.safeSetHTML(this.tbodyEl,
        '<tr>' +
          '<td colspan="13" class="text-center text-muted" style="padding: 40px;">' +
            '<div style="color: #D61672; font-size: 24px; margin-bottom: 8px;">📄</div>' +
            '<div style="font-weight: 600; margin-bottom: 4px;">No se encontraron documentos electronicos</div>' +
            '<div style="font-size: 11px; color: #6c757d;">Utiliza "Buscar" para analizar todas las paginas disponibles</div>' +
          '</td>' +
        '</tr>'
      );
      return;
    }

    const tableHTML = this.manager.dataManager.facturas.map((factura, index) => {
      const contador = index + 1;

      return `<tr class="${(this.manager.dataManager.selectedFacturas.has(factura.id) ? 'selected' : '')}"
            data-id="${factura.id}"
            data-row-index="${index}"
            style="animation: fadeInRow 0.3s ease-out ${index * 0.01}s both;">
          <td class="checkbox-col">
            <input type="checkbox" ${(this.manager.dataManager.selectedFacturas.has(factura.id) ? 'checked' : '')} data-id="${factura.id}">
          </td>
          <td class="counter-col">${contador}</td>
          <td class="tipo-col">${factura.tipoComprobante || ''}</td>
          <td class="numero-col">${factura.numero || ''}</td>
          <td class="ruc-col">${factura.ruc || ''}</td>
          <td class="razon-col">${factura.razonSocial || ''}</td>
          <td class="fecha-col">${factura.fechaEmision || ''}</td>
          <td class="fecha-auth-col">${factura.fechaAutorizacion || ''}</td>
          <td class="clave-acceso-col">${factura.claveAcceso || ''}</td>
          <td class="subtotal-col">$${(factura.valorSinImpuestos || 0).toFixed(2)}</td>
          <td class="iva-col">$${(factura.iva || 0).toFixed(2)}</td>
          <td class="amount-col">$${(factura.importeTotal || 0).toFixed(2)}</td>
          <td class="verificado-col" data-verified-id="${factura.id}"></td>
        </tr>`;
    }).join('');

    PopupUI.safeSetHTML(this.tbodyEl, tableHTML);

    const totalAmount = this.manager.dataManager.facturas.reduce((sum, f) => sum + (f.importeTotal || 0), 0);
    const totalAmountEl = document.querySelector('.total-amount');
    if (totalAmountEl) {
      PopupUI.safeSetText(totalAmountEl, '$' + totalAmount.toFixed(2));
    }

    const totalsEl = document.getElementById('facturas-totals');
    if (totalsEl) {
      totalsEl.style.display = this.manager.dataManager.facturas.length > 0 ? 'table-footer-group' : 'none';
    }
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