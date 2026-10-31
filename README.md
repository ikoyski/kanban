# Kanban

A modern, responsive Kanban board implementation featuring drag-and-drop functionality, dark mode support, and REST API persistence.

## Features

- **Authentication**: Sign in with your Google account. Sign-in happens on a separate auth server (OAuth 2.0 authorization code flow with PKCE); the app never sees a password. New people are created the first time they sign in.
- **User Profile**: Personalized experience with display names and avatars.
- **Multi-Board Support**: Create, rename, and switch between multiple Kanban boards.
- **Collaborative Access**: Invite members to boards with role-based permissions (Owner, Editor, Viewer).
- **Drag and Drop**: Easily move cards between columns using SortableJS (available for Owners and Editors).
- **Dark Mode**: Seamlessly switch between light and dark themes.
- **REST API**: Your boards and cards are persisted in a PostgreSQL database via a REST API.
- **Responsive Design**: Works on desktops, tablets, and mobile devices.
- **Card Management**: Add, edit, and delete cards with priority levels, due dates, custom labels, and rich-text (WYSIWYG) descriptions.
- **Rich-Text Comments**: Card comments support the same WYSIWYG formatting (bold, lists, links, code blocks, etc.) as descriptions.
- **Column Management**: Create new columns, rename existing ones, and delete columns with an integrated card transfer mechanism to prevent data loss.
- **Optimistic UI**: Instant visual feedback for actions like moving cards, with background synchronization to the API.
- **Data Portability**: Export your entire board state to a JSON file and import it back to restore your data or move it between browsers.
- **Search Function**: Quickly filter cards across all columns by keyword (title, description, or labels).
- **AI Assistant Integration (MCP)**: Connect compatible assistants such as Google Gemini, Anthropic Claude, and OpenAI ChatGPT where available. Authorized assistants can use supported Kanban tools to list boards, inspect and manage columns/cards, move tasks, and work with comments using the user's existing permissions.

## Project Structure

```text
.
├── index.html          # Landing page and AI/MCP feature overview (links to the app)
├── kanban.html         # The app: auth screens, board layout
├── privacy.html        # Privacy Policy, including OAuth and AI/MCP data disclosures
├── terms.html          # Terms of Use, including AI/MCP integration terms
├── CLAUDE.md           # AI development guidance
├── README.md           # Project documentation
├── LICENSE             # License information
└── src/
    ├── css/
    │   └── style.css    # Custom styles complementing Tailwind CSS
    └── js/
        ├── app.js       # Main application controller (KanbanApp class)
        ├── api.js         # REST API client for data persistence (ApiClient class)
        ├── auth.js      # Sign-in with the auth server (OAuth 2.0 code flow + PKCE) and token handling
        ├── ui.js        # UI rendering and DOM manipulation (UI object)
        └── editor.js    # WYSIWYG editor: Quill wrapper + HTML sanitizing/rendering helpers
```

## Tech Stack

