import ApiClient from './api.js';
import * as Auth from './auth.js';
import { UI } from './ui.js';
import { AppEvents } from './app/events.js';
import { BoardInteractions } from './app/board-interactions.js';
import { CardActions } from './app/card-actions.js';
import { DataTransfer } from './app/data-transfer.js';

class KanbanApp {
    constructor() {
        this.settings = {};
        this.state = null;
        this.boards = [];
        this.currentBoardId = null;
        this.currentRole = null;
        this.currentBoardName = null;
    }

    async start() {
        // Load theme from localStorage if available
        const savedTheme = localStorage.getItem('kanban-theme');
        if (savedTheme) {
            this.settings.theme = savedTheme;
        }
        UI.setTheme(this.settings.theme);

        this.setupAuthListeners();

        // Coming back from the auth server (?code=...): finish the sign-in first.
        let signInError = null;
        try {
            await Auth.handleRedirectCallback();
        } catch (error) {
            console.error('Sign-in failed:', error);
            signInError = error.message;
        }

        // A landing-page sign-in link can skip the app's intermediate auth screen.
        // Consume the one-shot flag before starting OAuth so it is not restored after the callback.
        const params = new URLSearchParams(window.location.search);
        const directSignIn = params.get('signin') === '1';
        if (params.has('signin')) {
            params.delete('signin');
            const query = params.toString();
            history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash);
        }

        if (!this.checkAuth() && directSignIn && !signInError) {
            try {
                await Auth.startLogin();
                return;
            } catch (error) {
                console.error('Could not start sign-in:', error);
                signInError = error.message;
            }
        }

