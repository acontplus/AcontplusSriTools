// Factory para Supabase API
class APIFactory {
  static async createProvider() {
    return new SupabaseAPI();
  }
}

// Servicio unificado para el manejo de datos de usuario
class UserDataService {
  constructor() {
    this.apiProvider = null;
  }

  async init() {
    this.apiProvider = await APIFactory.createProvider();
  }

  async authenticate(credentials) {
    if (!this.apiProvider) await this.init();
    return await this.apiProvider.authenticate(credentials);
  }

  async syncDocuments(documents) {
    if (!this.apiProvider) await this.init();
    return await this.apiProvider.syncDocuments(documents);
  }

  async getUserProfile() {
    if (!this.apiProvider) await this.init();
    return await this.apiProvider.getUserProfile();
  }

  async isAuthenticated() {
    const token = await chrome.storage.local.get(APIConfig.STORAGE_KEYS.USER_TOKEN);
    return !!token[APIConfig.STORAGE_KEYS.USER_TOKEN];
  }

  async logout() {
    await chrome.storage.local.remove([
      APIConfig.STORAGE_KEYS.USER_TOKEN,
      APIConfig.STORAGE_KEYS.USER_DATA
    ]);
  }
}
