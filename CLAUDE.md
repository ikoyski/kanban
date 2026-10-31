# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands
- **Run App**: Open `kanban.html` (the app) or `index.html` (landing page) directly in a modern web browser.
- **Build/Test**: No build process or automated test suite is currently implemented.

## Architecture and Structure
The project is a vanilla JavaScript implementation of a Kanban board using ES6 modules.

### Core Components
- `privacy.html`, `terms.html`: Static legal pages (contact email is set in each file; keep them in sync with what the app and backend actually collect).
- `kanban.html`: The app's entry point and layout.
- `index.html`: Static landing page (Tailwind + a small SortableJS sample board). It links to `kanban.html` and forwards old `?board=` deep links there.
- `src/css/style.css`: Custom styles (complements Tailwind CSS).
- `src/js/app.js`: Main application controller (`KanbanApp` class). Manages application state, event listeners, and coordinates between the API and UI.
- `src/js/api.js`: Data persistence layer (`ApiClient` class). Handles communication with the REST API backend; every request carries the access token from `auth.js`.
- `src/js/auth.js`: Sign-in with the auth server: OAuth 2.0 authorization code flow with PKCE, token storage, sign-out. No UI code in it.
- `src/js/ui.js`: UI rendering and DOM manipulation layer (`UI` object). Handles board rendering, modal controls, and theme switching.
- `src/js/editor.js`: WYSIWYG rich-text support. Wraps Quill (`createRichEditor`) and provides the sanitize/normalize/plain-text helpers (`sanitizeHtml`, `toDisplayHtml`, `toPlainText`, `normalizeEditorHtml`) used anywhere card `description` or comment `content` is read, written, or displayed.

### State Management
- State is maintained as a central object within the `KanbanApp` instance.
- The app supports multi-board functionality; `currentBoardId` and `currentRole` are tracked to manage access and persistence.
- State includes `columns` (mapping column IDs to lists of card IDs), `cards` (mapping card IDs to card data), and `settings` (e.g., theme).
- State changes are persisted via `ApiClient` to a REST API backend, using optimistic updates for a snappy UI.
- **Authentication**: People sign in with Google on the auth server (`https://auth.ikoyski.top`); this app never handles a password. `auth.js` runs the authorization code flow with PKCE as the public client `kanban-web` and keeps the access token in `localStorage` (`kanban-auth`). The profile (name, avatar) comes from `GET /v1/users/me`, not from the token. Spring Authorization Server issues no refresh tokens to public clients, so the token is a single longer-lived access token (default 8 hours); when it expires or the API answers 401, `handleSessionExpired()` clears it and shows the sign-in screen, and signing in again is one click.
- **Role-Based Access Control (RBAC)**: The app enforces roles (`OWNER`, `EDITOR`, `VIEWER`). Mutating actions and certain UI elements are gated based on the current board role.

