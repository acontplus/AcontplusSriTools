// --- LÓGICA PARA LAS PESTAÑAS ---
document.addEventListener("DOMContentLoaded", function () {
  const tabs = document.querySelectorAll(".tab-button");
  const tabPanels = document.querySelectorAll(".tab-panel");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      // Obtener el ID del panel de la pestaña clickeada
      const targetTabId = tab.getAttribute("data-tab");

      // Quitar la clase 'active' de todas las pestañas y paneles
      tabs.forEach((item) => item.classList.remove("active"));
      tabPanels.forEach((panel) => panel.classList.remove("active"));

      // Añadir la clase 'active' a la pestaña y panel seleccionados
      tab.classList.add("active");
      document.getElementById(targetTabId).classList.add("active");
    });
  });

  // Event listener para el botón de demo
  const demoBtn = document.getElementById("demo-btn");
  if (demoBtn) {
    demoBtn.addEventListener("click", function () {
      // Abrir en una nueva ventana externa
      chrome.tabs.create({
        url: "https://www.acontplus.com/demo/",
        active: true,
      });
    });
  }

  // Event listener para el video de YouTube
  const youtubeVideoLink = document.getElementById("youtube-video-link");
  if (youtubeVideoLink) {
    youtubeVideoLink.addEventListener("click", function () {
      // Abrir video de YouTube en nueva pestaña
      chrome.tabs.create({
        url: "https://youtu.be/wEYuhdi7DaU?si=WtbDMcJ7dbnBOvFt",
        active: true,
      });
    });
  }

  // Setup FAQ event listeners
  setupFAQEventListeners();

  // Observer para detectar cambios en las pestañas y reconfigurar event listeners
  const tabObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const target = mutation.target;
        if (target.classList.contains('tab-panel') && target.classList.contains('active')) {
          // Reconfigurar event listeners cuando se activa una pestaña
          setTimeout(() => {
            setupFAQEventListeners();
          }, 100);
        }
      }
    });
  });

  // Observar cambios en los paneles de pestañas
  document.querySelectorAll('.tab-panel').forEach(panel => {
    tabObserver.observe(panel, { attributes: true, attributeFilter: ['class'] });
  });
});

// --- FUNCIONALIDAD FAQ ACCORDION ---
function toggleFAQ(button) {
  const faqItem = button.closest(".faq-item-modern");
  const content = faqItem.querySelector(".faq-content");
  const chevron = button.querySelector(".fa-chevron-down");
  const isOpen = !content.classList.contains("hidden");

  // Cerrar todos los otros FAQs
  document.querySelectorAll(".faq-item-modern").forEach((item) => {
    const otherContent = item.querySelector(".faq-content");
    const otherChevron = item.querySelector(".fa-chevron-down");
    if (item !== faqItem) {
      otherContent.classList.add("hidden");
      otherChevron.style.transform = "rotate(0deg)";
    }
  });

  // Toggle el FAQ actual
  if (isOpen) {
    content.classList.add("hidden");
    chevron.style.transform = "rotate(0deg)";
  } else {
    content.classList.remove("hidden");
    chevron.style.transform = "rotate(180deg)";

    // Smooth scroll al FAQ abierto
    setTimeout(() => {
      faqItem.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 100);
  }
}

// --- SETUP EVENT LISTENERS PARA FAQ ---
function setupFAQEventListeners() {
  // Event listeners para FAQ toggles
  const faqToggles = document.querySelectorAll('.faq-toggle');
  
  faqToggles.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      toggleFAQ(this);
    });
  });

  // Event listeners para botones de navegación entre pestañas
  const tabSwitchButtons = document.querySelectorAll('[data-switch-tab]');
  tabSwitchButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      const targetTab = this.getAttribute('data-switch-tab');
      const targetTabButton = document.querySelector(`[data-tab="${targetTab}"]`);
      if (targetTabButton) {
        targetTabButton.click();
      }
    });
  });
}
