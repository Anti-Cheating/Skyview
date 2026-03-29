# Skyview

Web application for **Trueyy** — AI-Powered Interview Integrity Platform.

Skyview is a React-based web portal where users can log in, manage their interview sessions, and seamlessly launch the Falcon desktop app using secure deep linking. It serves as the primary entry point for the Trueyy platform.

## Tech Stack

- **React 19** + **TypeScript** — Modern frontend framework
- **Vite** — Lightning-fast build tool
- **React Router** — Client-side routing (login → signup → dashboard)
- **MUI (Material-UI)** — Professional component library
- **Emotion** — CSS-in-JS styling
- **Socket.io Client** — Real-time communication (future: interview updates)
- **Fetch API** — REST client for Cortex backend

## Architecture

```
Skyview (Web App)
├── Public/Static
│   └── index.html — Entry point
│
├── src/
│   ├── main.tsx — React entry with ThemeProvider
│   ├── App.tsx — Router: /login, /signup, /dashboard
│   ├── theme/ — MUI dark theme (green accent: #4CD964)
│   ├── types/ — TypeScript interfaces (auth, API)
│   ├── config/ — Constants, environment variables
│   ├── services/
│   │   ├── api.service.ts — Fetch wrapper + auth headers
│   │   └── auth.service.ts — Login, signup, logout, desktop code exchange
│   ├── contexts/
│   │   ├── AuthContext.tsx — Global auth state (Redux-like)
│   │   └── SnackbarContext.tsx — Toast notifications
│   ├── components/
│   │   ├── Login/ — Email + password form
│   │   ├── Signup/ — Registration with company info
│   │   ├── Dashboard/ — User home + "Open in Falcon" button
│   │   └── common/ — ErrorBoundary, LoadingSpinner
│   └── utils/ — Validation helpers
│
└── Cortex Backend (localhost:4000)
    ├── POST /auth/login
    ├── POST /auth/signup
    ├── POST /auth/desktop-code (generates one-time code)
    └── POST /auth/exchange-code (exchanges code for tokens)
```

## Authentication Flow

### Standard Login
```
User enters email/password
    ↓
POST /auth/login
    ↓
Tokens stored in localStorage
    ↓
Redirect to /dashboard
```

### Deep Link (Skyview → Falcon)
```
User clicks "Open in Falcon"
    ↓
POST /auth/desktop-code (requires valid JWT)
    ↓
Returns one-time code (5-min expiry, single-use)
    ↓
Construct falcon://auth?code=<code>
    ↓
Trigger deep link → Falcon receives code
    ↓
Falcon exchanges code with Cortex (/auth/exchange-code)
    ↓
Falcon stores tokens in safeStorage (OS keychain)
    ↓
User auto-logged in to Falcon (no prompt)
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Cortex backend running (local or Railway)

### Installation

```bash
# Install dependencies
npm install
```

### Development

```bash
# Start Vite dev server (localhost:5173)
npm run dev
```

The app will open in your browser with hot module reloading enabled.

### Build for Production

```bash
# Compile TypeScript and bundle with Vite
npm run build

# Preview production build locally
npm run preview
```

Output goes to `dist/` directory.

## Environment Variables

Create a `.env` file (or `.env.local` for local overrides):

```env
# Cortex API (backend)
VITE_AUTH_API_URL=http://localhost:4000

# App metadata (optional)
VITE_APP_NAME=Skyview
VITE_APP_VERSION=1.0.0

# Feature flags (optional)
VITE_ENABLE_DEBUG=false
```

**Important:** Environment variables must be prefixed with `VITE_` to be accessible in the browser via `import.meta.env`.

### Default Values

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_AUTH_API_URL` | `http://localhost:4000` | Cortex backend URL |
| `VITE_APP_NAME` | `Skyview` | App title |
| `VITE_APP_VERSION` | `1.0.0` | Version number |
| `VITE_ENABLE_DEBUG` | `false` | Enable debug logging |

## Project Structure

### Core Directories

| Directory | Purpose |
|-----------|---------|
| `src/components/` | React components (Login, Signup, Dashboard) |
| `src/contexts/` | Global state (Auth, Snackbar) |
| `src/services/` | API clients (ApiService, AuthService) |
| `src/types/` | TypeScript interfaces |
| `src/config/` | Constants, environment config |
| `src/utils/` | Helper functions (validation, etc.) |
| `src/theme/` | MUI theme setup |

### Key Files

| File | Purpose |
|------|---------|
| `src/main.tsx` | React entry point with theme provider |
| `src/App.tsx` | Router with protected routes |
| `src/contexts/AuthContext.tsx` | Global auth state + login/logout methods |
| `src/services/auth.service.ts` | Authentication API calls |
| `src/config/constants.ts` | API endpoints, storage keys |
| `index.html` | HTML template |
| `vite.config.ts` | Vite build configuration |

## Key Features

### 🔐 Authentication
- **Login** — Email + password (REST API to Cortex)
- **Signup** — Self-registration with company info
- **Desktop Code** — Secure one-time code for Falcon deep link
- **JWT Tokens** — Stored in localStorage (web standard)

