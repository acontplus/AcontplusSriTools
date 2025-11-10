// Tab Manager - Sistema de navegación por pestañas

export class TabManager {
  private tabs: NodeListOf<Element>;
  private tabPanels: NodeListOf<Element>;

  constructor() {
    this.tabs = document.querySelectorAll('.tab-button');
    this.tabPanels = document.querySelectorAll('.tab-panel');
    this.init();
  }

  private init(): void {
    this.setupTabListeners();
    this.setupDemoButton();
    this.setupYouTubeLink();
    this.setupFAQEventListeners();
    this.setupTabObserver();
  }

  private setupTabListeners(): void {
    this.tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const targetTabId = tab.getAttribute('data-tab');
        if (!targetTabId) return;

        // Quitar la clase 'active' de todas las pestañas y paneles
        this.tabs.forEach((item) => item.classList.remove('active'));
        this.tabPanels.forEach((panel) => panel.classList.remove('active'));

        // Añadir la clase 'active' a la pestaña y panel seleccionados
        tab.classList.add('active');
        const targetPanel = document.getElementById(targetTabId);
        if (targetPanel) {
          targetPanel.classList.add('active');
        }
      });
    });
  }

  private setupDemoButton(): void {
    const demoBtn = document.getElementById('demo-btn');
    if (demoBtn) {
      demoBtn.addEventListener('click', () => {
        chrome.tabs.create({
          url: 'https://www.acontplus.com/demo/',
          active: true,
        });
      });
    }
  }

  private setupYouTubeLink(): void {
    const youtubeVideoLink = document.getElementById('youtube-video-link');
    if (youtubeVideoLink) {
      youtubeVideoLink.addEventListener('click', () => {
        chrome.tabs.create({
          url: 'https://youtu.be/wEYuhdi7DaU?si=WtbDMcJ7dbnBOvFt',
          active: true,
        });
      });
    }
  }

  private setupFAQEventListeners(): void {
    // Event listeners para FAQ toggles
    const faqToggles = document.querySelectorAll('.faq-toggle');
    faqToggles.forEach((button) => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleFAQ(button);
      });
    });

    // Event listeners para botones de navegación entre pestañas
    const tabSwitchButtons = document.querySelectorAll('[data-switch-tab]');
    tabSwitchButtons.forEach((button) => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const targetTab = button.getAttribute('data-switch-tab');
        if (targetTab) {
          const targetTabButton = document.querySelector(`[data-tab="${targetTab}"]`);
          if (targetTabButton) {
            (targetTabButton as HTMLElement).click();
          }
        }
      });
    });
  }

  private toggleFAQ(button: Element): void {
    const faqItem = button.closest('.faq-item-modern');
    if (!faqItem) return;

    const content = faqItem.querySelector('.faq-content') as HTMLElement;
    const chevron = button.querySelector('.fa-chevron-down') as HTMLElement;
    
    if (!content || !chevron) return;

    const isOpen = !content.classList.contains('hidden');

    // Cerrar todos los otros FAQs
    document.querySelectorAll('.faq-item-modern').forEach((item) => {
      const otherContent = item.querySelector('.faq-content') as HTMLElement;
      const otherChevron = item.querySelector('.fa-chevron-down') as HTMLElement;
      
      if (item !== faqItem && otherContent && otherChevron) {
        otherContent.classList.add('hidden');
        otherChevron.style.transform = 'rotate(0deg)';
      }
    });

    // Toggle el FAQ actual
    if (isOpen) {
      content.classList.add('hidden');
      chevron.style.transform = 'rotate(0deg)';
    } else {
      content.classList.remove('hidden');
      chevron.style.transform = 'rotate(180deg)';
      
      // Smooth scroll al FAQ abierto
      setTimeout(() => {
        faqItem.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }, 100);
    }
  }

  private setupTabObserver(): void {
    const tabObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const target = mutation.target as Element;
          if (target.classList.contains('tab-panel') && target.classList.contains('active')) {
            // Reconfigurar event listeners cuando se activa una pestaña
            setTimeout(() => {
              this.setupFAQEventListeners();
            }, 100);
          }
        }
      });
    });

    // Observar cambios en todos los paneles de pestañas
    this.tabPanels.forEach((panel) => {
      tabObserver.observe(panel, {
        attributes: true,
        attributeFilter: ['class'],
      });
    });
  }
}