### Auth screen
- `kanban.html` has one card in `#app-auth-view` (`#signin-card`) with a "Continue with Google" button (`#google-signin-btn`) and a message area (`#auth-message`) for sign-in errors and session expiry. The page must be served at the redirect URI registered for the client (`redirectUri()` in `auth.js` resolves `kanban.html` relative to the current page; the auth server's `AUTH_WEB_REDIRECT_URIS` must list that exact URL).

- API validation errors are shaped `{ field: "message" }` with no `message` key; `ApiClient.request` joins those values into the thrown error message.

### UI Interaction Patterns
- **DOM Access**: The `UI` object centralizes access to common DOM elements.
- **Communication**: The project uses an event-driven approach for UI-to-App communication. The `UI` layer often dispatches `CustomEvent` objects on the `window` object to signal actions that require state changes.
    - Example events: `open-card-modal`, `rename-column`, `delete-column`, `auth-expired`.
- **Rendering**: The board is re-rendered entirely via `UI.renderBoard(state)` whenever a significant state change occurs, followed by a re-initialization of SortableJS.

### Key Dependencies
- **Tailwind CSS**: Used for responsive styling.
- **SortableJS**: Implements the drag-and-drop functionality for moving cards between columns.
- **Quill** + **DOMPurify**: Rich-text editing and sanitizing for card descriptions/comments (see `src/js/editor.js`).
- **Auth server**: `https://auth.ikoyski.top` (Spring Authorization Server). Endpoints used: `/oauth2/authorize`, `/oauth2/token`, `/logout`. It must allow this app's origin for CORS on the token endpoint (`AUTH_CORS_ALLOWED_ORIGINS`) and the logout return URL (`AUTH_LOGOUT_REDIRECTS`).

### Rich Text (card description / comments)
- `description` and `content` are plain strings over the wire — the API has no opinion on
  format. The frontend is what interprets them as HTML, so every read/write path must go
  through `editor.js`, never a raw template literal:
  - **Rendering** (card preview, detail view, comments, archived list, search): use
    `toDisplayHtml()` for rich display or `toPlainText()` for plain-text contexts (previews,
    search matching). Both are safe to call on legacy plain-text content saved before this
    feature existed — `toDisplayHtml` detects non-HTML input and escapes it into `<p>` tags
    instead of rendering it raw.
  - **Editing**: `createRichEditor(container, { html, placeholder, compact })` mounts Quill in
    a container and returns `{ getHtml, setHtml, isEmpty, clear, focus, onKeydown, destroy }`.
    `getHtml()` already runs the content through `normalizeEditorHtml()` (which flattens
    Quill's internal DOM into plain `<ul>/<ol>`/`<pre><code>`) and `sanitizeHtml()` — don't
    re-sanitize or re-read `quill.root.innerHTML` directly elsewhere.
  - **Never** interpolate `card.description` or a comment's `content` into a template string
    unescaped — always go through `toDisplayHtml`/`toPlainText` first. This is the one field
    in the app that is genuinely attacker-controlled HTML (any board member can write it), so
    treat new UI that touches it with the same care as the existing call sites in `ui.js`.
  - The card-detail modal's description field and the comment composer both use
    `UI.startRichEdit` / `createRichEditor` — editors are destroyed and recreated whenever the
    modal re-renders (e.g. after any inline edit), so don't hold a long-lived reference to a
    Quill instance across a `UI.openCardDetail()` call.


### AI assistant / MCP integration boundary
- This repository is the web frontend; it does **not** implement the MCP server. MCP is provided by the separate `ikoyski/webtools-kanban-mcp` service.
- The MCP service is configured as a separate OAuth resource/client integration. Do not add MCP server endpoints, tool definitions or token-validation logic to this frontend unless the architecture is intentionally changed.
- The MCP service validates the caller's access token and forwards the original Bearer token to the Kanban API. Backend authorization remains authoritative; never assume that hiding a UI control grants or denies API access.
- Supported AI clients include Google Gemini and Anthropic Claude, with OpenAI ChatGPT available where configured. Keep provider availability claims qualified by the deployed client configuration.
- MCP actions may read and modify boards, columns, cards and comments. Any frontend copy or legal disclosure must explain that assistant prompts and returned Kanban content may be processed by the selected AI provider under that provider's policies.
- Never place OAuth client secrets, signing keys, user access tokens or other credentials in this public frontend repository. The browser client is a public PKCE client and must not contain a client secret.

### Legal pages and privacy-sensitive changes
- `index.html` is the public landing page; `terms.html` and `privacy.html` are user-facing legal disclosures. Update them when authentication, browser storage, third-party providers, AI/MCP capabilities, data retention or account deletion behavior changes.
- Authentication is Google federated sign-in through `https://auth.ikoyski.top`; the frontend does not collect Google passwords.
- Keep the Privacy Policy's browser-storage details aligned with `src/js/auth.js`: `kanban-auth` in local storage contains the access token and expiry; `kanban-auth-pending` in session storage contains temporary PKCE verifier/state and return-search state during authorization.
- The current account-deletion process is manual by email to `admin@ikoyski.top`. Do not document self-service deletion until it is implemented and deployed.
- Do not state that a provider or feature (for example email delivery, CAPTCHA/Turnstile, analytics, or avatar generation) is active unless verified in the current frontend, backend/auth configuration and deployed infrastructure.
- Legal copy should describe actual behavior, avoid guarantees about immediate backup erasure or provider retention, and receive appropriate legal review. Do not present documentation edits as legal certification.

### Landing page authentication indicator
- The landing page sign-in indicator reads `kanban-auth` from local storage. Keep its expected shape aligned with `auth.js` (`accessToken` and `expiresAt`) and avoid reviving the legacy `kanban-token` key.
