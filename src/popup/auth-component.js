// Componente de autenticación para el popup
class AuthComponent {
  constructor(manager) {
    this.manager = manager;
    this.userService = new UserDataService();
    this.isAuthenticated = false;
  }

  async init() {
    this.isAuthenticated = await this.userService.isAuthenticated();
    this.renderAuthState();
  }

  renderAuthState() {
    const authContainer = document.getElementById('auth-container');
    if (!authContainer) return;

    if (this.isAuthenticated) {
      authContainer.innerHTML = this.renderAuthenticatedView();
    } else {
      authContainer.innerHTML = this.renderLoginView();
    }
    
    this.setupAuthEventListeners();
  }

  renderLoginView() {
    return `
      <div class="auth-login p-4 border rounded">
        <h3 class="text-lg font-semibold mb-3">Conectar con Supabase</h3>

        <div class="mb-3">
          <label class="block text-sm font-medium mb-1">Email:</label>
          <input type="email" id="auth-email" class="w-full p-2 border rounded" placeholder="usuario@empresa.com">
        </div>

        <div class="mb-3">
          <label class="block text-sm font-medium mb-1">Contraseña:</label>
          <input type="password" id="auth-password" class="w-full p-2 border rounded">
        </div>

        <button id="login-btn" class="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
          Conectar
        </button>
      </div>
    `;
  }

  renderAuthenticatedView() {
    return `
      <div class="auth-authenticated p-4 border rounded bg-green-50">
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-lg font-semibold text-green-800">✓ Conectado</h3>
          <button id="logout-btn" class="text-sm text-red-600 hover:text-red-800">Desconectar</button>
        </div>
        
        <div class="mb-3">
          <button id="sync-btn" class="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700">
            Sincronizar Documentos
          </button>
        </div>

        <div id="sync-status" class="text-sm text-gray-600"></div>
      </div>
    `;
  }

  setupAuthEventListeners() {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const syncBtn = document.getElementById('sync-btn');

    if (loginBtn) {
      loginBtn.addEventListener('click', () => this.handleLogin());
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    if (syncBtn) {
      syncBtn.addEventListener('click', () => this.handleSync());
    }
  }

  async handleLogin() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;

    if (!email || !password) {
      alert('Por favor complete todos los campos');
      return;
    }

    try {
      await this.userService.init();
      await this.userService.authenticate({ email, password });
      
      this.isAuthenticated = true;
      this.renderAuthState();
      
      this.manager.notificationComponent?.showSuccess('Conectado exitosamente');
    } catch (error) {
      console.error('Login failed:', error);
      this.manager.notificationComponent?.showError(`Error de conexión: ${error.message}`);
    }
  }

  async handleLogout() {
    await this.userService.logout();
    this.isAuthenticated = false;
    this.renderAuthState();
    this.manager.notificationComponent?.showInfo('Desconectado');
  }

  async handleSync() {
    if (!this.manager.facturas.length) {
      this.manager.notificationComponent?.showWarning('No hay documentos para sincronizar');
      return;
    }

    const statusEl = document.getElementById('sync-status');
    statusEl.textContent = 'Sincronizando...';

    try {
      const results = await this.userService.syncDocuments(this.manager.facturas);
      statusEl.textContent = `✓ ${this.manager.facturas.length} documentos sincronizados`;
      this.manager.notificationComponent?.showSuccess('Sincronización completada');
    } catch (error) {
      statusEl.textContent = `✗ Error en sincronización`;
      this.manager.notificationComponent?.showError(`Error: ${error.message}`);
    }
  }
}
