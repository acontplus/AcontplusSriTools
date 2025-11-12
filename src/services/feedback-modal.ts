// Feedback Modal - Migrado a TypeScript

export class FeedbackModal {
  private modal: HTMLElement | null = null;
  private form: HTMLFormElement | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    this.createModal();
    this.bindEvents();
  }

  private createModal(): void {
    const modalHTML = `
      <div id="feedbackModal" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Enviar Feedback - Acontplus SRI Extractor</h3>
            <span class="close">&times;</span>
          </div>
          
          <form id="feedbackForm" class="modal-body">
            <div class="form-group">
              <label for="email">Email *</label>
              <input type="email" id="email" required>
            </div>
            
            <div class="form-group">
              <label for="fullName">Nombre Completo *</label>
              <input type="text" id="fullName" required>
            </div>
            
            <div class="form-group">
              <label for="telefono">Teléfono</label>
              <input type="tel" id="telefono" placeholder="+593991234567">
            </div>
            
            <div class="form-group">
              <label for="ruc">RUC *</label>
              <input type="text" id="ruc" required placeholder="0990012345001">
            </div>
            
            <div class="form-group">
              <label for="comentarios">Comentarios *</label>
              <textarea id="comentarios" rows="4" required placeholder="Describe tu experiencia, problemas encontrados o sugerencias..."></textarea>
            </div>
            
            <div class="modal-footer">
              <button type="submit" class="btn-submit">Enviar Feedback</button>
            </div>
          </form>
          
          <div id="loadingState" class="loading" style="display: none;">
            <p>Enviando feedback...</p>
          </div>
          
          <div id="successState" class="success" style="display: none;">
            <p>✅ Feedback enviado correctamente</p>
            <button class="btn-close">Cerrar</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('feedbackModal');
    this.form = document.getElementById('feedbackForm') as HTMLFormElement;
    
    // Asegurar que el modal tenga el z-index más alto posible
    if (this.modal) {
      this.modal.style.zIndex = '2147483647'; // Máximo z-index posible en CSS
    }
  }

  private bindEvents(): void {
    if (!this.modal || !this.form) return;

    const closeBtn = this.modal.querySelector('.close');
    closeBtn?.addEventListener('click', () => this.attemptClose());

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.showCloseWarning();
      }
    });

    this.form.addEventListener('submit', (e) => this.handleSubmit(e));

    this.modal.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('btn-close')) {
        this.hide();
      }
    });

    this.addRealTimeValidation();
  }

  private addRealTimeValidation(): void {
    const email = document.getElementById('email') as HTMLInputElement;
    const fullName = document.getElementById('fullName') as HTMLInputElement;
    const telefono = document.getElementById('telefono') as HTMLInputElement;
    const ruc = document.getElementById('ruc') as HTMLInputElement;
    const comentarios = document.getElementById('comentarios') as HTMLTextAreaElement;

    email?.addEventListener('blur', () => this.validateField('email'));
    fullName?.addEventListener('blur', () => this.validateField('fullName'));
    telefono?.addEventListener('blur', () => this.validateField('telefono'));
    ruc?.addEventListener('blur', () => this.validateField('ruc'));
    comentarios?.addEventListener('input', () => this.validateField('comentarios'));
  }

  private validateField(fieldName: string): void {
    const field = document.getElementById(fieldName) as HTMLInputElement | HTMLTextAreaElement;
    if (!field) return;

    const value = field.value.trim();
    let isValid = true;
    let message = '';

    switch (fieldName) {
      case 'email':
        if (value && !this.isValidEmail(value)) {
          isValid = false;
          message = 'Email inválido';
        }
        break;
      case 'fullName':
        if (value && !this.isValidFullName(value)) {
          isValid = false;
          message = 'Ingresa nombre y apellido';
        }
        break;
      case 'telefono':
        if (value && !this.isValidEcuadorianPhone(value)) {
          isValid = false;
          message = 'Formato: +593991234567';
        }
        break;
      case 'ruc':
        if (value && !this.isValidEcuadorianRUC(value)) {
          isValid = false;
          message = 'RUC inválido';
        }
        break;
      case 'comentarios':
        if (value && value.length < 10) {
          isValid = false;
          message = `Mínimo 10 caracteres (${value.length}/10)`;
        }
        break;
    }

    this.showFieldError(field, isValid, message);
  }

  private showFieldError(
    field: HTMLInputElement | HTMLTextAreaElement,
    isValid: boolean,
    message: string
  ): void {
    const existingError = field.parentNode?.querySelector('.field-error');
    existingError?.remove();

    if (isValid) {
      field.style.borderColor = '#28a745';
    } else {
      field.style.borderColor = '#dc3545';

      const errorSpan = document.createElement('span');
      errorSpan.className = 'field-error';
      errorSpan.style.cssText =
        'color: #dc3545; font-size: 12px; margin-top: 4px; display: block;';
      errorSpan.textContent = message;
      field.parentNode?.appendChild(errorSpan);
    }
  }

  private attemptClose(): void {
    this.showCloseWarning();
  }

  private showCloseWarning(): void {
    alert(
      '⚠️ Para continuar usando la extensión, necesitamos tu feedback. Por favor completa el formulario.'
    );
  }

  show(): void {
    if (this.modal) {
      this.modal.style.display = 'block';
      this.resetForm();
    }
  }

  hide(): void {
    if (this.modal) {
      this.modal.style.display = 'none';
    }
  }

  private resetForm(): void {
    if (!this.form) return;

    this.form.style.display = 'block';
    const loadingState = document.getElementById('loadingState');
    const successState = document.getElementById('successState');

    if (loadingState) loadingState.style.display = 'none';
    if (successState) successState.style.display = 'none';

    this.form.reset();

    const errorDiv = document.getElementById('form-error');
    errorDiv?.remove();
  }

  private validateForm(): boolean {
    const email = (document.getElementById('email') as HTMLInputElement).value.trim();
    const fullName = (document.getElementById('fullName') as HTMLInputElement).value.trim();
    const telefono = (document.getElementById('telefono') as HTMLInputElement).value.trim();
    const ruc = (document.getElementById('ruc') as HTMLInputElement).value.trim();
    const comentarios = (
      document.getElementById('comentarios') as HTMLTextAreaElement
    ).value.trim();

    if (!this.isValidEmail(email)) {
      this.showError('Por favor ingresa un email válido');
      return false;
    }

    if (!this.isValidFullName(fullName)) {
      this.showError('Por favor ingresa tu nombre completo (nombre y apellido)');
      return false;
    }

    if (telefono && !this.isValidEcuadorianPhone(telefono)) {
      this.showError('Formato de teléfono inválido. Usa: +593991234567 o 0991234567');
      return false;
    }

    if (!this.isValidEcuadorianRUC(ruc)) {
      this.showError('RUC inválido. Debe tener 13 dígitos y ser válido');
      return false;
    }

    if (comentarios.length < 10) {
      this.showError('Los comentarios deben tener al menos 10 caracteres');
      return false;
    }

    return true;
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private isValidFullName(name: string): boolean {
    return name.split(' ').filter((word) => word.length > 0).length >= 2;
  }

  private isValidEcuadorianPhone(phone: string): boolean {
    const cleaned = phone.replace(/[\s\-()]/g, '');
    return /^(\+593|0)?[9][0-9]{8}$/.test(cleaned);
  }

  private isValidEcuadorianRUC(ruc: string): boolean {
    if (!/^\d{13}$/.test(ruc)) return false;

    const digits = ruc.split('').map(Number);
    const province = parseInt(ruc.substring(0, 2));

    if (province < 1 || province > 24) return false;

    const thirdDigit = digits[2];
    if (thirdDigit < 0 || thirdDigit > 9) return false;

    return true;
  }

  private showError(message: string): void {
    if (!this.form) return;

    let errorDiv = document.getElementById('form-error');
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.id = 'form-error';
      errorDiv.style.cssText =
        'color: #dc3545; background: #f8d7da; border: 1px solid #f5c6cb; padding: 8px; border-radius: 4px; margin-bottom: 15px; font-size: 14px;';
      this.form.insertBefore(errorDiv, this.form.firstChild);
    }
    errorDiv.textContent = message;

    setTimeout(() => {
      errorDiv?.remove();
    }, 5000);
  }

  private async handleSubmit(e: Event): Promise<void> {
    e.preventDefault();

    if (!this.validateForm()) {
      return;
    }

    if (!this.form) return;

    this.form.style.display = 'none';
    const loadingState = document.getElementById('loadingState');
    if (loadingState) loadingState.style.display = 'block';

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = await (window as any).initSupabase();
      if (!supabase) {
        throw new Error('No se pudo inicializar Supabase');
      }

      const payload = {
        p_email: (document.getElementById('email') as HTMLInputElement).value,
        p_full_name: (document.getElementById('fullName') as HTMLInputElement).value,
        p_telefono: (document.getElementById('telefono') as HTMLInputElement).value || null,
        p_ruc: (document.getElementById('ruc') as HTMLInputElement).value || null,
        p_comentarios: (document.getElementById('comentarios') as HTMLTextAreaElement).value,
        p_extension_instance_id: this.generateInstanceId(),
        p_extension_version: chrome.runtime.getManifest().version,
        p_detected_types: await this.getDetectedTypes(),
        p_scan_timestamp: new Date().toISOString(),
        p_metadata: {
          user_agent: navigator.userAgent,
          platform: navigator.platform,
          url: window.location.href,
        },
      };

      const { error } = await supabase.rpc('insert_feedback_with_user', payload);

      if (error) {
        throw error;
      }

      if (loadingState) loadingState.style.display = 'none';
      const successState = document.getElementById('successState');
      if (successState) successState.style.display = 'block';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).downloadCounter) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (window as any).downloadCounter.markFeedbackSent();
      }
    } catch (error) {
      console.error('Error enviando feedback:', error);

      if (loadingState) loadingState.style.display = 'none';
      if (this.form) this.form.style.display = 'block';

      alert('Error enviando feedback. Por favor intenta nuevamente.');
    }
  }

  private generateInstanceId(): string {
    let instanceId = localStorage.getItem('sri_extension_instance_id');
    if (!instanceId) {
      instanceId =
        'inst_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
      localStorage.setItem('sri_extension_instance_id', instanceId);
    }
    return instanceId;
  }

  private getDetectedTypes(): Promise<string[]> {
    return new Promise((resolve) => {
      chrome.storage.local.get(['lastDetectedTypes'], (result) => {
        resolve(result.lastDetectedTypes || ['invoice']);
      });
    });
  }
}

// Exportar globalmente
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).FeedbackModal = FeedbackModal;
}
