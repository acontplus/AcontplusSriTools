// Servicio para contar descargas y mostrar modal automáticamente
class DownloadCounter {
    constructor() {
        this.STORAGE_KEY = 'sri_download_count'
        this.FEEDBACK_SENT_KEY = 'sri_feedback_sent'
        this.TRIGGER_COUNT = 4
    }

    async incrementDownload() {
        try {
            // Verificar si ya envió feedback
            const feedbackSent = await this.hasSentFeedback()
            if (feedbackSent) {
                return false // No mostrar modal si ya envió feedback
            }

            // Obtener contador actual
            const currentCount = await this.getDownloadCount()
            const newCount = currentCount + 1

            // Guardar nuevo contador
            await this.setDownloadCount(newCount)

            console.log(`📊 Descarga #${newCount} registrada`)

            // Verificar si debe mostrar modal
            if (newCount >= this.TRIGGER_COUNT) {
                this.showFeedbackModal()
                return true
            }

            return false
        } catch (error) {
            console.error('Error incrementando contador de descargas:', error)
            return false
        }
    }

    async getDownloadCount() {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.STORAGE_KEY], (result) => {
                resolve(result[this.STORAGE_KEY] || 0)
            })
        })
    }

    async setDownloadCount(count) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.STORAGE_KEY]: count }, resolve)
        })
    }

    async hasSentFeedback() {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.FEEDBACK_SENT_KEY], (result) => {
                resolve(!!result[this.FEEDBACK_SENT_KEY])
            })
        })
    }

    async markFeedbackSent() {
        return new Promise((resolve) => {
            chrome.storage.local.set({ 
                [this.FEEDBACK_SENT_KEY]: true,
                [this.STORAGE_KEY + '_sent_at']: new Date().toISOString()
            }, resolve)
        })
    }

    showFeedbackModal() {
        console.log('🎯 Mostrando modal de feedback automáticamente (4ta descarga)')
        
        // Crear modal si no existe
        if (!window.feedbackModal) {
            window.feedbackModal = new FeedbackModal()
        }
        
        // Mostrar modal con mensaje especial
        window.feedbackModal.show()
        
        // Agregar mensaje contextual
        setTimeout(() => {
            const modalContent = document.querySelector('.modal-header h3')
            if (modalContent) {
                modalContent.textContent = '¡Ayúdanos a mejorar! - 4ta descarga completada'
            }
        }, 100)
    }

    async resetCounter() {
        // Método para desarrollo/testing
        await chrome.storage.local.remove([this.STORAGE_KEY, this.FEEDBACK_SENT_KEY])
        console.log('🔄 Contador de descargas reiniciado')
    }

    async getStats() {
        const count = await this.getDownloadCount()
        const feedbackSent = await this.hasSentFeedback()
        return { count, feedbackSent, triggerCount: this.TRIGGER_COUNT }
    }
}

// Instancia global
window.downloadCounter = new DownloadCounter()

// Exportar para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DownloadCounter
}
