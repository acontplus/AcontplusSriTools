// Integración del modal de feedback en el popup existente

// Función para agregar botón de feedback al popup
function addFeedbackButton() {
    const popup = document.querySelector('.sri-popup') || document.querySelector('.popup-container')
    
    if (popup) {
        const feedbackBtn = document.createElement('button')
        feedbackBtn.textContent = '💬 Enviar Feedback'
        feedbackBtn.className = 'feedback-btn'
        feedbackBtn.style.cssText = `
            background: #28a745;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            margin: 10px 0;
            font-size: 12px;
        `
        
        feedbackBtn.addEventListener('click', () => {
            if (window.feedbackModal) {
                window.feedbackModal.show()
            } else {
                // Inicializar modal si no existe
                window.feedbackModal = new FeedbackModal()
                window.feedbackModal.show()
            }
        })
        
        popup.appendChild(feedbackBtn)
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addFeedbackButton)
} else {
    addFeedbackButton()
}

// También observar cambios dinámicos en el popup
const observer = new MutationObserver(() => {
    if (!document.querySelector('.feedback-btn')) {
        addFeedbackButton()
    }
})

observer.observe(document.body, { childList: true, subtree: true })
