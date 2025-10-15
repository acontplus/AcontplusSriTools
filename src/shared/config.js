// Configuración centralizada para Supabase API - SRI Tools
class APIConfig {
  static get ENDPOINTS() {
    return {
      SUPABASE: {
        BASE_URL: 'https://your-project.supabase.co/rest/v1',
        ANON_KEY: 'your-anon-key-here',
        ENDPOINTS: {
          USERS: '/users',
          DOCUMENTS: '/sri_documents',
          SESSIONS: '/user_sessions'
        }
      }
    };
  }

  static get SETTINGS() {
    return {
      TIMEOUT: 10000,
      RETRY_ATTEMPTS: 3,
      RETRY_DELAY: 1000,
      BATCH_SIZE: 50
    };
  }

  static get STORAGE_KEYS() {
    return {
      USER_TOKEN: 'supabase_token',
      USER_DATA: 'user_data',
      LAST_SYNC: 'last_sync_timestamp'
    };
  }
}
