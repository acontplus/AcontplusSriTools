// Servicio para contar descargas - Migrado a TypeScript

export class DownloadCounter {
  private readonly STORAGE_KEY = 'sri_download_count';
  private readonly FEEDBACK_SENT_KEY = 'sri_feedback_sent';
  private readonly TRIGGER_COUNT = 4;

  async incrementDownload(): Promise<boolean> {
    try {
      const feedbackSent = await this.hasSentFeedback();
      if (feedbackSent) {
        console.log('✅ Feedback ya fue enviado, no se incrementa contador');
        return false;
      }

      const currentCount = await this.getDownloadCount();
      const newCount = currentCount + 1;

      await this.setDownloadCount(newCount);
      console.log(`📊 Contador de descargas: ${newCount}/${this.TRIGGER_COUNT}`);

      if (newCount >= this.TRIGGER_COUNT) {
        console.log('🎉 ¡4ta descarga alcanzada! Mostrando modal...');
        this.showFeedbackModal();
        return true;
      } else {
        console.log(`⏳ Faltan ${this.TRIGGER_COUNT - newCount} descargas para mostrar modal`);
      }

      return false;
    } catch (error) {
      console.error('❌ Error incrementando contador de descargas:', error);
      return false;
    }
  }

  async getDownloadCount(): Promise<number> {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_KEY], (result) => {
        resolve(result[this.STORAGE_KEY] || 0);
      });
    });
  }

  async setDownloadCount(count: number): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.STORAGE_KEY]: count }, resolve);
    });
  }

  async hasSentFeedback(): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.FEEDBACK_SENT_KEY], (result) => {
        resolve(!!result[this.FEEDBACK_SENT_KEY]);
      });
    });
  }

  async markFeedbackSent(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set(
        {
          [this.FEEDBACK_SENT_KEY]: true,
          [this.STORAGE_KEY + '_sent_at']: new Date().toISOString(),
        },
        resolve
      );
    });
  }

  private showFeedbackModal(): void {
    console.log('🎯 Intentando mostrar modal de feedback...');
    
    try {
      // Verificar si FeedbackModal está disponible
      if (typeof (window as any).FeedbackModal === 'undefined') {
        console.error('❌ FeedbackModal no está definido en window');
        console.log('📋 Propiedades disponibles en window:', Object.keys(window).filter(k => k.includes('Feedback') || k.includes('feedback')));
        return;
      }

      console.log('✅ FeedbackModal encontrado');

      // Crear instancia si no existe
      if (!(window as any).feedbackModal) {
        console.log('🔧 Creando nueva instancia de FeedbackModal');
        (window as any).feedbackModal = new (window as any).FeedbackModal();
      }

      console.log('📢 Mostrando modal...');
      (window as any).feedbackModal.show();

      // Actualizar título después de un momento
      setTimeout(() => {
        const modalContent = document.querySelector('.modal-header h3');
        if (modalContent) {
          modalContent.textContent = '¡Ayúdanos a mejorar! - 4ta descarga completada';
          console.log('✅ Título del modal actualizado');
        } else {
          console.warn('⚠️ No se encontró el elemento .modal-header h3');
        }
      }, 100);
    } catch (error) {
      console.error('❌ Error mostrando modal de feedback:', error);
      console.error('Stack trace:', error);
    }
  }

  async resetCounter(): Promise<void> {
    await chrome.storage.local.remove([this.STORAGE_KEY, this.FEEDBACK_SENT_KEY]);
  }

  async getStats(): Promise<{ count: number; feedbackSent: boolean; triggerCount: number }> {
    const count = await this.getDownloadCount();
    const feedbackSent = await this.hasSentFeedback();
    return { count, feedbackSent, triggerCount: this.TRIGGER_COUNT };
  }

  async forceShowModal(): Promise<void> {
    this.showFeedbackModal();
  }

  async simulateFourDownloads(): Promise<boolean> {
    console.log('🧪 TESTING: Simulando 4 descargas');
    await this.setDownloadCount(4);
    return await this.incrementDownload();
  }
}

// Instancia global
if (typeof window !== 'undefined') {
  (window as any).downloadCounter = new DownloadCounter();
  (window as any).DownloadCounter = DownloadCounter;
}