### 🎨 Design
- **Dark Theme** — Professional dark mode with green accents (#4CD964)
- **Responsive** — Works on mobile, tablet, desktop
- **Material-UI** — Industry-standard component library
- **Error Handling** — User-friendly error messages + alerts

### 🔗 Deep Linking
- **"Open in Falcon" button** — Single-click launch with auto-login
- **One-time codes** — 5-minute expiry, single-use only
- **No credentials transfer** — Only codes pass via URL

## API Integration

### Authentication Endpoints

| Method | Endpoint | Auth | Body | Response |
|--------|----------|------|------|----------|
| POST | `/auth/signup` | None | `{ email, password, firstName, lastName, companyName }` | `{ user, accessToken, refreshToken }` |
| POST | `/auth/login` | None | `{ email, password }` | `{ user, accessToken, refreshToken }` |
| POST | `/auth/desktop-code` | JWT | — | `{ code, expiresIn }` |
| POST | `/auth/exchange-code` | None | `{ code }` | `{ user, accessToken, refreshToken }` |
| GET | `/auth/me` | JWT | — | `{ user }` |

### Example: Login

```typescript
const response = await fetch('http://localhost:4000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
});

const { user, accessToken, refreshToken } = await response.json();
localStorage.setItem('auth_access_token', accessToken);
localStorage.setItem('auth_user', JSON.stringify(user));
```

## Styling

### Theme

The app uses a **dark theme** with green accents:

| Color | Value | Usage |
|-------|-------|-------|
| Primary Green | `#4CD964` | Buttons, accents, links |
| Dark BG | `#0F1419` | Page background |
| Card BG | `#1E2328` | Card backgrounds |
| Text Primary | `#E5E7EB` | Main text |
| Text Secondary | `rgba(255,255,255,0.6)` | Secondary text |

### Customization

Modify MUI theme in `src/theme/index.ts`:

```typescript
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: { main: '#4CD964' },
    background: { default: '#0F1419' },
    // ...
  },
});
```

## Authentication State

### AuthContext

The `AuthContext` manages global authentication state:

```typescript
interface AuthContextType {
  user: User | null;          // Logged-in user data
  isAuthenticated: boolean;   // Is user logged in?
  isLoading: boolean;         // Auth check in progress?
  login: (credentials) => Promise<void>;
  logout: () => Promise<void>;
  signup: (credentials) => Promise<void>;
}

// Usage in components
const { user, isAuthenticated, login, logout } = useAuth();
```

### Usage Example

```typescript
import { useAuth } from './hooks/useAuth';

function MyComponent() {
  const { user, logout } = useAuth();

  return (
    <div>
      <p>Welcome, {user?.email}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

## Error Handling

### API Errors

All API calls return a standardized error response:

```typescript
interface ApiError {
  message: string;      // Human-readable error message
  status?: number;      // HTTP status code
  data?: any;          // Additional error data
}
```

### Snackbar Notifications

Use the `SnackbarContext` to show toast notifications:

```typescript
import { useSnackbar } from './contexts/SnackbarContext';

function MyComponent() {
  const { showError, showSuccess } = useSnackbar();

  const handleSubmit = async () => {
    try {
      await someAsyncOperation();
      showSuccess('Operation completed!');
    } catch (error) {
      showError('Operation failed');
    }
  };
}
```

## Security Considerations

### Token Storage
- **Access Token** — Stored in `localStorage` (vulnerable to XSS, but standard for web)
- **Refresh Token** — Stored in `localStorage` (needed for token rotation)

### XSS Protection
- **Input Validation** — Email/password validated client-side
- **Content Security Policy** — CSP headers set in `index.html`
- **Sanitization** — MUI components sanitize user input

### HTTPS
- Always use HTTPS in production
- Set `secure` flag on cookies if implemented
- Disable `devTools` in production builds

## Troubleshooting

### "Failed to connect to Cortex"
- Ensure Cortex is running on `localhost:4000`
- Check `VITE_AUTH_API_URL` environment variable
- Check browser console for CORS errors

### "Invalid email or password"
- Verify credentials are correct
- Check that Cortex database has the user
- Check Cortex logs for auth errors

### Deep link not opening Falcon
- Ensure Falcon is installed
- Check that `falcon://` protocol is registered (Falcon's main.ts)
- Verify desktop code hasn't expired (5-minute TTL)

### "Token expired" errors
- Refresh the page to trigger auth re-check
- Login again to get fresh tokens
- Check that Cortex tokens haven't been revoked

## Development Tips

### Hot Module Reloading (HMR)
Vite automatically reloads modules as you save files. No manual restart needed!

### TypeScript Checking
Run type checking without building:
```bash
npx tsc --noEmit
```

### Debugging
- Open DevTools (F12) in the browser
- Check Network tab for API calls
- Check Console for error messages
- Use React DevTools browser extension

### Common Issues
- **Module not found** — Check import paths (case-sensitive)
- **Styles not applied** — Ensure MUI ThemeProvider wraps the app
- **Auth context undefined** — Ensure component is wrapped with AuthProvider
- **CORS errors** — Check Cortex CORS headers and bucket origins

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Build for production (TypeScript + Vite) |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run TypeScript type checking |

## Performance

### Bundle Size
- React 19: ~42 KB (gzipped)
- Material-UI: ~200 KB (tree-shaked)
- Total: ~300-400 KB (gzipped)

### Optimization Tips
- Use `React.lazy()` for code splitting
- Lazy-load heavy components like charts
- Use `useMemo()` to memoize expensive computations
- Enable Gzip compression on the server

## Deployment

### Vercel (Recommended)
```bash
# Connect repo to Vercel
vercel

# Environment variables
VITE_AUTH_API_URL=https://cortex-production.railway.app
```

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

### Traditional Hosting
```bash
npm run build
# Upload dist/ folder to your web server
# Configure server to serve index.html for all routes (SPA)
```

## Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes and commit: `git commit -am 'Add feature'`
3. Push to remote: `git push origin feature/my-feature`
4. Open a pull request

## License

MIT

## Support

For issues or questions:
- Check the [Cortex README](../Cortex-main/README.md) for backend info
- Check the [Falcon README](../Falcon/README.md) for desktop app info
- Review GitHub issues for known problems
- Contact the development team

---

**Part of Trueyy** — AI-Powered Interview Integrity Platform
