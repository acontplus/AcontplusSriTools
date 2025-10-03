// Componente de notificaciones para el popup de Acontplus SRI Tools v1.4.1
// Sistema de notificaciones toast

class NotificationComponent {
  constructor(manager) {
    this.manager = manager;
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'notification notification-' + type;

    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };

    PopupUI.safeSetHTML(notification,
      '<span style="margin-right: 8px; font-size: 16px;">' + (icons[type] || icons.info) + '</span>' +
      '<span>' + message + '</span>'
    );

    document.body.appendChild(notification);

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 12px 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: Inter, sans-serif;
      font-size: 13px;
      max-width: 300px;
      transform: translateX(120%);
      transition: all 0.3s ease;
    `;

    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);

    setTimeout(() => {
      notification.style.transform = 'translateX(120%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 5000);
  }
}

// Exportar para uso global
window.NotificationComponent = NotificationComponent;