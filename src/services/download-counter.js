// Servicio para contar descargas y mostrar modal automáticamente
class DownloadCounter {
    constructor() {
        this.STORAGE_KEY = 'sri_download_count'
        this.FEEDBACK_SENT_KEY = 'sri_feedback_sent'
        this.TRIGGER_COUNT = 4
    }

    async incrementDownload() {
        try {
            console.log('🔍 DownloadCounter: incrementDownload() llamado')
            
            // Verificar si ya envió feedback
            const feedbackSent = await this.hasSentFeedback()
            console.log('📝 Feedback ya enviado:', feedbackSent)
            
            if (feedbackSent) {
                console.log('⏭️ No mostrar modal - feedback ya enviado')
                return false // No mostrar modal si ya envió feedback
            }

            // Obtener contador actual
            const currentCount = await this.getDownloadCount()
            const newCount = currentCount + 1

            // Guardar nuevo contador
            await this.setDownloadCount(newCount)

            console.log(`📊 Descarga #${newCount} registrada (trigger en ${this.TRIGGER_COUNT})`)

            // Verificar si debe mostrar modal
            if (newCount >= this.TRIGGER_COUNT) {
                console.log('🎯 Mostrando modal - se alcanzó el trigger count')
                this.showFeedbackModal()
                return true
            } else {
                console.log(`⏳ Faltan ${this.TRIGGER_COUNT - newCount} descargas para mostrar modal`)
            }

            return false
        } catch (error) {
            console.error('❌ Error incrementando contador de descargas:', error)
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
        console.log('🎯 showFeedbackModal() ejecutado')
        
        try {
            // Verificar si FeedbackModal está disponible
            if (typeof FeedbackModal === 'undefined') {
                console.error('❌ FeedbackModal no está definido')
                return
            }
            
            // Crear modal si no existe
            if (!window.feedbackModal) {
                console.log('🆕 Creando nueva instancia de FeedbackModal')
                window.feedbackModal = new FeedbackModal()
            }
            
            console.log('📱 Mostrando modal de feedback')
            window.feedbackModal.show()
            
            // Agregar mensaje contextual
            setTimeout(() => {
                const modalContent = document.querySelector('.modal-header h3')
                if (modalContent) {
                    modalContent.textContent = '¡Ayúdanos a mejorar! - 4ta descarga completada'
                    console.log('✏️ Título del modal actualizado')
                } else {
                    console.warn('⚠️ No se encontró el título del modal para actualizar')
                }
            }, 100)
            
        } catch (error) {
            console.error('❌ Error mostrando modal de feedback:', error)
        }
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

    // Método para testing - forzar mostrar modal
    async forceShowModal() {
        console.log('🧪 TESTING: Forzando mostrar modal')
        this.showFeedbackModal()
    }

    // Método para testing - simular 4 descargas
    async simulateFourDownloads() {
        console.log('🧪 TESTING: Simulando 4 descargas')
        await this.setDownloadCount(4)
        return await this.incrementDownload()
    }
}

// Instancia global
window.downloadCounter = new DownloadCounter()

// Exportar para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DownloadCounter
}
