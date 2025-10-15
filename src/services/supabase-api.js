// Servicio API para Supabase
class SupabaseAPI {
  constructor() {
    const config = APIConfig.ENDPOINTS.SUPABASE;
    this.client = new HTTPClient(config.BASE_URL, {
      'apikey': config.ANON_KEY,
      'Authorization': `Bearer ${config.ANON_KEY}`
    });
    this.endpoints = config.ENDPOINTS;
  }

  async authenticate(email, password) {
    try {
      // Supabase auth endpoint
      const authClient = new HTTPClient('https://your-project.supabase.co/auth/v1');
      const response = await authClient.post('/token?grant_type=password', {
        email,
        password
      });

      if (response.access_token) {
        await this.setAuthToken(response.access_token);
        await this.storeUserData(response.user);
      }

      return response;
    } catch (error) {
      throw new APIError(`Supabase auth failed: ${error.message}`, error.status);
    }
  }

  async setAuthToken(token) {
    this.client.defaultHeaders['Authorization'] = `Bearer ${token}`;
    await chrome.storage.local.set({ [APIConfig.STORAGE_KEYS.USER_TOKEN]: token });
  }

  async storeUserData(userData) {
    await chrome.storage.local.set({ [APIConfig.STORAGE_KEYS.USER_DATA]: userData });
  }

  async syncDocuments(documents) {
    try {
      // Insert documents in Supabase table
      const response = await this.client.post(this.endpoints.DOCUMENTS, 
        documents.map(doc => ({
          ...doc,
          user_id: await this.getCurrentUserId(),
          created_at: new Date().toISOString(),
          source: 'sri_extractor'
        }))
      );

      await this.updateLastSync();
      return response;
    } catch (error) {
      throw new APIError(`Document sync failed: ${error.message}`, error.status);
    }
  }

  async getUserProfile() {
    const userId = await this.getCurrentUserId();
    return await this.client.get(`${this.endpoints.USERS}?id=eq.${userId}&select=*`);
  }

  async getCurrentUserId() {
    const userData = await chrome.storage.local.get(APIConfig.STORAGE_KEYS.USER_DATA);
    return userData[APIConfig.STORAGE_KEYS.USER_DATA]?.id;
  }

  async updateLastSync() {
    await chrome.storage.local.set({ 
      [APIConfig.STORAGE_KEYS.LAST_SYNC]: new Date().toISOString() 
    });
  }

  // Supabase specific: Real-time subscriptions
  async subscribeToChanges(table, callback) {
    // Implementation would depend on Supabase real-time client
    console.log(`Subscribing to ${table} changes`);
  }
}
