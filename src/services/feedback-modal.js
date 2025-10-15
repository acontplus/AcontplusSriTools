import { supabase } from './supabase-config.js'

class FeedbackModal {
    constructor() {
        this.modal = null
        this.form = null
        this.init()
    }

    init() {
        this.createModal()
        this.bindEvents()
    }

    createModal() {
        // Crear el modal en el DOM
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
                            <label for="ruc">RUC</label>
                            <input type="text" id="ruc" placeholder="0990012345001">
                        </div>
                        
                        <div class="form-group">
                            <label for="comentarios">Comentarios *</label>
                            <textarea id="comentarios" rows="4" required placeholder="Describe tu experiencia, problemas encontrados o sugerencias..."></textarea>
                        </div>
                        
                        <div class="modal-footer">
                            <button type="button" class="btn-cancel">Cancelar</button>
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
        `
        
        document.body.insertAdjacentHTML('beforeend', modalHTML)
        this.modal = document.getElementById('feedbackModal')
        this.form = document.getElementById('feedbackForm')
    }

    bindEvents() {
        // Cerrar modal
        const closeBtn = this.modal.querySelector('.close')
        const cancelBtn = this.modal.querySelector('.btn-cancel')
        
        closeBtn.addEventListener('click', () => this.hide())
        cancelBtn.addEventListener('click', () => this.hide())
        
        // Cerrar al hacer click fuera del modal
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.hide()
        })

        // Submit del formulario
        this.form.addEventListener('submit', (e) => this.handleSubmit(e))
        
        // Botón cerrar en estado de éxito
        this.modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-close')) {
                this.hide()
            }
        })
    }

    show() {
        this.modal.style.display = 'block'
        this.resetForm()
    }

    hide() {
        this.modal.style.display = 'none'
    }

    resetForm() {
        this.form.style.display = 'block'
        document.getElementById('loadingState').style.display = 'none'
        document.getElementById('successState').style.display = 'none'
        this.form.reset()
    }

    async handleSubmit(e) {
        e.preventDefault()
        
        // Mostrar loading
        this.form.style.display = 'none'
        document.getElementById('loadingState').style.display = 'block'

        try {
            // Recopilar datos del formulario
            const formData = new FormData(this.form)
            const payload = {
                p_email: document.getElementById('email').value,
                p_full_name: document.getElementById('fullName').value,
                p_telefono: document.getElementById('telefono').value || null,
                p_ruc: document.getElementById('ruc').value || null,
                p_comentarios: document.getElementById('comentarios').value,
                p_extension_instance_id: this.generateInstanceId(),
                p_extension_version: chrome.runtime.getManifest().version,
                p_detected_types: this.getDetectedTypes(),
                p_scan_timestamp: new Date().toISOString(),
                p_metadata: {
                    user_agent: navigator.userAgent,
                    platform: navigator.platform,
                    url: window.location.href
                }
            }

            // Enviar a Supabase
            const { data, error } = await supabase.rpc('insert_feedback_with_user', payload)

            if (error) {
                throw error
            }

            // Mostrar éxito
            document.getElementById('loadingState').style.display = 'none'
            document.getElementById('successState').style.display = 'block'
            
            console.log('Feedback enviado correctamente, ID:', data)

        } catch (error) {
            console.error('Error enviando feedback:', error)
            
            // Volver al formulario y mostrar error
            document.getElementById('loadingState').style.display = 'none'
            this.form.style.display = 'block'
            
            alert('Error enviando feedback. Por favor intenta nuevamente.')
        }
    }

    generateInstanceId() {
        // Generar un ID único para esta instancia de la extensión
        let instanceId = localStorage.getItem('sri_extension_instance_id')
        if (!instanceId) {
            instanceId = 'inst_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
            localStorage.setItem('sri_extension_instance_id', instanceId)
        }
        return instanceId
    }

    getDetectedTypes() {
        // Obtener tipos de documentos detectados desde el storage de la extensión
        return new Promise((resolve) => {
            chrome.storage.local.get(['lastDetectedTypes'], (result) => {
                resolve(result.lastDetectedTypes || ['invoice'])
            })
        })
    }
}

// Exportar para uso global
window.FeedbackModal = FeedbackModal
