// Single source of truth for frontend environment endpoints and OAuth callback URLs.
// The Pages site is hosted under /kanban/, while the Render static site is hosted at its root.
const environments = {
  'pages.ikoyski.top': {
    apiBaseUrl: 'https://api.ikoyski.top/kanban-backend',
    authBaseUrl: 'https://auth.ikoyski.top',
    redirectPath: '/kanban/kanban.html',
  },
  'webtools-test-kanban.onrender.com': {
    apiBaseUrl: 'https://webtools-test-api-gateway.onrender.com/kanban-backend',
    authBaseUrl: 'https://webtools-test-auth.onrender.com',
    redirectPath: '/kanban.html',
  },
  // Local Playwright and manual development retain the existing production-backed
  // development behavior. The callback origin is taken from the local server.
  localhost: {
    apiBaseUrl: 'https://api.ikoyski.top/kanban-backend',
    authBaseUrl: 'https://auth.ikoyski.top',
    redirectPath: '/kanban.html',
  },
  '127.0.0.1': {
    apiBaseUrl: 'https://api.ikoyski.top/kanban-backend',
    authBaseUrl: 'https://auth.ikoyski.top',
    redirectPath: '/kanban.html',
  },
};

const environment = environments[window.location.hostname];

if (!environment) {
  throw new Error(`Unsupported frontend hostname: ${window.location.hostname}`);
}

export const config = Object.freeze({
  apiBaseUrl: environment.apiBaseUrl,
  authBaseUrl: environment.authBaseUrl,
  // Resolve the configured callback path against the current frontend origin here.
  // auth.js only consumes this value; it never constructs a redirect URI itself.
  redirectUri: new URL(environment.redirectPath, window.location.origin).href,
});
