// Componente de notificaciones - TypeScript

import { NOTIFICATION_DURATION } from '@shared/constants';
import type { NotificationType } from '@shared/types';

export class NotificationComponent {
  private notificationTimeout: NodeJS.Timeout | null = null;

  showNotification(message: string, type: NotificationType = 'info'): void {
    const notificationEl = document.getElementById('notification');
    const notificationMessage = document.getElementById('notification-message');

    if (!notificationEl || !notificationMessage) return;

    notificationMessage.textContent = message;

    notificationEl.className = 'notification';
    notificationEl.classList.add(`notification-${type}`, 'show');

    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }

    this.notificationTimeout = setTimeout(() => {
      notificationEl.classList.remove('show');
    }, NOTIFICATION_DURATION);
  }
}
