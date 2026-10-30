// Sign-in with the auth server: OAuth 2.0 authorization code flow with PKCE (RFC 7636).
// People choose their Google account on the auth server; this page never sees a password.
//
// The UI is a public client, and Spring Authorization Server does not issue refresh tokens to public
// clients. So there is only an access token. When it expires the user signs in again, which is one
// click (and instant while the auth server's own session is still valid).

const AUTH_BASE_URL = 'https://auth.ikoyski.top';
const CLIENT_ID = 'kanban-web';
const SCOPE = 'kanban.read kanban.write';

const TOKEN_KEY = 'kanban-auth';             // localStorage: { accessToken, expiresAt }
const PENDING_KEY = 'kanban-auth-pending';   // sessionStorage: PKCE verifier + state while the redirect is in flight
const EXPIRY_MARGIN_MS = 30_000;

// The page the auth server sends the browser back to. It must be registered for the client
// (AUTH_WEB_REDIRECT_URIS) character for character.
export function redirectUri() {
    return new URL('kanban.html', window.location.href).href;
}

// ---- PKCE helpers -------------------------------------------------------------------------

function base64url(buffer) {
    let binary = '';
    for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomString(byteLength = 32) {
    const bytes = new Uint8Array(byteLength);
    crypto.getRandomValues(bytes);
    return base64url(bytes);
}

export async function challengeFor(verifier) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return base64url(digest);
}

// ---- token storage ------------------------------------------------------------------------

function readTokens() {
    try {
        return JSON.parse(localStorage.getItem(TOKEN_KEY));
    } catch {
        return null;
    }
}

function clearTokens() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('kanban-token');   // left over from the old password login
}

// ---- public API ---------------------------------------------------------------------------

// The access token, or null if there is none or it has (almost) expired.
export function getAccessToken() {
    const tokens = readTokens();
    if (!tokens || !tokens.accessToken) return null;
    if (Date.now() >= tokens.expiresAt - EXPIRY_MARGIN_MS) {
        clearTokens();
        return null;
    }
    return tokens.accessToken;
}

export function isSignedIn() {
    return getAccessToken() !== null;
}

// Sends the browser to the auth server's sign-in page.
export async function startLogin() {
    const verifier = randomString(48);
    const state = randomString(16);
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({
        verifier,
        state,
        returnSearch: window.location.search,   // keeps ?board=... across the round trip
    }));

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: redirectUri(),
        scope: SCOPE,
        state,
        code_challenge: await challengeFor(verifier),
        code_challenge_method: 'S256',
    });
    window.location.assign(`${AUTH_BASE_URL}/oauth2/authorize?${params}`);
}

// Call once on page load. If the URL carries the result of a sign-in (?code=... or ?error=...), finish it:
// check the state, trade the code for an access token, and clean the address bar.
// Returns true when a sign-in was completed, false when this was an ordinary page load.
export async function handleRedirectCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');
    if (!code && !error) return false;

    const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null');
    sessionStorage.removeItem(PENDING_KEY);
    // Never leave the code or state in the address bar or history.
    history.replaceState(null, '', window.location.pathname + (pending?.returnSearch || ''));

    if (error) {
        throw new Error(params.get('error_description') || `Sign-in was not completed (${error}).`);
    }
    if (!pending || !params.get('state') || params.get('state') !== pending.state) {
        throw new Error('The sign-in could not be verified. Please try again.');
    }

    const response = await fetch(`${AUTH_BASE_URL}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: CLIENT_ID,
            code,
            redirect_uri: redirectUri(),
            code_verifier: pending.verifier,
        }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.access_token) {
        throw new Error(body.error_description || body.error || `Sign-in failed (${response.status}).`);
    }

    localStorage.setItem(TOKEN_KEY, JSON.stringify({
        accessToken: body.access_token,
        expiresAt: Date.now() + (Number(body.expires_in) || 0) * 1000,
    }));
    return true;
}

// Forget the tokens on this device only (used when the session has expired).
export function clearSession() {
    clearTokens();
    localStorage.removeItem('kanban-user');
}

// Sign out for real: forget the tokens here, then end the auth server's session so "Continue with Google"
// does not sign the same person straight back in. The auth server returns the browser to this page.
export function logout() {
    clearSession();
    window.location.assign(`${AUTH_BASE_URL}/logout?redirect=${encodeURIComponent(redirectUri())}`);
}
