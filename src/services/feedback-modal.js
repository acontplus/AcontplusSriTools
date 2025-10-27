// Feedback Modal - Sin imports, usando Supabase global

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
                        <p> Feedback enviado correctamente</p>
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
        // Solo permitir cerrar si el feedback fue enviado exitosamente
        const closeBtn = this.modal.querySelector('.close')
        
        closeBtn.addEventListener('click', () => this.attemptClose())
        
        // Prevenir cerrar al hacer click fuera del modal
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.showCloseWarning()
            }
        })

        // Submit del formulario
        this.form.addEventListener('submit', (e) => this.handleSubmit(e))
        
        // Botón cerrar en estado de éxito (este sí permite cerrar)
        this.modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-close')) {
                this.hide()
            }
        })

        // Validación en tiempo real
        this.addRealTimeValidation()
    }

    addRealTimeValidation() {
        const email = document.getElementById('email')
        const fullName = document.getElementById('fullName')
        const telefono = document.getElementById('telefono')
        const ruc = document.getElementById('ruc')
        const comentarios = document.getElementById('comentarios')

        email.addEventListener('blur', () => this.validateField('email'))
        fullName.addEventListener('blur', () => this.validateField('fullName'))
        telefono.addEventListener('blur', () => this.validateField('telefono'))
        ruc.addEventListener('blur', () => this.validateField('ruc'))
        comentarios.addEventListener('input', () => this.validateField('comentarios'))
    }

    validateField(fieldName) {
        const field = document.getElementById(fieldName)
        const value = field.value.trim()
        let isValid = true
        let message = ''

        switch (fieldName) {
            case 'email':
                if (value && !this.isValidEmail(value)) {
                    isValid = false
                    message = 'Email inválido'
                }
                break
            case 'fullName':
                if (value && !this.isValidFullName(value)) {
                    isValid = false
                    message = 'Ingresa nombre y apellido'
                }
                break
            case 'telefono':
                if (value && !this.isValidEcuadorianPhone(value)) {
                    isValid = false
                    message = 'Formato: +593991234567'
                }
                break
            case 'ruc':
                if (value && !this.isValidEcuadorianRUC(value)) {
                    isValid = false
                    message = 'RUC inválido'
                }
                break
            case 'comentarios':
                if (value && value.length < 10) {
                    isValid = false
                    message = `Mínimo 10 caracteres (${value.length}/10)`
                }
                break
        }

        this.showFieldError(field, isValid, message)
    }

    showFieldError(field, isValid, message) {
        // Remover error previo
        const existingError = field.parentNode.querySelector('.field-error')
        if (existingError) existingError.remove()

        // Cambiar estilo del campo
        if (isValid) {
            field.style.borderColor = '#28a745'
        } else {
            field.style.borderColor = '#dc3545'
            
            // Agregar mensaje de error
            const errorSpan = document.createElement('span')
            errorSpan.className = 'field-error'
            errorSpan.style.cssText = 'color: #dc3545; font-size: 12px; margin-top: 4px; display: block;'
            errorSpan.textContent = message
            field.parentNode.appendChild(errorSpan)
        }
    }

    attemptClose() {
        this.showCloseWarning()
    }

    showCloseWarning() {
        alert('⚠️ Para continuar usando la extensión, necesitamos tu feedback. Por favor completa el formulario.')
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
        
        // Limpiar errores
        const errorDiv = document.getElementById('form-error')
        if (errorDiv) errorDiv.remove()
    }

    validateForm() {
        const email = document.getElementById('email').value.trim()
        const fullName = document.getElementById('fullName').value.trim()
        const telefono = document.getElementById('telefono').value.trim()
        const ruc = document.getElementById('ruc').value.trim()
        const comentarios = document.getElementById('comentarios').value.trim()

        // Email válido (obligatorio)
        if (!this.isValidEmail(email)) {
            this.showError('Por favor ingresa un email válido')
            return false
        }

        // Nombre completo (obligatorio, mínimo 2 palabras)
        if (!this.isValidFullName(fullName)) {
            this.showError('Por favor ingresa tu nombre completo (nombre y apellido)')
            return false
        }

        // Teléfono ecuatoriano (opcional pero si se ingresa debe ser válido)
        if (telefono && !this.isValidEcuadorianPhone(telefono)) {
            this.showError('Formato de teléfono inválido. Usa: +593991234567 o 0991234567')
            return false
        }

        // RUC ecuatoriano (obligatorio)
        if (!this.isValidEcuadorianRUC(ruc)) {
            this.showError('RUC inválido. Debe tener 13 dígitos y ser válido')
            return false
        }

        // Comentarios mínimo 10 caracteres (obligatorio)
        if (comentarios.length < 10) {
            this.showError('Los comentarios deben tener al menos 10 caracteres')
            return false
        }

        return true
    }

    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    }

    isValidFullName(name) {
        return name.split(' ').filter(word => word.length > 0).length >= 2
    }

    isValidEcuadorianPhone(phone) {
        // Formatos: +593991234567, 0991234567, 991234567
        const cleaned = phone.replace(/[\s\-\(\)]/g, '')
        return /^(\+593|0)?[9][0-9]{8}$/.test(cleaned)
    }

    isValidEcuadorianRUC(ruc) {
        // Para propósitos de validación en el feedback modal, aceptamos cualquier RUC de 13 dígitos
        // con provincia válida (01-24) y tercer dígito válido (0-9)
        if (!/^\d{13}$/.test(ruc)) return false

        const digits = ruc.split('').map(Number)
        const province = parseInt(ruc.substring(0, 2))

        if (province < 1 || province > 24) return false

        const thirdDigit = digits[2]
        // Para RUC: 0-5 para personas naturales, 6 para entidades públicas, 9 para sociedades privadas
        if (thirdDigit < 0 || thirdDigit > 9) return false

        // Simplificamos la validación - solo verificamos formato básico
        // El algoritmo completo puede variar según el tipo de RUC
        return true
    }

    showError(message) {
        // Crear o actualizar mensaje de error
        let errorDiv = document.getElementById('form-error')
        if (!errorDiv) {
            errorDiv = document.createElement('div')
            errorDiv.id = 'form-error'
            errorDiv.style.cssText = 'color: #dc3545; background: #f8d7da; border: 1px solid #f5c6cb; padding: 8px; border-radius: 4px; margin-bottom: 15px; font-size: 14px;'
            this.form.insertBefore(errorDiv, this.form.firstChild)
        }
        errorDiv.textContent = message
        
        // Auto-ocultar después de 5 segundos
        setTimeout(() => {
            if (errorDiv) errorDiv.remove()
        }, 5000)
    }

    async sendFeedbackToEmail (payload) {
        const URL_FUNCTIONS = "https://dxtiskspbikjpyrpeast.supabase.co/functions/v1/resend-email-acontplus-tools-sri"
        const ANONN_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4dGlza3NwYmlranB5cnBlYXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MTc5MjAsImV4cCI6MjA3NjA5MzkyMH0.BvW6UCdC--yLt0XHiYzhfyFTcthga7C7RtzCYdN1r1k"

        try {
            const emailResponse = await fetch(URL_FUNCTIONS, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ANONN_KEY}`
                },
                body: JSON.stringify({
                    to: 'christian.zarate@acontplus.com',
                    subject: `Nuevo Feedback - ${payload.p_full_name}`,
                    html: `
                        <!DOCTYPE html>
                        <html lang="es">
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <title>Nuevo Feedback Recibido</title>
                            <style>
                                body {
                                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                    line-height: 1.6;
                                    color: #333;
                                    margin: 0;
                                    padding: 0;
                                    background-color: #f8fafc;
                                }
                                .container {
                                    max-width: 600px;
                                    margin: 0 auto;
                                    background-color: #ffffff;
                                    border-radius: 12px;
                                    overflow: hidden;
                                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                                }
                                .header {
                                    background: linear-gradient(135deg, #E91E63 0%, #C2185B 100%);
                                    color: white;
                                    padding: 30px 40px;
                                    text-align: center;
                                    position: relative;
                                }
                                .header::before {
                                    content: '';
                                    position: absolute;
                                    top: 0;
                                    left: 0;
                                    right: 0;
                                    bottom: 0;
                                    background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
                                    opacity: 0.3;
                                }
                                .header h1 {
                                    margin: 0;
                                    font-size: 24px;
                                    font-weight: 600;
                                    position: relative;
                                    z-index: 1;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    gap: 12px;
                                }
                                .header h1::before {
                                    content: '💬';
                                    font-size: 28px;
                                }
                                .content {
                                    padding: 40px;
                                }
                                .info-section {
                                    background: #f8fafc;
                                    border-radius: 8px;
                                    padding: 20px;
                                    margin-bottom: 24px;
                                    border-left: 4px solid #E91E63;
                                }
                                .info-item {
                                    display: flex;
                                    margin-bottom: 12px;
                                    align-items: flex-start;
                                }
                                .info-item:last-child {
                                    margin-bottom: 0;
                                }
                                .info-label {
                                    font-weight: 600;
                                    color: #374151;
                                    min-width: 120px;
                                    margin-right: 16px;
                                    font-size: 14px;
                                }
                                .info-value {
                                    color: #6b7280;
                                    flex: 1;
                                    word-break: break-word;
                                }
                                .comments-section {
                                    background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%);
                                    border: 1px solid #d1fae5;
                                    border-radius: 8px;
                                    padding: 24px;
                                    margin-bottom: 24px;
                                }
                                .comments-section h3 {
                                    margin: 0 0 16px 0;
                                    color: #065f46;
                                    font-size: 18px;
                                    display: flex;
                                    align-items: center;
                                    gap: 8px;
                                }
                                .comments-section h3::before {
                                    content: '📝';
                                }
                                .comments-text {
                                    background: white;
                                    border: 1px solid #d1fae5;
                                    border-radius: 6px;
                                    padding: 16px;
                                    color: #374151;
                                    line-height: 1.6;
                                    white-space: pre-wrap;
                                    font-family: inherit;
                                }
                                .footer {
                                    background: #f9fafb;
                                    padding: 24px 40px;
                                    border-top: 1px solid #e5e7eb;
                                    text-align: center;
                                    color: #6b7280;
                                    font-size: 12px;
                                }
                                .footer p {
                                    margin: 0;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    gap: 6px;
                                }
                                .footer p::before {
                                    content: '🌐';
                                }
                                .badge {
                                    display: inline-block;
                                    background: #fef3c7;
                                    color: #92400e;
                                    padding: 4px 8px;
                                    border-radius: 4px;
                                    font-size: 12px;
                                    font-weight: 500;
                                    margin-left: 8px;
                                }
                                @media (max-width: 600px) {
                                    .container {
                                        margin: 10px;
                                        border-radius: 8px;
                                    }
                                    .header, .content, .footer {
                                        padding: 20px;
                                    }
                                    .header h1 {
                                        font-size: 20px;
                                    }
                                    .info-item {
                                        flex-direction: column;
                                        gap: 4px;
                                    }
                                    .info-label {
                                        min-width: auto;
                                        margin-right: 0;
                                    }
                                }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <div class="header">
                                    <h1>Nuevo Feedback Recibido</h1>
                                </div>

                                <div class="content">
                                    <div class="info-section">
                                        <div class="info-item">
                                            <span class="info-label">👤 De:</span>
                                            <span class="info-value">${payload.p_full_name} <span class="badge">${payload.p_email}</span></span>
                                        </div>
                                        <div class="info-item">
                                            <span class="info-label">🆔 RUC:</span>
                                            <span class="info-value">${payload.p_ruc || 'No proporcionado'}</span>
                                        </div>
                                        <div class="info-item">
                                            <span class="info-label">📱 Teléfono:</span>
                                            <span class="info-value">${payload.p_telefono || 'No proporcionado'}</span>
                                        </div>
                                        <div class="info-item">
                                            <span class="info-label">🔧 Versión:</span>
                                            <span class="info-value">${payload.p_extension_version}</span>
                                        </div>
                                    </div>

                                    <div class="comments-section">
                                        <h3>Comentarios del Usuario</h3>
                                        <div class="comments-text">${payload.p_comentarios.replace(/\n/g, '<br>')}</div>
                                    </div>
                                </div>

                                <div class="footer">
                                    <p>Enviado desde: ${payload.p_metadata.url}</p>
                                </div>
                            </div>
                        </body>
                        </html>
                    `
                })
            })

            if (!emailResponse.ok) {
                console.warn('Error enviando email de notificación:', await emailResponse.text())
            }
        } catch (error) {
            console.error('Error al invocar función de email:', error)
        }
    }

    async handleSubmit(e) {
        e.preventDefault()
        
        // Validar formulario
        if (!this.validateForm()) {
            return
        }
        
        // Mostrar loading
        this.form.style.display = 'none'
        document.getElementById('loadingState').style.display = 'block'

        try {
            // Inicializar Supabase
            const supabase = await window.initSupabase()
            if (!supabase) {
                throw new Error('No se pudo inicializar Supabase')
            }

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
                p_detected_types: await this.getDetectedTypes(),
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

            await this.sendFeedbackToEmail(payload)

            // Mostrar éxito
            document.getElementById('loadingState').style.display = 'none'
            document.getElementById('successState').style.display = 'block'

            // Marcar feedback como enviado
            if (window.downloadCounter) {
                await window.downloadCounter.markFeedbackSent()
            }

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
