# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands
- **Run App**: Serve the repository over HTTP (for example, `python -m http.server 8000`) and open `http://localhost:8000/kanban.html`. The app loads HTML partials with `fetch()`, so do not open `kanban.html` using `file://`. The static landing/legal pages can still be opened directly, but using the local server is recommended.
- **Build/Test**: No build step is required. Playwright E2E tests run with `npm run test:e2e` (Node.js 22+); install browser dependencies with `npx playwright install chromium` first. The HTML partial loader has no framework or build-time dependency.

## Architecture and Structure
The project is a vanilla JavaScript implementation of a Kanban board using ES6 modules.

### Core Components
- `privacy.html`, `terms.html`: Static legal pages (contact email is set in each file; keep them in sync with what the app and backend actually collect).
- `kanban.html`: The app's entry-point shell. It contains component placeholders and the dynamic board container; keep it lightweight and preserve the existing URL.
- `src/components/`: Static HTML partials loaded at runtime. `auth-view.html`, `app-header.html`, `profile-menu.html`, and `board-toolbar.html` compose the main app shell. `src/components/modals/` contains the create-card, card-detail, About, members, archived-card and confirmation modal markup.
- `src/js/partial-loader.js`: Fetches and inserts `data-include` HTML partials, including nested placeholders.
- `src/js/bootstrap.js`: Loads all partials, then initializes the DOM map and focused UI modules, then installs security/editor-lifecycle decorators, and only then imports `app.js`.
- `src/js/ui.js`: Stable UI facade with only shared editor state (`descriptionEditor`, `commentEditor`). It should not contain rendering methods or capture DOM elements.
- `src/js/ui/dom.js`: Captures shared DOM references after partials have loaded and attaches them to the `UI` facade.
- `index.html`: Static landing page (Tailwind + a small SortableJS sample board). It links to `kanban.html` and forwards old `?board=` deep links there.
- `src/css/style.css`: Custom styles (complements Tailwind CSS).
- `src/js/app.js`: Main application controller (`KanbanApp` class). Owns startup, authentication lifecycle, active-board selection and board loading.
- `src/js/app/events.js`: Installs DOM and custom-event listeners. Methods are mixed into `KanbanApp.prototype` so existing handler `this` references remain valid.
- `src/js/app/board-interactions.js`: Board rendering, SortableJS setup, column/card reordering and card filtering.
- `src/js/app/card-actions.js`: Card creation, detail-modal editing, comments, deletion and archive/restore workflows.
- `src/js/app/data-transfer.js`: Board JSON import/export workflows.
- `src/js/api.js`: Data persistence layer (`ApiClient` class). Handles communication with the REST API backend; every request carries the access token from `auth.js`.
- `src/js/auth.js`: Sign-in with the auth server: OAuth 2.0 authorization code flow with PKCE, token storage, sign-out. No UI code in it.
- `src/js/ui/board-view.js`: Board-level rendering, board controls and empty-board state.
- `src/js/ui/board-cards.js`: Column and card markup/rendering; receives already-escaped plain-text values through the `ui-security.js` decorator.
- `src/js/ui/app-state.js`: Theme switching and card-count UI updates.
- `src/js/ui/modals.js`: Add-card, confirmation, About, delete-column and archive modal lifecycle.
- `src/js/ui/members.js`: Profile header and member-list UI.
- `src/js/ui/content-renderers.js`: Board switcher, comments and archived-card rendering.
- `src/js/ui/inline-edit.js`: Plain-text and rich-text inline editing implementations.
- `src/js/ui/card-detail.js`: Card detail modal rendering, edit/archive/delete callbacks and comment composer.
- `src/js/ui-security.js`: Decorates the active UI renderers to escape untrusted plain-text fields while retaining the editor.js sanitizer for rich text.
- `src/js/ui-edit-preservation.js`: Wraps inline editors so failed saves retain their contents and allow retry/cancel.
- `src/js/ui-editor-lifecycle.js`: Destroys the active comment editor before detail modal replacement or close.
- `src/js/editor.js`: WYSIWYG rich-text support. Wraps Quill (`createRichEditor`) and provides the sanitize/normalize/plain-text helpers (`sanitizeHtml`, `toDisplayHtml`, `toPlainText`, `normalizeEditorHtml`) used anywhere card `description` or comment `content` is read, written, or displayed.

### State Management
- State is maintained as a central object within the `KanbanApp` instance.
- The app supports multi-board functionality; `currentBoardId` and `currentRole` are tracked to manage access and persistence.
- State includes `columns` (mapping column IDs to lists of card IDs), `cards` (mapping card IDs to card data), and `settings` (e.g., theme).
- State changes are persisted via `ApiClient` to a REST API backend, using optimistic updates for a snappy UI.
- Feature methods are exported as plain-object mixins and attached to `KanbanApp.prototype` in `app.js`; preserve their `this` semantics when moving methods between modules. Keep the controller's startup and board lifecycle in `app.js`.
- **Authentication**: People sign in with Google or GitHub on the auth server (`https://auth.ikoyski.top`); this app never handles a password. `auth.js` runs the authorization code flow with PKCE as the public client `kanban-web` and keeps the access token in `localStorage` (`kanban-auth`). The profile (name, avatar) comes from `GET /v1/users/me`, not from the token. Spring Authorization Server issues no refresh tokens to public clients, so the token is a single longer-lived access token (default 8 hours); when it expires or the API answers 401, `handleSessionExpired()` clears it and shows the sign-in screen, and signing in again is one click.
- **Member avatars**: `GET /v1/boards/{boardId}/members` supplies each member's `avatarUrl`; the members modal should prefer that profile image and use the generated avatar only as a fallback.
- **Role-Based Access Control (RBAC)**: The app enforces roles (`OWNER`, `EDITOR`, `VIEWER`). Mutating actions and certain UI elements are gated based on the current board role.

