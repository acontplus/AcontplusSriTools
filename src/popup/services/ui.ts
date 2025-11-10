// Servicios de UI - Migrado a TypeScript

import { safeGetElement, safeSetText, safeSetHTML } from '@shared/utils';

export class PopupUI {
  static safeGetElement = safeGetElement;
  static safeSetText = safeSetText;
  static safeSetHTML = safeSetHTML;

  static showState(
    states: { loading: HTMLElement | null; table: HTMLElement | null; 'no-data': HTMLElement | null },
    state: 'loading' | 'table' | 'no-data'
  ): void {
    Object.values(states).forEach((el) => {
      if (el) el.style.display = 'none';
    });

    const targetEl = states[state];
    if (targetEl) {
      targetEl.style.display = state === 'table' ? 'flex' : 'block';
    }
  }

  static formatTimestamp(date: Date): string {
    return date.toLocaleString('es-EC', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  static initializeBrandIdentity(version: string): void {
    document.title = `Acontplus SRI Tools v${version}`;

    const versionElements = document.querySelectorAll('.version-number, .tagline');
    versionElements.forEach((el) => {
      if (el.textContent?.includes('v1.')) {
        safeSetText(el as HTMLElement, el.textContent.replace(/v1\.\d+\.\d+.*/, `v${version}`));
      }
    });

    const extractionTimestamp = document.getElementById('extraction-timestamp');
    if (extractionTimestamp) {
      safeSetText(extractionTimestamp, this.formatTimestamp(new Date()));
    }
  }

  static disableButtonsForOperation(additionalSelectors: string[] = []): void {
    const operationButtons = ['#start-process'];
    const selectionDependentButtons = [
      '#download-btn',
      '[data-action="export_excel"]',
      '[data-action="verificar_descargas"]',
    ];

    const targetSelectors = [...operationButtons, ...selectionDependentButtons, ...additionalSelectors];

    targetSelectors.forEach((selector) => {
      const buttons = document.querySelectorAll<HTMLButtonElement>(selector);
      buttons.forEach((button) => {
        button.disabled = true;
        button.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
      });
    });
  }

  static enableButtonsAfterOperation(hasSelections: boolean = false): void {
    const operationButtons = ['#start-process'];
    operationButtons.forEach((selector) => {
      const buttons = document.querySelectorAll<HTMLButtonElement>(selector);
      buttons.forEach((button) => {
        button.disabled = false;
        button.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
      });
    });

    const selectionButtons = [
      '#download-btn',
      '[data-action="export_excel"]',
      '[data-action="verificar_descargas"]',
    ];
    selectionButtons.forEach((selector) => {
      const buttons = document.querySelectorAll<HTMLButtonElement>(selector);
      buttons.forEach((button) => {
        if (hasSelections) {
          button.disabled = false;
          button.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
        } else {
          button.disabled = true;
          button.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
        }
      });
    });
  }

  static updateSelectionDependentButtons(hasSelections: boolean): void {
    const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;
    if (downloadBtn) {
      downloadBtn.disabled = !hasSelections;
      if (hasSelections) {
        downloadBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
      } else {
        downloadBtn.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
      }
    }

    const exportExcelBtn = document.querySelector<HTMLButtonElement>('[data-action="export_excel"]');
    if (exportExcelBtn) {
      if (hasSelections) {
        exportExcelBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
        exportExcelBtn.removeAttribute('disabled');
      } else {
        exportExcelBtn.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
        exportExcelBtn.setAttribute('disabled', 'true');
      }
    }

    const verificarDescargasBtn = document.querySelector<HTMLButtonElement>(
      '[data-action="verificar_descargas"]'
    );
    if (verificarDescargasBtn) {
      if (hasSelections) {
        verificarDescargasBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
        verificarDescargasBtn.removeAttribute('disabled');
      } else {
        verificarDescargasBtn.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
        verificarDescargasBtn.setAttribute('disabled', 'true');
      }
    }
  }
}
