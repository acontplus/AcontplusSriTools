// Servicio para contar descargas - Migrado a TypeScript

export class DownloadCounter {
  private readonly STORAGE_KEY = 'sri_download_count';
  private readonly FEEDBACK_SENT_KEY = 'sri_feedback_sent';
  private readonly TRIGGER_COUNT = 4;

  async incrementDownload(): Promise<boolean> {
    try {
      const feedbackSent = await this.hasSentFeedback();
      if (feedbackSent) return false;

      const currentCount = await this.getDownloadCount();
      const newCount = currentCount + 1;

      await this.setDownloadCount(newCount);

      if (newCount >= this.TRIGGER_COUNT) {
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
    try {
      if (typeof (window as any).FeedbackModal === 'undefined') {
        console.error('❌ FeedbackModal no está definido');
        return;
      }

      if (!(window as any).feedbackModal) {
        (window as any).feedbackModal = new (window as any).FeedbackModal();
      }

      (window as any).feedbackModal.show();

      setTimeout(() => {
        const modalContent = document.querySelector('.modal-header h3');
        if (modalContent) {
          modalContent.textContent = '¡Ayúdanos a mejorar! - 4ta descarga completada';
        }
      }, 100);
    } catch (error) {
      console.error('❌ Error mostrando modal de feedback:', error);
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