### Auth screen
- `src/components/auth-view.html` supplies `#app-auth-view`, including `#signin-card`, the provider-neutral "Continue to sign in" button (`#signin-btn`) and the `#auth-message` area for sign-in errors and session expiry. The component is loaded before `app.js`. The page must be served at the redirect URI registered for the client (`redirectUri()` in `auth.js` resolves `kanban.html` relative to the current page; the auth server's `AUTH_WEB_REDIRECT_URIS` must list that exact URL).

### HTML partial loading rules
- Keep the existing DOM IDs and expected element nesting stable unless updating all consumers intentionally. `ui.js` binds to these IDs during module evaluation.
- `kanban.html` uses `data-include="src/components/…"` placeholders. Nested includes are supported; for example, `app-header.html` includes `profile-menu.html`.
- Always load all partials through `src/js/bootstrap.js` before importing `src/js/app.js`. Do not point `kanban.html` directly at `app.js`, and do not move the app import ahead of `loadPartials()`.
- Keep dynamic board, column, card, member, and card-detail content in the focused `src/js/ui/` modules; only static page markup belongs in HTML partials. The card-detail modal content is generated by `UI.openCardDetail()` in `ui/card-detail.js`, while the outer `#card-detail-modal` and `#card-detail-body` shell live in `card-detail-modal.html`.
- Partials are fetched from the same origin and must be deployed alongside `kanban.html` under the same `/kanban/` base path.

- API validation errors are shaped `{ field: "message" }` with no `message` key; `ApiClient.request` joins those values into the thrown error message.

### UI Interaction Patterns
- **DOM Access**: `ui/dom.js` centralizes common DOM references and attaches them to the `UI` facade only after all HTML partials have loaded.
- **Communication**: The project uses an event-driven approach for UI-to-App communication. The `UI` layer often dispatches `CustomEvent` objects on the `window` object to signal actions that require state changes.
    - Example events: `open-card-modal`, `rename-column`, `delete-column`, `auth-expired`.
- **Rendering**: The board is re-rendered via `UI.renderBoard(state)` in `ui/board-view.js` whenever a significant state change occurs, followed by a re-initialization of SortableJS. UI modules install their implementation methods on the shared `UI` facade with `Object.assign`; preserve the existing method names and `this` semantics when moving code.

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
- **Public sign-in copy**: `index.html` should state that Google and GitHub are supported sign-in providers. Keep `terms.html` and `privacy.html` aligned with the providers actually enabled on the auth server.
- Authentication uses configured federated providers through `https://auth.ikoyski.top` (currently Google and GitHub); the frontend does not collect provider passwords.
- Keep the Privacy Policy's browser-storage details aligned with `src/js/auth.js`: `kanban-auth` in local storage contains the access token and expiry; `kanban-auth-pending` in session storage contains temporary PKCE verifier/state and return-search state during authorization.
- The current account-deletion process is manual by email to `admin@ikoyski.top`. Do not document self-service deletion until it is implemented and deployed.
- Do not state that a provider or feature (for example email delivery, CAPTCHA/Turnstile, analytics, or avatar generation) is active unless verified in the current frontend, backend/auth configuration and deployed infrastructure.
- Legal copy should describe actual behavior, avoid guarantees about immediate backup erasure or provider retention, and receive appropriate legal review. Do not present documentation edits as legal certification.

### Landing page authentication indicator
- The landing page sign-in indicator reads `kanban-auth` from local storage. Keep its expected shape aligned with `auth.js` (`accessToken` and `expiresAt`) and avoid reviving the legacy `kanban-token` key.


### Browser regression tests
- Use Playwright for end-to-end regression coverage; keep the frontend vanilla JavaScript and do not add a frontend framework or build step just for testing.
- Run `npm install`, `npx playwright install chromium`, then `npm run test:e2e` (Node.js 22+). The Playwright config starts a small static HTTP server; do not test the app through `file://` because component partials are loaded with `fetch`.
- Tests stub Tailwind/SortableJS/Quill/DOMPurify CDN dependencies and mock `auth.ikoyski.top` plus `api.ikoyski.top`. Never use real Google or GitHub credentials, production tokens or live user data in automated tests.
- Keep API fixtures representative of the current backend DTOs and assert Bearer authorization is sent. Update the fixtures when API contracts intentionally change.
- The GitHub Actions workflow `.github/workflows/playwright.yml` runs Chromium E2E tests on pushes and pull requests to `master`. Inspect the Playwright HTML report and trace artifacts for failures.
- Current coverage includes OAuth/PKCE initiation and callback handling, board startup/search, card title and priority edits, create/delete, comment submission, cross-column move persistence through the mocked SortableJS `onEnd` callback, archive/restore, member invitation/removal, viewer-role UI restrictions, board JSON import/export, board switching and dark mode.
- The move test invokes SortableJS's callback directly; it does not yet validate a real pointer-driven drag gesture. Viewer tests verify frontend controls and handlers only; they do not replace backend authorization tests. Extend coverage for real drag gestures and MCP integration as those flows are stabilized. Do not claim those flows are covered until tests exist.
