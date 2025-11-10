// Componente de exportación - Migrado a TypeScript

import { VERSION } from '@shared/constants';
import type { Documento } from '@shared/types';
import type { FacturasManager } from '../index';

declare const XLSX: any;

export class ExportComponent {
  constructor(private manager: FacturasManager) {}

  exportSelected(): void {
    if (this.manager.dataManager.selectedFacturas.size === 0) {
      this.manager.showNotification('Selecciona al menos un documento para exportar', 'warning');
      return;
    }

    const facturasSeleccionadas = this.manager.dataManager.facturas.filter((f) =>
      this.manager.dataManager.selectedFacturas.has(f.id)
    );
    this.exportToExcel(facturasSeleccionadas);
  }

  private exportToExcel(facturas: Documento[]): void {
    const tipoTexto = this.manager.tableComponent.detectDocumentType(facturas);

    const data = facturas.map((factura, index) => ({
      Nro: index + 1,
      RUC: factura.ruc || '',
      'Razon Social': factura.razonSocial || '',
      'Tipo Comprobante': factura.tipoComprobante || '',
      Serie: factura.serie || '',
      Numero: factura.numeroComprobante || '',
      'Fecha Emision': factura.fechaEmision || '',
      'Fecha Autorizacion': factura.fechaAutorizacion || '',
      'Clave de Acceso': factura.claveAcceso ? `${factura.claveAcceso}` : '',
      Subtotal: factura.valorSinImpuestos || 0,
      IVA: factura.iva || 0,
      Total: factura.importeTotal || 0,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    ws['!cols'] = [
      { width: 8 },
      { width: 15 },
      { width: 35 },
      { width: 15 },
      { width: 12 },
      { width: 15 },
      { width: 12 },
      { width: 18 },
      { width: 50 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Comprobantes ' + tipoTexto);

    wb.Props = {
      Title: 'Comprobantes Electronicos SRI - ' + tipoTexto,
      Subject: 'Extraccion de Comprobantes SRI',
      Author: 'Acontplus S.A.S.',
      Company: 'Acontplus S.A.S.',
      Comments: `Generado por Acontplus SRI Tools v${VERSION} - Páginas: ${this.manager.dataManager.paginationInfo.current}/${this.manager.dataManager.paginationInfo.total}`,
      CreatedDate: new Date(),
    };

    const fecha = new Date().toISOString().split('T')[0];
    const hora = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
    const paginaInfo =
      this.manager.dataManager.paginationInfo.total > 1
        ? `_Pags${this.manager.dataManager.paginationInfo.current}-${this.manager.dataManager.paginationInfo.total}`
        : '';
    const filename = `Acontplus_SRI_${tipoTexto.charAt(0).toUpperCase() + tipoTexto.slice(1)}_${fecha}_${hora}${paginaInfo}.xlsx`;

    XLSX.writeFile(wb, filename);
  }
}
