import ApiClient from './api.js';
import { UI } from './ui.js';
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

        if (this.checkAuth()) {
            try {
                this.boards = await ApiClient.getBoards();
                await this.resolveActiveBoard();
            } catch (error) {
                console.error('Failed to load boards:', error);
                this.handleLogout();
            }
        } else {
            this.switchView('auth');
        }
    }

    checkAuth() {
        return !!localStorage.getItem('kanban-token');
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
                this.handleLogout();
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
        this.setupEventListeners();
    }

    init() {
        // Initial Render
        UI.renderBoard(this.state, this.currentRole);

        // Setup user profile in header
        const user = JSON.parse(localStorage.getItem('kanban-user') || '{}');
        UI.updateUserHeader(user, this.currentRole);

        this.setupEventListeners();
        this.initSortables();
        UI.renderBoardSwitcher(this.boards, this.currentBoardId);
    }

    // The auth screen has several Turnstile widgets (login, signup, forgot password), so read the
    // token from the widget inside the given form rather than from a global lookup.
    getTurnstileToken(form) {
        const input = form.querySelector('[name="cf-turnstile-response"]');
        return input && input.value ? input.value : null;
    }

    resetTurnstile(form) {
        const widget = form.querySelector('.cf-turnstile');
        if (widget && typeof turnstile !== 'undefined') turnstile.reset(widget);
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

        // Toggle between Login and Signup cards
        UI.showSignupBtn.onclick = () => {
            UI.loginCard.classList.add('hidden');
            UI.signupCard.classList.remove('hidden');
        };

        UI.showLoginBtn.onclick = () => {
            UI.signupCard.classList.add('hidden');
            UI.loginCard.classList.remove('hidden');
        };

        // Forgot password: Login <-> Forgot Password cards
        UI.showForgotBtn.onclick = (e) => {
            e.preventDefault();
            const loginEmail = document.getElementById('login-email').value;
            if (loginEmail) document.getElementById('forgot-email').value = loginEmail;
            UI.forgotSuccess.classList.add('hidden');
            UI.loginCard.classList.add('hidden');
            UI.forgotCard.classList.remove('hidden');
        };

        UI.backToLoginBtn.onclick = (e) => {
            e.preventDefault();
            UI.forgotCard.classList.add('hidden');
            UI.loginCard.classList.remove('hidden');
        };

        // Forgot Password Submit
        UI.forgotForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgot-email').value.trim();
            const turnstileToken = this.getTurnstileToken(UI.forgotForm);
            if (!turnstileToken) {
                alert('Please complete the security check.');
                return;
            }

            const submitBtn = UI.forgotForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            try {
                await ApiClient.forgotPassword(email, turnstileToken);
                // Same message whether or not the account exists (the API doesn't reveal it either).
                UI.forgotSuccess.classList.remove('hidden');
            } catch (error) {
                alert('Could not send reset link: ' + error.message);
            } finally {
                submitBtn.disabled = false;
                this.resetTurnstile(UI.forgotForm); // tokens are single-use
            }
        };

        // Login Submit
        UI.loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const turnstileToken = this.getTurnstileToken(UI.loginForm);
            if (!turnstileToken) {
                alert('Please complete the security check.');
                return;
            }

            try {
                const authData = await ApiClient.login(email, password, turnstileToken);
                localStorage.setItem('kanban-token', authData.token);
                localStorage.setItem('kanban-user', JSON.stringify({
                    email: authData.email,
                    displayName: authData.displayName,
                    avatarUrl: authData.avatarUrl
                }));

                const user = JSON.parse(localStorage.getItem('kanban-user') || '{}');
                UI.updateUserHeader(user);
                this.boards = await ApiClient.getBoards();
                await this.resolveActiveBoard();
            } catch (error) {
                alert('Login failed: ' + error.message);
            }
        };

        // Signup Submit
        UI.signupForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const displayName = document.getElementById('signup-name').value;

            const turnstileToken = this.getTurnstileToken(UI.signupForm);
            if (!turnstileToken) {
                alert('Please complete the security check.');
                return;
            }

            try {
                const authData = await ApiClient.signup(email, password, displayName, turnstileToken);
                localStorage.setItem('kanban-token', authData.token);
                localStorage.setItem('kanban-user', JSON.stringify({
                    email: authData.email,
                    displayName: authData.displayName,
                    avatarUrl: authData.avatarUrl
                }));

                const user = JSON.parse(localStorage.getItem('kanban-user') || '{}');
                UI.updateUserHeader(user);
                this.boards = await ApiClient.getBoards();
                await this.resolveActiveBoard();
            } catch (error) {
                alert('Signup failed: ' + error.message);
            }
        };

        // Handle session expiration (401)
        window.addEventListener('auth-expired', () => this.handleLogout());
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
                    UI.renderBoard(this.state, this.currentRole);

                    try {
                        await ApiClient.renameBoard(this.currentBoardId, trimmedName);
                    } catch (error) {
                        // Rollback
                        this.currentBoardName = oldName;
                        this.state.name = oldName;
                        UI.renderBoard(this.state, this.currentRole);
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
                    UI.renderBoard(this.state);
                    this.initSortables();
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

        // Change Password
        UI.changePasswordMenu.onclick = (e) => {
            e.stopPropagation();
            UI.menuDropdown.classList.add('hidden');
            UI.openChangePasswordModal();
        };
        document.getElementById('close-change-password-modal').onclick = () => UI.closeChangePasswordModal();
        document.getElementById('cancel-change-password').onclick = () => UI.closeChangePasswordModal();
        UI.changePasswordModal.onclick = (e) => {
            if (e.target === UI.changePasswordModal) UI.closeChangePasswordModal();
        };
        document.getElementById('change-show-passwords').onchange = (e) => {
            const type = e.target.checked ? 'text' : 'password';
            ['current-password', 'change-new-password', 'change-confirm-password'].forEach(id => {
                document.getElementById(id).type = type;
            });
        };
        UI.changePasswordForm.onsubmit = async (e) => {
            e.preventDefault();
            const oldPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('change-new-password').value;
            const confirmPassword = document.getElementById('change-confirm-password').value;
            const showError = (msg) => {
                UI.changePasswordError.textContent = msg;
                UI.changePasswordError.classList.remove('hidden');
            };
            UI.changePasswordError.classList.add('hidden');

            if (newPassword.length < 8) return showError('New password must be at least 8 characters long.');
            if (newPassword !== confirmPassword) return showError('New passwords do not match.');
            if (newPassword === oldPassword) return showError('New password must be different from your current password.');

            const submitBtn = document.getElementById('change-password-submit');
            submitBtn.disabled = true;
            try {
                await ApiClient.changePassword(oldPassword, newPassword);
                UI.closeChangePasswordModal();
                alert('Your password has been updated.');
            } catch (error) {
                // e.g. "Incorrect current password" (400) — shown inline, the session stays signed in.
                showError(error.message);
            } finally {
                submitBtn.disabled = false;
            }
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
            UI.openModal('Add New Card', null, columnId);
        });

        // Form Submit
        UI.cardForm.onsubmit = (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        };

        // Confirm Modal Controls
        document.getElementById('confirm-cancel').onclick = () => UI.closeConfirm();
        document.getElementById('confirm-delete').onclick = () => this.handleDelete();

        // Card Clicks (Edit/Delete/Detail)
        UI.boardContainer.onclick = (e) => {
            const editBtn = e.target.closest('.edit-btn');
            const deleteBtn = e.target.closest('.delete-btn');
            const cardEl = e.target.closest('.card');

            if (editBtn && cardEl) {
                const cardId = cardEl.dataset.cardId;
                UI.openModal('Edit Card', this.state.cards[cardId]);
            } else if (deleteBtn && cardEl) {
                const cardId = cardEl.dataset.cardId;
                this.pendingDeleteId = cardId;
                UI.openConfirm(cardId);
            } else if (cardEl) {
                // Open detailed view instead of edit modal
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
                    UI.renderBoard(this.state);
                    this.initSortables();

                    try {
                        await ApiClient.renameColumn(columnId, trimmedTitle);
                    } catch (error) {
                        this.state.columns[columnId].title = oldTitle;
                        UI.renderBoard(this.state);
                        this.initSortables();
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

            UI.renderBoard(this.state);
            this.initSortables();
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
                UI.renderBoard(this.state);
                this.initSortables();
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

    handleLogout() {
        localStorage.removeItem('kanban-token');
        localStorage.removeItem('kanban-user');
        window.location.replace("kanban.html");
    }

    initSortables() {
        if (this.currentRole === 'VIEWER') return;

        if (typeof Sortable === 'undefined') {
            console.error('SortableJS is not loaded. Please check the CDN link in kanban.html');
            return;
        }

        // Column Sortable
        Sortable.create(UI.boardContainer, {
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

        UI.renderBoard(this.state);
        this.showCardDetail(card.id);

        try {
            await ApiClient.updateCard(card.id, { priority: newPriority });
        } catch (error) {
            this.state.cards[card.id] = oldCard;
            this.showCardDetail(card.id);
            alert('Failed to save: ' + error.message);
        }
    }

    async handleColumnSortEnd(evt) {
        if (this.currentRole === 'VIEWER') {
            UI.renderBoard(this.state);
            this.initSortables();
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
            UI.renderBoard(this.state);
            this.initSortables();
            alert('Failed to reorder columns: ' + error.message);
        }
    }

    async handleSortEnd(evt) {
        if (this.currentRole === 'VIEWER') {
            // Revert the move visually if Sortable allowed it
            UI.renderBoard(this.state);
            this.initSortables();
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
            UI.renderBoard(this.state);
            this.initSortables();
            alert('Failed to delete card: ' + error.message);
        }
    }

    // create new card or update card
    async handleFormSubmit() {
        if (this.currentRole === 'VIEWER') {
            alert('You do not have permission to edit cards.');
            return;
        }

        const cardId = document.getElementById('card-id').value;
        const columnId = document.getElementById('column-id').value;

        const cardData = {
            title: document.getElementById('form-title').value,
            description: UI.descriptionEditor.getHtml(),
            priority: document.querySelector('input[name="priority"]:checked').value,
            dueDate: document.getElementById('form-date').value,
            labels: document.getElementById('form-labels').value.split(',').map(l => l.trim()).filter(l => l !== ''),
        };

        if (cardId) {
            // update card
            const oldCard = { ...this.state.cards[cardId] };
            this.state.cards[cardId] = { ...oldCard, ...cardData };
            UI.renderBoard(this.state);
            this.initSortables();
            UI.closeModal();

            try {
                await ApiClient.updateCard(cardId, cardData);
            } catch (error) {
                this.state.cards[cardId] = oldCard;
            }
        } else {
            // create new card
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
            UI.renderBoard(this.state);
            this.initSortables();
            UI.closeModal();

            try {
                const createdCard = await ApiClient.createCard(columnId, cardData);
                delete this.state.cards[tempId];
                this.state.cards[createdCard.id] = createdCard;

                Object.values(this.state.columns).forEach(col => {
                    col.cardIds = col.cardIds.map(id => id === tempId ? createdCard.id : id);
                });
                UI.renderBoard(this.state);
                this.initSortables();
            } catch (error) {
                delete this.state.cards[tempId];
                Object.values(this.state.columns).forEach(col => {
                    col.cardIds = col.cardIds.filter(id => id !== tempId);
                });
                UI.renderBoard(this.state);
                this.initSortables();
                alert('Failed to create card: ' + error.message);
            }
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
            UI.renderBoard(this.state);
            this.showCardDetail(card.id);

            try {
                await ApiClient.updateCard(card.id, { [field]: updatedValue });
            } catch (error) {
                this.state.cards[card.id] = oldCard;
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

        UI.renderBoard(this.state);
        this.initSortables();
        UI.closeConfirm();
        UI.closeDetailModal();

        try {
            await ApiClient.deleteCard(cardId);
        } catch (error) {
            this.state = oldState;
            UI.renderBoard(this.state);
            this.initSortables();
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

            UI.renderBoard(this.state);
            this.initSortables();

            setTimeout(() => {
                alert('Data imported successfully!');
            }, 10);

        } catch (e) {
            console.error('Import error:', e);
            alert('Failed to import data: ' + e.message);
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const app = new KanbanApp();
    await app.start();
});
