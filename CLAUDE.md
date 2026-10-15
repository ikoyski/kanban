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
- `src/js/api.js`: Data persistence layer (`ApiClient` class). Handles communication with the REST API backend.
- `src/js/ui.js`: UI rendering and DOM manipulation layer (`UI` object). Handles board rendering, modal controls, and theme switching.
- `reset-password.html`: Standalone page (own inline module script, imports `api.js`) that the backend's reset email links to as `reset-password.html?token=...`. It reads the token once, strips it from the URL, and calls `ApiClient.resetPassword`. The backend's `webtools.frontend.reset-password-url` (Config Server) must point at this file's deployed URL.
- `src/js/editor.js`: WYSIWYG rich-text support. Wraps Quill (`createRichEditor`) and provides the sanitize/normalize/plain-text helpers (`sanitizeHtml`, `toDisplayHtml`, `toPlainText`, `normalizeEditorHtml`) used anywhere card `description` or comment `content` is read, written, or displayed.

### State Management
- State is maintained as a central object within the `KanbanApp` instance.
- The app supports multi-board functionality; `currentBoardId` and `currentRole` are tracked to manage access and persistence.
- State includes `columns` (mapping column IDs to lists of card IDs), `cards` (mapping card IDs to card data), and `settings` (e.g., theme).
- State changes are persisted via `ApiClient` to a REST API backend, using optimistic updates for a snappy UI.
- **Authentication**: Users are authenticated via JWTs stored in `localStorage`. Session state is checked on startup and before board initialization.
- **Role-Based Access Control (RBAC)**: The app enforces roles (`OWNER`, `EDITOR`, `VIEWER`). Mutating actions and certain UI elements are gated based on the current board role.

### Auth screen
- `kanban.html` has three cards in `#app-auth-view`: login, signup, forgot password. Each form has its own Cloudflare Turnstile widget, so always read the token with `app.getTurnstileToken(form)` (scoped to that form) — never `turnstile.getResponse()` or a global `querySelector` — and call `resetTurnstile(form)` after a submit that consumed the token.

- Change Password lives in `#change-password-modal` (opened from the profile menu's `#change-password-menu`, `PATCH /v1/auth/password`). A wrong current password comes back as HTTP 400 (not 401), so it's shown inline and does not trigger the `auth-expired` logout.
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
- **Cloudflare Turnstile**: Provides bot protection for authentication forms.

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