- **HTML5**
- **Tailwind CSS** (via CDN)
- **JavaScript (ES6 Modules)**
- **SortableJS** (for drag-and-drop)
- **Quill** (WYSIWYG rich-text editor for card descriptions and comments)
- **DOMPurify** (sanitizes rich-text HTML before it's rendered)
- **OAuth 2.0 + PKCE** (Google sign-in through the auth server)

## Rich Text (WYSIWYG)

Card descriptions and comments are edited with a [Quill](https://quilljs.com/) editor (bold,
italic, underline, strike, ordered/unordered lists, blockquote, inline code, code block, and
links). `src/js/editor.js` is the only module that talks to Quill/DOMPurify directly:

- `createRichEditor()` mounts an editor and returns `getHtml()` / `setHtml()` / `isEmpty()`.
- Saved content is a small, fixed subset of HTML (`normalizeEditorHtml`) — Quill's internal
  markup (e.g. `data-list` attributes, code-block containers) is converted to plain `<ul>/<ol>`
  and `<pre><code>` before it's sent to the API.
- Anything rendered back to the page — descriptions, comments, both from this API and from
  older plain-text data — goes through `toDisplayHtml()`, which runs DOMPurify with a fixed
  allow-list (`p, br, h1-h3, strong/b, em/i, u, s, code, pre, blockquote, ul/ol/li, a`, `href`
  only). Legacy plain-text content (saved before this feature existed) is detected and
  rendered as plain paragraphs rather than raw HTML.
- Card previews, the archived-cards list, and the search box use `toPlainText()`, a flattened,
  tag-free version of the content, so list views never show markup.
- The API itself stores and returns `description`/`content` as opaque strings — it does not
  know or care whether they're HTML. All sanitization happens client-side, at render time, so
  it stays effective even if the HTML in storage is ever edited directly or written by another
  client (see the backend's `CLAUDE.md`/`README.md` for the storage side of this).

## Getting Started

No installation or build process is required. Open `index.html` for the landing page, or `kanban.html` to go straight to the app.

## Development

This is a vanilla JavaScript project. Since it uses ES6 modules and CDN-hosted dependencies, it can be run directly from the filesystem or a simple local server.

- **Styling**: All layouts are built with Tailwind CSS.
- **State**: The application state is maintained as a central object and synchronized with a REST API.
- **Interactions**: UI events are handled via a mix of direct listeners and custom browser events.

## Screenshots

<img width="978" height="567" alt="kanban-darkmode" src="https://github.com/user-attachments/assets/4133b1c9-ab2a-4c53-8409-cba356ff90a4" />
<img width="980" height="567" alt="kanban-lightmode" src="https://github.com/user-attachments/assets/82134587-d91b-4054-82b9-b3da98e4d7bd" />
<img width="2720" height="2016" alt="kanban_current_architecture_v2" src="https://github.com/user-attachments/assets/a03d096e-1edf-443d-ac43-cd6fde980d2d" />
<img width="2720" height="1440" alt="kanban_platform_infrastructure_current" src="https://github.com/user-attachments/assets/1b6d0368-e801-4e8a-9fb9-ff8c2aecedfd" />


## Authentication and API Architecture

This repository contains the browser-based frontend only. Authentication and Kanban data APIs are provided by separate services:

- **Authentication server**: `https://auth.ikoyski.top`. The frontend uses the pre-registered public OAuth client `kanban-web` with the authorization-code flow and PKCE. Google sign-in is handled by the authentication server; the frontend does not collect Google passwords.
- **Kanban API**: `https://api.ikoyski.top/kanban-backend`. The frontend calls versioned endpoints under `/v1/...` and sends the OAuth access token as a Bearer token. The backend remains responsible for authorization and persistence.
- **Browser token storage**: the access token and expiry are stored in local storage under `kanban-auth`. The temporary PKCE verifier and OAuth state are stored in session storage under `kanban-auth-pending` while the sign-in redirect is in progress. The profile is loaded from the authenticated API rather than decoded from the access token.

The frontend is not the MCP server. MCP support is provided by the separate Kanban MCP service, which validates the user's access token and forwards authorized operations to the Kanban API. The MCP service is designed to be stateless; it does not replace the backend's authorization checks or use a shared user identity. The available tools depend on the MCP service version and the connected AI client.

## AI Assistant Integrations

Users can connect supported AI clients, including Google Gemini, Anthropic Claude and OpenAI ChatGPT where available, to the separate MCP endpoint. After authorization, an assistant can invoke the MCP tools exposed by the service. These may include listing boards, reading board details, creating or updating cards, moving cards, managing columns, archiving/restoring cards and working with comments.

AI operations are performed with the user's authorization and are subject to the user's existing Kanban permissions. Prompts and Kanban information shared with an assistant may be processed by that AI provider under its own terms and privacy policy. See [Privacy Policy](privacy.html) and [Terms of Use](terms.html) for the user-facing disclosures.

## Legal and Privacy Documentation

Keep `terms.html` and `privacy.html` consistent with the actual deployed services and data flows. In particular:

- Describe Google federated sign-in, not local Kanban password registration.
- Do not claim the frontend receives or stores Google passwords.
- Keep browser storage disclosures aligned with `src/js/auth.js`.
- Disclose MCP/AI assistant data processing and name currently supported providers accurately.
- Account deletion is currently a manual request to `admin@ikoyski.top`; do not describe it as an available self-service feature.
- Do not claim that third-party services, email delivery, analytics, CAPTCHA or other infrastructure are in use unless verified against the deployed configuration.

