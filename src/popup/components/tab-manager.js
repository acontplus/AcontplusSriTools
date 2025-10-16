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
});
