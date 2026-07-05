export const ENV = {
  // API Endpoints — Cortex serves auth + interview + post-analysis routes
  AUTH_API_URL: import.meta.env.VITE_AUTH_API_URL || 'http://localhost:4000',
  CORTEX_API_URL:
    import.meta.env.VITE_CORTEX_API_URL ||
    import.meta.env.VITE_AUTH_API_URL ||
    'http://localhost:4000',

  // App Configuration
  APP_NAME: import.meta.env.VITE_APP_NAME || 'Skyview',
  APP_VERSION: import.meta.env.VITE_APP_VERSION || '1.0.0',

  // Feature Flags
  ENABLE_DEBUG: import.meta.env.VITE_ENABLE_DEBUG === 'true',

  // Token Configuration
  TOKEN_REFRESH_INTERVAL: 60000, // 1 minute
  TOKEN_EXPIRY_BUFFER: 60000,    // 1 minute buffer before expiry
} as const;

export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;