        if (this.checkAuth()) {
            try {
                await this.loadProfile();
                this.boards = await ApiClient.getBoards();
                await this.resolveActiveBoard();
            } catch (error) {
                console.error('Failed to load boards:', error);
                if (!this.checkAuth()) {
                    this.handleSessionExpired();
                } else {
                    alert('Failed to load your boards from the server. Please refresh the page.');
                }
            }
        } else {
            this.switchView('auth');
            const expired = sessionStorage.getItem('kanban-session-expired');
            sessionStorage.removeItem('kanban-session-expired');
            this.showAuthMessage(signInError || (expired ? 'Your session has expired. Please sign in again.' : null));
        }
    }

    checkAuth() {
        return Auth.isSignedIn();
    }

    // The profile (name, avatar) comes from the API, not from the token.
    async loadProfile() {
        const me = await ApiClient.getMe();
        localStorage.setItem('kanban-user', JSON.stringify({
            email: me.email,
            displayName: me.displayName || me.email,
            avatarUrl: me.avatarUrl,
        }));
    }

    showAuthMessage(message) {
        const el = document.getElementById('auth-message');
        if (!el) return;
        el.textContent = message || '';
        el.classList.toggle('hidden', !message);
    }

    switchView(view) {
        if (view === 'board') {
            UI.appAuthView.classList.add('hidden');
            UI.appBoardView.classList.remove('hidden');
        } else {
            UI.appAuthView.classList.remove('hidden');
            UI.appBoardView.classList.add('hidden');
        }
    }

    async resolveActiveBoard() {
        const params = new URLSearchParams(window.location.search);
        const boardParam = params.get('board');
        const storedBoardId = localStorage.getItem('kanban-active-board');

        let activeId = null;

        if (boardParam && this.boards.some(b => b.id === boardParam)) {
            activeId = boardParam;
        } else if (storedBoardId && this.boards.some(b => b.id === storedBoardId)) {
            activeId = storedBoardId;
        } else if (this.boards.length > 0) {
            activeId = this.boards[0].id;
        }

        if (activeId) {
            await this.loadBoard(activeId);
        } else {
            this.showEmptyState();
        }
    }

    async loadBoard(boardId) {
        try {
            const boardData = await ApiClient.getBoard(boardId);
            this.state = boardData;
            this.currentBoardId = boardId;
            this.currentRole = boardData.role;
            this.currentBoardName = boardData.name;

            localStorage.setItem('kanban-active-board', boardId);
            this.updateUrl(boardId);
            this.switchView('board');
            this.init();
        } catch (error) {
            console.error(`Failed to load board ${boardId}:`, error);
            if (error.message.includes('401')) {
                this.handleSessionExpired();
            } else if (error.message.includes('403')) {
                alert('You don\'t have permission to access this board.');
                this.resolveActiveBoard(); // Try to find another valid board
            } else {
                alert('Failed to load board from server. Please refresh the page.');
            }
        }
    }

    updateUrl(boardId) {
        const params = new URLSearchParams(window.location.search);
        params.set('board', boardId);
        const newUrl = `${window.location.pathname}?${params.toString()}`;

        // Use replaceState on first load, pushState on manual switches
        // For simplicity in this method, we'll use replaceState.
        // The manual switch handler will call pushState.
        history.replaceState(null, '', newUrl);
    }

    showEmptyState() {
        this.switchView('board');
        UI.renderEmptyState();

        // init() fills in the header, but it only runs once a board is loaded, so do it here too:
        // a new account starts with no boards and must still see its own name and avatar.
        const user = JSON.parse(localStorage.getItem('kanban-user') || '{}');
        UI.updateUserHeader(user, null);
        UI.renderBoardSwitcher(this.boards, null);

        this.setupEventListeners();
    }

    init() {
        // Initial Render
        this.renderAndBind();

        // Setup user profile in header
        const user = JSON.parse(localStorage.getItem('kanban-user') || '{}');
        UI.updateUserHeader(user, this.currentRole);

        this.setupEventListeners();
        UI.renderBoardSwitcher(this.boards, this.currentBoardId);
    }

    setupAuthListeners() {
        // Popstate listener for browser back/forward
        window.addEventListener('popstate', async () => {
            const params = new URLSearchParams(window.location.search);
            const boardId = params.get('board');
            if (boardId && boardId !== this.currentBoardId) {
                await this.loadBoard(boardId);
            }
        });

        // The token is missing, expired or rejected (401)
        window.addEventListener('auth-expired', () => this.handleSessionExpired());
    }

    async createBoard() {
        // Using a temporary element to trigger startInlineEdit for board creation is tricky.
        // Let's stick to prompt for creation, or implement a specific "Create Board" inline flow.
        // The plan specifically mentions Board RENAME as inline.
        const name = prompt('Enter board name:');
        if (name && name.trim()) {
            try {
                const newBoard = await ApiClient.createBoard(name.trim());
                this.boards.push(newBoard);
                await this.loadBoard(newBoard.id);
                UI.renderBoardSwitcher(this.boards, this.currentBoardId);
            } catch (error) {
                alert('Failed to create board: ' + error.message);
            }
        }
    }

    handleLogout() {
        Auth.logout();
    }

    // The token is missing, expired or no longer accepted: forget it and show the sign-in screen.
    handleSessionExpired() {
        if (this.sessionExpiredHandled) return;   // several in-flight requests can fail at once
        this.sessionExpiredHandled = true;
        Auth.clearSession();
        sessionStorage.setItem('kanban-session-expired', '1');
        window.location.replace('kanban.html');
    }

    // Single entry point for re-rendering the board. renderBoard() rebuilds every column/card
    // element, which drops the SortableJS bindings, so they must be re-attached each time.
    // Always use this instead of calling UI.renderBoard() directly.
}

// Keep the controller focused on startup, identity and board lifecycle.
// Feature methods are mixed into the same prototype to preserve existing `this` behavior.
Object.assign(KanbanApp.prototype, AppEvents, BoardInteractions, CardActions, DataTransfer);

async function initializeKanbanApp() {
    const app = new KanbanApp();
    await app.start();
}

// bootstrap.js loads HTML partials before importing this module. That fetch can
// finish after DOMContentLoaded has already fired, so support both startup states.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeKanbanApp, { once: true });
} else {
    initializeKanbanApp();
}
