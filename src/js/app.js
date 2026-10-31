import ApiClient from './api.js';
import * as Auth from './auth.js';
import { UI } from './ui.js?v=20261101-members-avatar-fix';
import { toPlainText } from './editor.js';

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

    setupEventListeners() {
        // Board Switcher
        UI.boardSwitcher.onchange = async (e) => {
            const newBoardId = e.target.value;
            if (newBoardId && newBoardId !== this.currentBoardId) {
                const params = new URLSearchParams(window.location.search);
                params.set('board', newBoardId);
                history.pushState(null, '', `${window.location.pathname}?${params.toString()}`);
                await this.loadBoard(newBoardId);
            }
        };

        // Board Rename handler
        UI.renameBoardBtn.onclick = async () => {
            if (this.currentRole === 'VIEWER') {
                alert('You do not have permission to rename the board.');
                return;
            }

            const boardNameEl = document.getElementById('board-name');
            // We want to edit the actual name, not the (owned/can edit/view only) suffix
            const currentName = this.currentBoardName;

            await UI.startInlineEdit(boardNameEl, {
                value: currentName,
                onSave: async (newName) => {
                    const trimmedName = newName.trim();
                    if (!trimmedName) throw new Error('Board name cannot be empty');

                    const oldName = this.currentBoardName;
                    // Optimistic update
                    this.currentBoardName = trimmedName;
                    this.state.name = trimmedName;
                    this.renderAndBind();

                    try {
                        await ApiClient.renameBoard(this.currentBoardId, trimmedName);
                    } catch (error) {
                        // Rollback
                        this.currentBoardName = oldName;
                        this.state.name = oldName;
                        this.renderAndBind();
                        throw error;
                    }
                }
            });
        };

        // Create Board
        UI.createBoardBtn.onclick = async () => {

            await this.createBoard();
        };

        // Empty State Create Board Trigger
        window.addEventListener('create-board-trigger', async () => {
            await this.createBoard();
        });

        // Members Modal
        UI.membersMenu.onclick = async (e) => {
            e.stopPropagation();
            try {
                const members = await ApiClient.getMembers(this.currentBoardId);
                UI.openMembersModal(members, this.currentRole);
            } catch (error) {
                alert('Failed to load members: ' + error.message);
            }
            UI.menuDropdown.classList.add('hidden');
        };

        // Handle Member Invitations
        UI.inviteMemberForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = UI.inviteEmail.value;
            const role = UI.inviteRole.value;
            try {
                await ApiClient.addMember(this.currentBoardId, email, role);
                // Refresh members list
                const members = await ApiClient.getMembers(this.currentBoardId);
                UI.openMembersModal(members, this.currentRole);
                UI.inviteEmail.value = '';
            } catch (error) {
                alert('Failed to invite member: ' + error.message);
            }
        };

        // Handle Member Removal
        UI.membersList.onclick = async (e) => {
            const removeBtn = e.target.closest('button[data-user-id]');
            if (removeBtn) {
                const userId = removeBtn.dataset.userId;
                if (!confirm('Are you sure you want to remove this member?')) return;
                try {
                    await ApiClient.removeMember(this.currentBoardId, userId);
                    const members = await ApiClient.getMembers(this.currentBoardId);
                    UI.openMembersModal(members, this.currentRole);
                } catch (error) {
                    alert('Failed to remove member: ' + error.message);
                }
            }
        };

        // Menu Toggle
        UI.menuToggle.onclick = (e) => {
            e.stopPropagation();
            UI.menuDropdown.classList.toggle('hidden');
        };

        // Theme Toggle from Menu
        UI.themeToggleMenu.onclick = (e) => {
            e.stopPropagation();
            if (!this.settings.theme) {
                this.settings.theme = 'light';
            }
            const newTheme = this.settings.theme === 'light' ? 'dark' : 'light';
            this.settings.theme = newTheme;
            UI.setTheme(newTheme);
            localStorage.setItem('kanban-theme', newTheme);
            UI.menuDropdown.classList.add('hidden');
        };

        // About Menu
        UI.aboutMenu.onclick = (e) => {
            e.stopPropagation();
            UI.openAboutModal();
            UI.menuDropdown.classList.add('hidden');
        };

        // Export Menu
        UI.exportMenu.onclick = (e) => {
            e.stopPropagation();
            this.exportData(this.currentBoardId);
            UI.menuDropdown.classList.add('hidden');
        };

        // Import Menu
        UI.importMenu.onclick = (e) => {
            console.log('this.currentBoardId: '+this.currentBoardId);
            e.stopPropagation();
            UI.importFile.click();
            UI.menuDropdown.classList.add('hidden');
        };

        // Import File Change
        UI.importFile.onchange = (e) => {
            console.log('this.currentBoardId: '+this.currentBoardId);
            const file = e.target.files[0];
            if (file) {
                this.importData(this.currentBoardId, file);
            }
            UI.importFile.value = ''; // Reset input
        };

        // Add Column handler
        UI.addColumnMenu.onclick = async (e) => {
            e.stopPropagation();
            const newName = prompt('Enter new column name:');
            if (newName !== null && newName.trim() !== '') {
                try {
                    const newColumn = await ApiClient.createColumn(newName.trim(), this.state.id);
                    this.state.columns[newColumn.id] = newColumn;
                    this.renderAndBind();
                } catch (error) {
                    alert('Failed to create column: ' + error.message);
                }
            }
            UI.menuDropdown.classList.add('hidden');
        };

        // Archived Cards Menu
        document.getElementById('archived-cards-menu').onclick = async (e) => {
            e.stopPropagation();
            UI.menuDropdown.classList.add('hidden');
            await this.openArchivedCardsModal();
        };

        // Close Archived Cards Modal
        document.getElementById('close-archived-modal').onclick = () => UI.closeArchivedModal();

        // Close Archived Cards Modal when clicking outside
        document.getElementById('archived-cards-modal').onclick = (e) => {
            if (e.target.id === 'archived-cards-modal') UI.closeArchivedModal();
        };

        // Logout Handler
        UI.logoutMenu.onclick = (e) => {
            e.stopPropagation();
            this.handleLogout();
        };

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!UI.menuDropdown.contains(e.target) && e.target !== UI.menuToggle) {
                UI.menuDropdown.classList.add('hidden');
            }
        });

        // Close members modal when clicking outside
        UI.membersModal.onclick = (e) => {
            if (e.target === UI.membersModal) {
                UI.closeMembersModal();
            }
        };

        // About Modal Controls
        UI.closeAboutModalBtn.onclick = () => UI.closeAboutModal();
        UI.aboutOkBtn.onclick = () => UI.closeAboutModal();

        // Close members modal via button
        UI.closeMembersModalBtn.onclick = () => UI.closeMembersModal();

        // Modal Controls
        document.getElementById('close-modal').onclick = () => UI.closeModal();
        document.getElementById('cancel-modal').onclick = () => UI.closeModal();

        // Modal Open Event
        window.addEventListener('open-card-modal', (e) => {
            const { columnId } = e.detail;
            UI.openModal('Add New Card', columnId);
        });

        // Form Submit
        UI.cardForm.onsubmit = (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        };

        // Confirm Modal Controls
        document.getElementById('confirm-cancel').onclick = () => UI.closeConfirm();
        document.getElementById('confirm-delete').onclick = () => this.handleDelete();

        // Card Clicks (Delete/Detail). Editing happens inline in the detail modal.
        UI.boardContainer.onclick = (e) => {
            const deleteBtn = e.target.closest('.delete-btn');
            const cardEl = e.target.closest('.card');

            if (deleteBtn && cardEl) {
                const cardId = cardEl.dataset.cardId;
                this.pendingDeleteId = cardId;
                UI.openConfirm(cardId);
            } else if (cardEl) {
                // Open the detail view (all card edits happen there)
                const cardId = cardEl.dataset.cardId;
                this.handleOpenCardDetail(cardId);
            }
        };

        // Search functionality
        document.getElementById('search-input').oninput = (e) => {
            const term = e.target.value.toLowerCase();
            this.filterCards(term);
        };

        // Accessibility: ESC key to close modals
        window.onkeydown = (e) => {
            if (e.key === 'Escape') {
                UI.closeModal();
                UI.closeConfirm();
            }
        };

        // Rename Column handler
        window.addEventListener('rename-column', async (e) => {
            const { columnId } = e.detail;
            const column = this.state.columns[columnId];

            const colEl = document.getElementById(`col-${columnId}`);
            const titleEl = colEl.querySelector('h3');

            await UI.startInlineEdit(titleEl, {
                value: column.title,
                onSave: async (newTitle) => {
                    const trimmedTitle = newTitle.trim();
                    if (!trimmedTitle) throw new Error('Column title cannot be empty');

                    const oldTitle = column.title;
                    this.state.columns[columnId].title = trimmedTitle;
                    this.renderAndBind();

                    try {
                        await ApiClient.renameColumn(columnId, trimmedTitle);
                    } catch (error) {
                        this.state.columns[columnId].title = oldTitle;
                        this.renderAndBind();
                        throw error;
                    }
                }
            });
        });

        // Delete Column handler
        window.addEventListener('delete-column', async (e) => {
            const { columnId } = e.detail;
            const column = this.state.columns[columnId];
            const hasCards = column.cardIds.length > 0;
            const otherColumns = Object.values(this.state.columns).filter(col => col.id !== columnId);

            this.pendingDeleteColId = columnId;
            UI.openDeleteColumnModal(columnId, column.title, hasCards, otherColumns);
        });

        // Confirm Delete Column handler
        UI.deleteColConfirm.onclick = async () => {
            const columnId = this.pendingDeleteColId;
            if (!columnId) return;

            const column = this.state.columns[columnId];
            const destinationId = UI.deleteColDestination.value;

            if (column.cardIds.length > 0) {
                if (!destinationId) {
                    alert('Please select a destination column for the cards.');
                    return;
                }
                const destCol = this.state.columns[destinationId];
                destCol.cardIds.push(...column.cardIds);
            }

            const oldColumns = { ...this.state.columns };
            delete this.state.columns[columnId];

            this.renderAndBind();
            UI.closeDeleteColumnModal();
            this.pendingDeleteColId = null;

            try {
                // Move cards via API if necessary
                if (column.cardIds.length > 0 && destinationId) {
                    await Promise.all(column.cardIds.map((cardId, index) =>
                        ApiClient.moveCard(cardId, destinationId, this.state.columns[destinationId].cardIds.length - 1)
                    ));
                }
                await ApiClient.deleteColumn(columnId);
            } catch (error) {
                this.state.columns = oldColumns;
                this.renderAndBind();
                alert('Failed to delete column: ' + error.message);
            }
        };

        UI.deleteColCancel.onclick = () => {
            UI.closeDeleteColumnModal();
            this.pendingDeleteColId = null;
        };

        UI.closeDeleteColModal.onclick = () => {
            UI.closeDeleteColumnModal();
            this.pendingDeleteColId = null;
        };
    }

    // The person chose to sign out: forget the tokens and end the auth server's session too.
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
    renderAndBind() {
        UI.renderBoard(this.state, this.currentRole);
        this.initSortables();
    }

    initSortables() {
        if (this.currentRole === 'VIEWER') return;

        if (typeof Sortable === 'undefined') {
            console.error('SortableJS is not loaded. Please check the CDN link in kanban.html');
            return;
        }

        // Column Sortable (the container survives re-renders, so drop the previous instance first)
        if (this.columnSortable) this.columnSortable.destroy();
        this.columnSortable = Sortable.create(UI.boardContainer, {
            group: 'kanban-columns',
            handle: '.column-drag-handle',
            animation: 150,
            draggable: '[data-column-id]',
            onEnd: (evt) => this.handleColumnSortEnd(evt),
        });

        Object.values(this.state.columns).forEach(column => {
            const el = document.querySelector(`.card-list[data-column-id="${column.id}"]`);
            if (!el) {
                console.warn(`Column element not found for id: ${column.id}`);
                return;
            }

            Sortable.create(el, {
                group: 'kanban',
                handle: '.drag-handle',
                animation: 150,
                ghostClass: 'drag-card-ghost',
                dragClass: 'drag-card-active',
                onStart: (evt) => console.log('Drag started!', evt),
                onUpdate: (evt) => console.log('Card moved!', evt),
                onEnd: (evt) => {
                    console.log('Drag ended!', evt);
                    this.handleSortEnd(evt);
                }
            });
        });
    }

    cardDetailCallbacks() {
        return {
            onEditTitle: (el, card) => this.handleDetailEdit(el, card, 'title'),
            onEditDescription: (el, card) => this.handleDetailEdit(el, card, 'description', false, 'text', true),
            onEditLabels: (el, card) => this.handleDetailEdit(el, card, 'labels'),
            onEditDate: (el, card) => this.handleDetailEdit(el, card, 'dueDate', false, 'date'),
            onEditPriority: (priority, card) => this.handleDetailPriorityChange(priority, card),
            onArchive: (cardId) => this.handleArchiveCard(cardId),
            onDelete: (cardId) => {
                this.pendingDeleteId = cardId;
                UI.openConfirm(cardId);
            },
        };
    }

    async handleDetailPriorityChange(newPriority, card) {
        if (newPriority === card.priority) return;

        const oldCard = { ...card };
        this.state.cards[card.id] = { ...card, priority: newPriority };

        this.renderAndBind();
        this.showCardDetail(card.id);

        try {
            await ApiClient.updateCard(card.id, { priority: newPriority });
        } catch (error) {
            this.state.cards[card.id] = oldCard;
            this.renderAndBind();
            this.showCardDetail(card.id);
            alert('Failed to save: ' + error.message);
        }
    }

    async handleColumnSortEnd(evt) {
        if (this.currentRole === 'VIEWER') {
            this.renderAndBind();
            return;
        }
        const orderedIds = [...UI.boardContainer.children]
            .map(el => el.dataset.columnId)
            .filter(Boolean);

        const oldState = JSON.parse(JSON.stringify(this.state));

        const reordered = {};
        orderedIds.forEach((id, index) => {
            this.state.columns[id].position = index;
            reordered[id] = this.state.columns[id];
        });
        this.state.columns = reordered;

        try {
            await ApiClient.reorderColumns(
                orderedIds.map((id, index) => ({ id, position: index }))
            );
        } catch (error) {
            this.renderAndBind();
            alert('Failed to reorder columns: ' + error.message);
        }
    }

    async handleSortEnd(evt) {
        if (this.currentRole === 'VIEWER') {
            // Revert the move visually if Sortable allowed it
            this.renderAndBind();
            return;
        }

        const { oldIndex, newIndex } = evt;
        const sourceColId = evt.from.dataset.columnId;
        const destColId = evt.to.dataset.columnId;

        const oldState = JSON.parse(JSON.stringify(this.state));
        const cardId = this.state.columns[sourceColId].cardIds.splice(oldIndex, 1)[0];
        this.state.columns[destColId].cardIds.splice(newIndex, 0, cardId);
        UI.updateCardCounts(this.state);

        try {
            await ApiClient.moveCard(cardId, destColId, newIndex);
        } catch (error) {
            this.state = oldState;
            this.renderAndBind();
            alert('Failed to delete card: ' + error.message);
        }
    }

    // Create a new card (existing cards are edited inline in the detail modal)
    async handleFormSubmit() {
        if (this.currentRole === 'VIEWER') {
            alert('You do not have permission to add cards.');
            return;
        }

        const columnId = document.getElementById('column-id').value;

        const cardData = {
            title: document.getElementById('form-title').value,
            description: UI.descriptionEditor.getHtml(),
            priority: document.querySelector('input[name="priority"]:checked').value,
            dueDate: document.getElementById('form-date').value,
            labels: document.getElementById('form-labels').value.split(',').map(l => l.trim()).filter(l => l !== ''),
        };

        const tempId = 'card-' + Date.now();
        const newCard = {
            id: tempId,
            ...cardData,
            createdAt: new Date().toISOString(),
        };
        this.state.cards[tempId] = newCard;
        if (columnId && this.state.columns[columnId]) {
            this.state.columns[columnId].cardIds.push(tempId);
        } else {
            this.state.columns['todo'].cardIds.push(tempId);
        }
        this.renderAndBind();
        UI.closeModal();

        try {
            const createdCard = await ApiClient.createCard(columnId, cardData);
            delete this.state.cards[tempId];
            this.state.cards[createdCard.id] = createdCard;

            Object.values(this.state.columns).forEach(col => {
                col.cardIds = col.cardIds.map(id => id === tempId ? createdCard.id : id);
            });
            this.renderAndBind();
        } catch (error) {
            delete this.state.cards[tempId];
            Object.values(this.state.columns).forEach(col => {
                col.cardIds = col.cardIds.filter(id => id !== tempId);
            });
            this.renderAndBind();
            alert('Failed to create card: ' + error.message);
        }
    }

    async handleDetailEdit(el, card, field, multiline = false, type = 'text', rich = false) {
        const currentValue = card[field];
        const formattedValue = field === 'labels' ? currentValue.join(', ') : currentValue;

        const onSave = async (newValue) => {
            let updatedValue = newValue;
            if (field === 'labels') {
                updatedValue = newValue.split(',').map(l => l.trim()).filter(l => l !== '');
            }

            const oldCard = { ...card };
            this.state.cards[card.id] = { ...card, [field]: updatedValue };

            // Update UI in detail modal
            this.renderAndBind();
            this.showCardDetail(card.id);

            try {
                await ApiClient.updateCard(card.id, { [field]: updatedValue });
            } catch (error) {
                this.state.cards[card.id] = oldCard;
                this.renderAndBind();
                this.showCardDetail(card.id);
                alert('Failed to save: ' + error.message);
            }
        };

        if (rich) {
            await UI.startRichEdit(el, { html: currentValue || '', onSave });
            return;
        }

        await UI.startInlineEdit(el, {
            value: formattedValue || '',
            multiline: multiline,
            type: type,
            onSave,
        });
    }

    async handleDelete() {
        if (this.currentRole === 'VIEWER') {
            alert('You do not have permission to delete cards.');
            return;
        }

        const cardId = this.pendingDeleteId;
        if (!cardId) return;

        const oldState = JSON.parse(JSON.stringify(this.state));

        Object.values(this.state.columns).forEach(col => {
            col.cardIds = col.cardIds.filter(id => id !== cardId);
        });
        delete this.state.cards[cardId];

        this.renderAndBind();
        UI.closeConfirm();
        UI.closeDetailModal();

        try {
            await ApiClient.deleteCard(cardId);
        } catch (error) {
            this.state = oldState;
            this.renderAndBind();
            alert('Failed to delete card: ' + error.message);
        }
        this.pendingDeleteId = null;
    }

    async handleOpenCardDetail(cardId) {
        this.showCardDetail(cardId);
    }

    // Renders the card detail modal and wires up its comments. This runs on open AND after every
    // inline edit (which re-renders the whole modal), so the comment list and the comment editor
    // are always rebuilt together with the modal body.
    showCardDetail(cardId) {
        const card = this.state.cards[cardId];
        if (!card) return;

        // Keep an unsent comment draft when the modal re-renders for the same card.
        const modal = document.getElementById('card-detail-modal');
        const isOpen = !modal.classList.contains('hidden');
        const draft = isOpen && this.detailCardId === cardId && UI.commentEditor ? UI.commentEditor.getHtml() : '';
        this.detailCardId = cardId;

        UI.openCardDetail(card, this.currentRole, this.cardDetailCallbacks());
        if (draft) UI.commentEditor.setHtml(draft);

        this.refreshComments(cardId);

        // Handle Add Comment
        const addCommentBtn = document.getElementById('add-comment-btn');
        const submitComment = async () => {
            const editor = UI.commentEditor;
            if (!editor || editor.isEmpty()) return;

            if (this.currentRole === 'VIEWER') {
                alert('You do not have permission to add comments.');
                return;
            }

            addCommentBtn.disabled = true;
            try {
                await ApiClient.addComment(cardId, editor.getHtml());
                editor.clear();
                await this.refreshComments(cardId);
            } catch (error) {
                alert('Failed to add comment: ' + error.message);
            } finally {
                addCommentBtn.disabled = false;
            }
        };
        addCommentBtn.onclick = submitComment;

        // Ctrl/Cmd+Enter submits the comment
        UI.commentEditor.onKeydown((e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                e.stopImmediatePropagation();
                submitComment();
            }
        });

        // Handle Delete Comment
        modal.onclick = async (e) => {
            const deleteBtn = e.target.closest('.delete-comment-btn');
            if (deleteBtn) {
                const commentId = deleteBtn.dataset.commentId;
                if (!confirm('Delete this comment?')) return;
                try {
                    await ApiClient.deleteComment(commentId);
                    await this.refreshComments(cardId);
                } catch (error) {
                    alert('Failed to delete comment: ' + error.message);
                }
            }
        };
    }

    async refreshComments(cardId) {
        const commentsListEl = document.querySelector('.comments-list');
        if (commentsListEl) {
            try {
                const comments = await ApiClient.getComments(cardId);
                UI.renderComments(commentsListEl, comments);
            } catch (error) {
                commentsListEl.innerHTML = `<div class="text-center py-4 text-sm text-red-500">Failed to load comments: ${error.message}</div>`;
            }
        }
    }

    async handleArchiveCard(cardId) {
        if (this.currentRole === 'VIEWER') {
            alert('You do not have permission to archive cards.');
            return;
        }

        try {
            await ApiClient.archiveCard(cardId);
            // Refresh board to remove archived card
            await this.loadBoard(this.currentBoardId);
            UI.closeDetailModal();
        } catch (error) {
            alert('Failed to archive card: ' + error.message);
        }
    }

    async openArchivedCardsModal() {
        if (!this.currentBoardId) return;
        UI.openArchivedModal();
        await this.refreshArchivedCards();
    }

    async refreshArchivedCards() {
        const listEl = document.getElementById('archived-cards-list');
        if (!listEl) return;
        listEl.innerHTML = '<div class="col-span-full text-center py-12 text-slate-400">Loading...</div>';
        try {
            const archivedCards = await ApiClient.getArchivedCards(this.currentBoardId);
            UI.renderArchivedCards(listEl, archivedCards, this.currentRole, (cardId) => this.handleRestoreCard(cardId));
        } catch (error) {
            listEl.innerHTML = `<div class="col-span-full text-center py-12 text-red-500">Failed to load archived cards: ${error.message}</div>`;
        }
    }

    async handleRestoreCard(cardId) {
        if (this.currentRole === 'VIEWER') {
            alert('You do not have permission to restore cards.');
            return;
        }

        try {
            await ApiClient.restoreCard(cardId);
            await this.loadBoard(this.currentBoardId);
            await this.refreshArchivedCards();
        } catch (error) {
            alert('Failed to restore card: ' + error.message);
        }
    }

    filterCards(term) {
        const cards = document.querySelectorAll('.card');
        cards.forEach(cardEl => {
            const id = cardEl.dataset.cardId;
            const card = this.state.cards[id];
            const matches = card.title.toLowerCase().includes(term) ||
                           toPlainText(card.description).toLowerCase().includes(term) ||
                           card.labels.some(l => l.toLowerCase().includes(term));

            cardEl.classList.toggle('hidden', !matches);
        });
    }

    async exportData(boardId) {
        try {
            const boardData = await ApiClient.exportBoard(boardId);
            const dataStr = JSON.stringify(boardData, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
            const exportFileDefaultName = 'kanban-data.json';

            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
        } catch (error) {
            alert('Failed to export data: ' + error.message);
        }
    }

    async importData(boardId, file) {
        try {
            const text = await file.text();
            const importedState = JSON.parse(text);

            if (!importedState.columns || !importedState.cards) {
                throw new Error('Invalid data format');
            }

            const response = await ApiClient.importBoard(boardId, importedState);

            const fullFreshState = await ApiClient.getBoard(boardId);
            this.state = fullFreshState;

            const boardContainer = document.getElementById('boardContainer');
            if (boardContainer) boardContainer.innerHTML = '';

            this.renderAndBind();

            setTimeout(() => {
                alert('Data imported successfully!');
            }, 10);

        } catch (e) {
            console.error('Import error:', e);
            alert('Failed to import data: ' + e.message);
        }
    }
}

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
