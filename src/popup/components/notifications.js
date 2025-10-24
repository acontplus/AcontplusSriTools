// Componente de notificaciones para el popup de Acontplus SRI Tools v1.4.1
// Sistema de notificaciones toast

class NotificationComponent {
  constructor(manager) {
    this.manager = manager;
    this.activeNotifications = [];
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
    this.activeNotifications.push(notification);

    // Calcular posición basada en notificaciones existentes
    const topPosition = 20 + (this.activeNotifications.length - 1) * 70;

    notification.style.cssText = `
      position: fixed;
      top: ${topPosition}px;
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
      this.removeNotification(notification);
    }, 5000);
  }

  removeNotification(notification) {
    if (notification && notification.parentNode) {
      notification.style.transform = 'translateX(120%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
        const index = this.activeNotifications.indexOf(notification);
        if (index > -1) {
          this.activeNotifications.splice(index, 1);
        }
        // Reposicionar notificaciones restantes
        this.repositionNotifications();
      }, 300);
    }
  }

  repositionNotifications() {
    this.activeNotifications.forEach((notification, index) => {
      const newTop = 20 + index * 70;
      notification.style.top = newTop + 'px';
    });
  }
}

// Exportar para uso global
window.NotificationComponent = NotificationComponent;