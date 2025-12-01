// Componente de notificaciones - Sistema simple y funcional

import { NOTIFICATION_DURATION } from '@shared/constants';
import type { NotificationType } from '@shared/types';

export class NotificationComponent {
  private container: HTMLDivElement | null = null;

  constructor() {
    this.createContainer();
  }

  private createContainer(): void {
    // Crear contenedor de notificaciones si no existe
    this.container = document.getElementById('notification-container') as HTMLDivElement;
    
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'notification-container';
      this.container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: 400px;
      `;
      document.body.appendChild(this.container);
    }
  }

  showNotification(message: string, type: NotificationType = 'info', duration: number = NOTIFICATION_DURATION): void {
    if (!this.container) this.createContainer();
    if (!this.container) return;

    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // Estilos según el tipo
    const colors = {
      success: { bg: '#10b981', icon: '✓' },
      error: { bg: '#ef4444', icon: '✕' },
      warning: { bg: '#f59e0b', icon: '⚠' },
      info: { bg: '#3b82f6', icon: 'ℹ' },
    };
    
    const color = colors[type] || colors.info;
    
    notification.style.cssText = `
      background: ${color.bg};
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
      animation: slideIn 0.3s ease-out;
      cursor: pointer;
      min-width: 300px;
    `;
    
    notification.innerHTML = `
      <span style="font-size: 18px; font-weight: bold;">${color.icon}</span>
      <span style="flex: 1;">${message}</span>
      <span style="opacity: 0.7; font-size: 18px;">×</span>
    `;
    
    // Agregar al contenedor
    this.container.appendChild(notification);
    
    // Cerrar al hacer clic
    notification.addEventListener('click', () => {
      this.removeNotification(notification);
    });
    
    // Auto-cerrar después de la duración
    if (duration > 0) {
      setTimeout(() => {
        this.removeNotification(notification);
      }, duration);
    }
  }

  private removeNotification(notification: HTMLElement): void {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
      notification.remove();
    }, 300);
  }
}

// Agregar estilos de animación
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
  
  .notification:hover {
    opacity: 0.9;
  }
`;
document.head.appendChild(style);
