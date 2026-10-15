# Kanban

A modern, responsive Kanban board implementation featuring drag-and-drop functionality, dark mode support, and REST API persistence.

## Features

- **Authentication**: Secure user accounts with Login, Signup, and session persistence.
- **Password Reset**: "Forgot password?" on the sign-in screen emails a reset link (Turnstile-protected); the link opens `reset-password.html`, where the user chooses a new password.
- **Change Password**: Signed-in users can change their password from the profile menu (current password + new password, min. 8 characters).
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
- **Bot Protection**: Integration with Cloudflare Turnstile to secure Login and Signup forms against automated attacks.
- **Data Portability**: Export your entire board state to a JSON file and import it back to restore your data or move it between browsers.
- **Search Function**: Quickly filter cards across all columns by keyword (title, description, or labels).

## Project Structure

```text
.
├── index.html          # Landing page (links to the app)
├── kanban.html         # The app: auth screens, board layout
├── privacy.html        # Privacy Policy
├── terms.html          # Terms of Use
├── reset-password.html # Standalone page opened from the password-reset email (?token=...)
├── CLAUDE.md           # AI development guidance
├── README.md           # Project documentation
├── LICENSE             # License information
└── src/
    ├── css/
    │   └── style.css    # Custom styles complementing Tailwind CSS
    └── js/
        ├── app.js       # Main application controller (KanbanApp class)
        ├── api.js         # REST API client for data persistence (ApiClient class)
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
- **Cloudflare Turnstile** (for bot protection)

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

