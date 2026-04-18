export const ENV = {
  // API Endpoints
  AUTH_API_URL: import.meta.env.VITE_AUTH_API_URL || 'http://localhost:4000',
  CORTEX_API_URL: import.meta.env.VITE_CORTEX_API_URL || 'http://localhost:3000',

  // Jarvis Chrome extension ID — derived from the public key in
  // Jarvis/candidate/manifest.json. Used by Skyview to send messages
  // to the extension via chrome.runtime.sendMessage.
  EXTENSION_ID: import.meta.env.VITE_EXTENSION_ID || 'kegdnlfmpkhmcfkaendochifoncjnkna',

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
