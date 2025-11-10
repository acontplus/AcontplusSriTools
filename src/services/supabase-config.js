// Supabase configuration - Direct config for Chrome extension
let SUPABASE_URL = "https://dxtiskspbikjpyrpeast.supabase.co";
let SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4dGlza3NwYmlranB5cnBlYXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MTc5MjAsImV4cCI6MjA3NjA5MzkyMH0.BvW6UCdC--yLt0XHiYzhfyFTcthga7C7RtzCYdN1r1k";

// Función para cargar configuración desde chrome.storage
async function loadConfigFromStorage() {
  try {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        ["SUPABASE_URL", "SUPABASE_ANON_KEY"],
        (result) => {
          if (result.SUPABASE_URL) SUPABASE_URL = result.SUPABASE_URL;
          if (result.SUPABASE_ANON_KEY)
            SUPABASE_ANON_KEY = result.SUPABASE_ANON_KEY;
          resolve();
        }
      );
    });
  } catch (error) {
    console.warn("No se pudo cargar configuración de chrome.storage:", error);
  }
}

// Crear cliente Supabase
let supabase = null;

// Función para inicializar Supabase
async function initSupabase() {
  if (supabase) return supabase;

  await loadConfigFromStorage();

  try {
    if (typeof window.supabase === "undefined") {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = chrome.runtime.getURL("assets/js/supabase.js");
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    if (
      !SUPABASE_URL ||
      !SUPABASE_ANON_KEY ||
      SUPABASE_URL === "https://your-project.supabase.co"
    ) {
      throw new Error("Credenciales de Supabase no configuradas");
    }

    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabase;
  } catch (error) {
    console.error("Error inicializando Supabase:", error);
    return null;
  }
}

window.initSupabase = initSupabase;
