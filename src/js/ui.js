import { createRichEditor, toDisplayHtml, toPlainText, escapeHtml } from './editor.js';

export const UI = {
    // DOM Elements
    appAuthView: document.getElementById('app-auth-view'),
    appBoardView: document.getElementById('app-board-view'),
    boardName: document.getElementById('board-name'),
    boardContainer: document.getElementById('board-container'),
    boardSwitcher: document.getElementById('board-switcher'),
    createBoardBtn: document.getElementById('create-board-btn'),
    menuToggle: document.getElementById('profile-trigger'),
    menuDropdown: document.getElementById('menu-dropdown'),
    themeToggleMenu: document.getElementById('theme-toggle-menu'),
    aboutMenu: document.getElementById('about-menu'),
    exportMenu: document.getElementById('export-menu'),
    importMenu: document.getElementById('import-menu'),
    membersMenu: document.getElementById('members-menu'),
    logoutMenu: document.getElementById('logout-menu'),
    addColumnMenu: document.getElementById('add-column-menu'),
    userName: document.getElementById('user-name'),
    userAvatar: document.getElementById('user-avatar'),
    userRoleBadge: document.getElementById('user-role-badge'),
    renameBoardBtn: document.getElementById('rename-board-btn'),
    menuUserName: document.getElementById('menu-user-name'),
    menuUserEmail: document.getElementById('menu-user-email'),
    importFile: document.getElementById('import-file'),
    themeDarkIcon: document.getElementById('theme-toggle-dark-icon'),
    themeLightIcon: document.getElementById('theme-toggle-light-icon'),
    aboutModal: document.getElementById('about-modal'),
    closeAboutModalBtn: document.getElementById('close-about-modal'),
    aboutOkBtn: document.getElementById('about-ok-btn'),
    cardModal: document.getElementById('card-modal'),
    modalTitle: document.getElementById('modal-title'),
    cardForm: document.getElementById('card-form'),
    confirmModal: document.getElementById('confirm-modal'),
    deleteColumnModal: document.getElementById('delete-column-modal'),
    deleteColTitle: document.getElementById('delete-col-title'),
    deleteColMessage: document.getElementById('delete-col-message'),
    deleteColTransferSection: document.getElementById('delete-col-transfer-section'),
    deleteColDestination: document.getElementById('delete-col-destination'),
    deleteColConfirm: document.getElementById('delete-col-confirm'),
    deleteColCancel: document.getElementById('delete-col-cancel'),
    closeDeleteColModal: document.getElementById('close-delete-col-modal'),
    profileName: document.getElementById('profile-name'),
    profileEmail: document.getElementById('profile-email'),
    profileAvatar: document.getElementById('profile-avatar'),
    membersModal: document.getElementById('members-modal'),
    membersList: document.getElementById('members-list'),
    closeMembersModalBtn: document.getElementById('close-members-modal'),
    inviteMemberSection: document.getElementById('invite-member-section'),
    inviteMemberForm: document.getElementById('invite-member-form'),
    inviteEmail: document.getElementById('invite-email'),
    inviteRole: document.getElementById('invite-role'),

    // Rich-text editors (created lazily)
    descriptionEditor: null, // add-card form
    commentEditor: null,     // comment composer in the card detail modal

    renderBoard(state, role = 'EDITOR') {
        let roleDisplay = ' (owned)';
        if (role === 'EDITOR') {
            roleDisplay = ' (can edit)';
        } else if (role === 'VIEWER') {
            roleDisplay = ' (view only)';
        }

        this.boardName.innerHTML = state.name + roleDisplay;
        this.setBoardControlsVisible(true);
        this.renameBoardBtn.style.visibility = (role === 'VIEWER') ? "hidden" : '';

        this.boardContainer.innerHTML = '';
        Object.values(state.columns)
            .sort((a, b) => a.position - b.position)
            .forEach(column => {
                const colEl = this.createColumnElement(column, state.cards, role);
                this.boardContainer.appendChild(colEl);
            });
    },

    // Rename, members, export/import, add column, archived cards and search all act on the current board.
    // Hide them while there is none, so they cannot send a request without a board id.
    setBoardControlsVisible(visible) {
        this.renameBoardBtn.style.visibility = visible ? '' : 'hidden';
        ['members-menu', 'export-menu', 'import-menu', 'add-column-menu', 'archived-cards-menu'].forEach(id => {
            document.getElementById(id)?.classList.toggle('hidden', !visible);
        });
        const search = document.getElementById('search-input');
        if (search) {
            search.disabled = !visible;
            if (!visible) search.value = '';
        }
    },

    renderEmptyState() {
        this.boardName.textContent = '';
        this.setBoardControlsVisible(false);
        this.boardContainer.innerHTML = `
            <div class="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-6">
                <div class="bg-slate-200 dark:bg-slate-800 p-6 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6 0h3m-3 4h3" />
                    </svg>
                </div>
                <div>
                    <h2 class="text-2xl font-bold text-slate-800 dark:text-slate-100">No boards yet</h2>
                    <p class="text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-2">You don't have any boards yet. Create one to start organizing your tasks!</p>
                </div>
                <button id="create-first-board-btn" class="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95">
                    Create Your First Board
                </button>
            </div>
        `;

        document.getElementById('create-first-board-btn').onclick = () => {
            window.dispatchEvent(new CustomEvent('create-board-trigger'));
        };
    },

    createColumnElement(column, cards, role = 'EDITOR') {
        const div = document.createElement('div');
        div.className = 'group flex-shrink-0 w-[300px] flex flex-col max-h-full bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700';
        div.id = `col-${column.id}`;
        div.dataset.columnId = column.id;

        const cardCount = column.cardIds.length;
        const isViewer = role === 'VIEWER';

        div.innerHTML = `
            <div class="flex items-center justify-between mb-4 px-1">
                <div class="flex items-center gap-2">
                    <div class="column-drag-handle cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-primary-600 transition-colors rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 ${isViewer ? 'hidden' : ''}" title="Drag to reorder column">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
                        </svg>
                    </div>
                    <h3 class="font-bold text-slate-700 dark:text-slate-200">${column.title}</h3>
                    <div class="flex gap-1 opacity-60 hover:opacity-100 transition-opacity ${isViewer ? 'hidden' : ''}">
                        <button class="rename-col-btn text-slate-400 hover:text-primary-600 transition-colors" title="Rename Column">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button class="delete-col-btn text-slate-400 hover:text-red-600 transition-colors" title="Delete Column">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                    <span class="column-card-count text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">${cardCount}</span>
                </div>
                <button class="add-card-btn text-slate-400 hover:text-primary-600 transition-colors ${isViewer ? 'hidden' : ''}" title="Add Card">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
            <div class="card-list flex-1 overflow-y-auto space-y-3 pb-4" data-column-id="${column.id}">
                ${column.cardIds.map(id => this.createCardHTML(cards[id], role)).join('')}
            </div>
        `;

        // Attach listener to the "Add Card" button
        const addBtn = div.querySelector('.add-card-btn');
        if (addBtn) {
            addBtn.onclick = () => {
                window.dispatchEvent(new CustomEvent('open-card-modal', { detail: { columnId: column.id } }));
            };
        }

        // Attach listener to the "Rename Column" button
        const renameBtn = div.querySelector('.rename-col-btn');
        if (renameBtn) {
            renameBtn.onclick = () => {
                window.dispatchEvent(new CustomEvent('rename-column', { detail: { columnId: column.id } }));
            };
        }

        // Attach listener to the "Delete Column" button
        const deleteBtn = div.querySelector('.delete-col-btn');
        if (deleteBtn) {
            deleteBtn.onclick = () => {
                window.dispatchEvent(new CustomEvent('delete-column', { detail: { columnId: column.id } }));
            };
        }

        return div;
    },

    createCardHTML(card, role = 'EDITOR') {
        if (!card) return '';

        const priorityColors = {
            'HIGH': 'border-red-500 text-red-600 bg-red-100 dark:bg-red-900/20',
            'MEDIUM': 'border-yellow-500 text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
            'LOW': 'border-green-500 text-green-600 bg-green-100 dark:bg-green-900/20',
        };

        const priorityClass = priorityColors[card.priority] || priorityColors['MEDIUM'];
        const labelsHTML = card.labels.map(l => `<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">${l}</span>`).join(' ');
        const isViewer = role === 'VIEWER';

        return `
            <div class="card group dark:bg-slate-800 p-3 rounded-xl shadow-sm border-l-4 ${priorityClass} cursor-pointer relative" data-card-id="${card.id}" data-id="${card.id}">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex flex-wrap gap-1">
                        ${labelsHTML}
                    </div>
                    <div class="drag-handle cursor-grab active:cursor-grabbing p-1.5 text-slate-400 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors rounded-md hover:bg-slate-200 dark:hover:bg-slate-700" title="Drag to move">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
                        </svg>
                    </div>
                </div>
                <h4 class="font-semibold text-sm mb-1 text-slate-800 dark:text-slate-100">${card.title}</h4>
                <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">${escapeHtml(toPlainText(card.description))}</p>

                <div class="flex items-center justify-between mt-auto">
                    <div class="flex items-center gap-2 text-[10px] text-slate-400">
                        ${card.dueDate ? `
                            <div class="flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>${card.dueDate}</span>
                            </div>
                        ` : ''}
                        ${card.commentCount !== undefined ? `
                            <div class="flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                </svg>
                                <span>${card.commentCount}</span>
                            </div>
                        ` : ''}
                    </div>
                    <div class="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity ${isViewer ? 'hidden' : ''}">
                        <button class="delete-btn p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-slate-400 hover:text-red-600 transition-colors" title="Delete">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    setTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.classList.remove('light');
            document.documentElement.classList.add('dark');
            this.themeDarkIcon.classList.add('hidden');
            this.themeLightIcon.classList.remove('hidden');
        } else {
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('light');
            this.themeLightIcon.classList.add('hidden');
            this.themeDarkIcon.classList.remove('hidden');
        }
    },

    updateCardCounts(state) {
        Object.values(state.columns).forEach(column => {
            const colEl = document.getElementById(`col-${column.id}`);
            if (colEl) {
                const countEl = colEl.querySelector('.column-card-count');
                if (countEl) {
                    countEl.textContent = column.cardIds.length;
                }
            }
        });
    },

    // Opens the Add Card modal (existing cards are edited inline in the detail modal)
    openModal(title, columnId = null) {
        if (!this.descriptionEditor) {
            this.descriptionEditor = createRichEditor(document.getElementById('form-description'), {
                placeholder: 'Add a description...',
            });
        }

        this.modalTitle.textContent = title;
        this.cardModal.classList.remove('hidden');
        this.cardModal.classList.add('flex');

        // Trigger animation
        setTimeout(() => {
            this.cardModal.querySelector('.relative').classList.remove('scale-95', 'opacity-0');
            this.cardModal.querySelector('.relative').classList.add('scale-100', 'opacity-100');
        }, 10);

        this.cardForm.reset();
        this.descriptionEditor.clear();
        document.getElementById('column-id').value = columnId || '';
        document.querySelector('input[name="priority"][value="MEDIUM"]').checked = true;
    },

    closeModal() {
        const modalContent = this.cardModal.querySelector('.relative');
        modalContent.classList.remove('scale-100', 'opacity-100');
        modalContent.classList.add('scale-95', 'opacity-0');

        setTimeout(() => {
            this.cardModal.classList.add('hidden');
            this.cardModal.classList.remove('flex');
        }, 200);
    },

    openConfirm(cardId) {
        this.confirmModal.classList.remove('hidden');
        this.confirmModal.classList.add('flex');
        setTimeout(() => {
            this.confirmModal.querySelector('.relative').classList.remove('scale-95', 'opacity-0');
            this.confirmModal.querySelector('.relative').classList.add('scale-100', 'opacity-100');
        }, 10);
    },

    closeConfirm() {
        const modalContent = this.confirmModal.querySelector('.relative');
        modalContent.classList.remove('scale-100', 'opacity-100');
        modalContent.classList.add('scale-95', 'opacity-0');

        setTimeout(() => {
            this.confirmModal.classList.add('hidden');
            this.confirmModal.classList.remove('flex');
        }, 200);
    },

    openAboutModal() {
        this.aboutModal.classList.remove('hidden');
        this.aboutModal.classList.add('flex');
        setTimeout(() => {
            this.aboutModal.querySelector('.relative').classList.remove('scale-95', 'opacity-0');
            this.aboutModal.querySelector('.relative').classList.add('scale-100', 'opacity-100');
        }, 10);
    },

    closeAboutModal() {
        const modalContent = this.aboutModal.querySelector('.relative');
        modalContent.classList.remove('scale-100', 'opacity-100');
        modalContent.classList.add('scale-95', 'opacity-0');

        setTimeout(() => {
            this.aboutModal.classList.add('hidden');
            this.aboutModal.classList.remove('flex');
        }, 200);
    },

    openDeleteColumnModal(columnId, title, hasCards, otherColumns) {
        this.deleteColumnModal.classList.remove('hidden');
        this.deleteColumnModal.classList.add('flex');
        this.deleteColTitle.textContent = `Delete Column: ${title}`;
        this.deleteColMessage.textContent = hasCards
            ? `This column contains cards. You must transfer them to another column before deleting.`
            : `Are you sure you want to delete the column "${title}"? This action cannot be undone.`;

        this.deleteColTransferSection.classList.toggle('hidden', !hasCards);

        if (hasCards) {
            this.deleteColDestination.innerHTML = '';
            otherColumns.forEach(col => {
                const option = document.createElement('option');
                option.value = col.id;
                option.textContent = col.title;
                this.deleteColDestination.appendChild(option);
            });
        }

        setTimeout(() => {
            this.deleteColumnModal.querySelector('.relative').classList.remove('scale-95', 'opacity-0');
            this.deleteColumnModal.querySelector('.relative').classList.add('scale-100', 'opacity-100');
        }, 10);
    },

    closeDeleteColumnModal() {
        const modalContent = this.deleteColumnModal.querySelector('.relative');
        modalContent.classList.remove('scale-100', 'opacity-100');
        modalContent.classList.add('scale-95', 'opacity-0');

        setTimeout(() => {
            this.deleteColumnModal.classList.add('hidden');
            this.deleteColumnModal.classList.remove('flex');
        }, 200);
    },

    renderBoardSwitcher(boards, currentBoardId) {
        if (!this.boardSwitcher) return;

        this.boardSwitcher.innerHTML = `
            <option value="" disabled ${!currentBoardId ? 'selected' : ''}>Select Board</option>
            ${boards.map(b => `
                <option value="${b.id}" ${b.id === currentBoardId ? 'selected' : ''}>
                    ${b.name}
                </option>
            `).join('')}
        `;
    },

    updateUserHeader(user, role) {
        if (!user) return;
        this.userName.textContent = user.displayName;
        this.userAvatar.src = user.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURI(user.displayName);
        if (this.menuUserName) this.menuUserName.textContent = user.displayName;
        if (this.menuUserEmail) this.menuUserEmail.textContent = user.email;
        if (this.userRoleBadge) {
            this.userRoleBadge.textContent = role;
        }
    },

    openMembersModal(members, role) {
        this.membersModal.classList.remove('hidden');
        this.membersModal.classList.add('flex');

        this.membersList.innerHTML = members.map(m => {
            const displayName = m.displayName || m.email || 'Kanban user';
            const fallbackAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}`;
            const hasProviderAvatar = typeof m.avatarUrl === 'string'
                && (m.avatarUrl.startsWith('https://') || m.avatarUrl.startsWith('http://'));
            const avatarUrl = hasProviderAvatar ? m.avatarUrl : fallbackAvatarUrl;

            return `
                <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
                    <div class="flex items-center gap-3">
                        <img
                            src="${escapeHtml(avatarUrl)}"
                            data-fallback-src="${escapeHtml(fallbackAvatarUrl)}"
                            referrerpolicy="no-referrer"
                            class="w-8 h-8 rounded-full object-cover"
                            alt="${escapeHtml(displayName)}"
                        >
                        <div>
                            <div class="text-sm font-bold text-slate-800 dark:text-slate-100">${escapeHtml(displayName)}</div>
                            <div class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(m.email || '')}</div>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-400">${escapeHtml(m.role || '')}</span>
                        ${role === 'OWNER' ? `
                            <button class="text-red-500 hover:text-red-700 transition-colors" data-user-id="${escapeHtml(m.userId)}">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a1.995 1.995 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        this.membersList.querySelectorAll('img[data-fallback-src]').forEach(image => {
            image.addEventListener('error', () => {
                const fallbackAvatarUrl = image.dataset.fallbackSrc;
                if (fallbackAvatarUrl) {
                    image.removeAttribute('data-fallback-src');
                    image.src = fallbackAvatarUrl;
                }
            }, { once: true });
        });

        setTimeout(() => {
            this.membersModal.querySelector('.relative').classList.remove('scale-95', 'opacity-0');
            this.membersModal.querySelector('.relative').classList.add('scale-100', 'opacity-100');
        }, 10);
    },

    closeMembersModal() {
        const modalContent = this.membersModal.querySelector('.relative');
        modalContent.classList.remove('scale-100', 'opacity-100');
        modalContent.classList.add('scale-95', 'opacity-0');

        setTimeout(() => {
            this.membersModal.classList.add('hidden');
            this.membersModal.classList.remove('flex');
        }, 200);
    },

    startInlineEdit(displayEl, {
        value,
        multiline = false,
        type = 'text',
        onSave,
    }) {
        // Ignore re-clicks while this field is already being edited, so a click
        // on the (still-live) display element can't nest a second edit UI inside it.
        if (displayEl.dataset.editing === 'true') return;
        displayEl.dataset.editing = 'true';

        const input = document.createElement(multiline ? 'textarea' : 'input');
        if (!multiline) input.type = type;
        input.value = value;
        input.className = 'inline-edit-input px-2 py-1 rounded border border-primary-300 dark:border-primary-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm';
        if (multiline) {
            input.className += ' w-full h-24 resize-none';
        } else {
            input.className += ' w-full';
        }

        const saveBtn = document.createElement('button');
        saveBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>`;
        saveBtn.className = 'p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors';

        const cancelBtn = document.createElement('button');
        cancelBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>`;
        cancelBtn.className = 'p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors';

        const wrapper = document.createElement(multiline ? 'div' : 'span');
        wrapper.className = multiline ? 'flex flex-col gap-2 w-full' : 'flex items-center gap-1 w-full';

        if (multiline) {
            const btnRow = document.createElement('div');
            btnRow.className = 'flex justify-end gap-2';
            btnRow.append(saveBtn, cancelBtn);
            wrapper.append(input, btnRow);
        } else {
            wrapper.append(input, saveBtn, cancelBtn);
        }

        // Swap displayEl's CONTENT for the edit UI, but keep displayEl itself in
        // the DOM the whole time. This is what keeps its click-to-edit handler
        // alive across cancel/retry cycles, instead of only working once.
        const originalHTML = displayEl.innerHTML;
        displayEl.innerHTML = '';
        displayEl.appendChild(wrapper);
        input.focus();

        const restore = () => {
            displayEl.innerHTML = originalHTML;
            delete displayEl.dataset.editing;
        };

        // stopPropagation so the click doesn't reach displayEl and immediately re-open the editor
        cancelBtn.onclick = (e) => { e.stopPropagation(); restore(); };

        const handleSave = async (e) => {
            if (e?.type === 'keydown' && e.key !== 'Enter') return;
            if (e?.type === 'keydown' && multiline && !e.metaKey && !e.ctrlKey) return;

            try {
                await onSave(input.value);
                delete displayEl.dataset.editing;
            } catch (err) {
                restore();
                alert('Failed to save: ' + err.message);
            }
        };

        saveBtn.onclick = (e) => { e.stopPropagation(); handleSave(e); };
        input.onkeydown = (e) => {
            if (e.key === 'Escape') restore();
            if (e.key === 'Enter') handleSave(e);
        };
    },

    // Inline WYSIWYG editing of a field in the detail modal (used for the description).
    startRichEdit(displayEl, { html = '', placeholder = 'Add a description...', onSave }) {
        // Clicks inside the editor bubble up to displayEl's click-to-edit handler; ignore them.
        if (displayEl.dataset.editing === 'true') return;
        displayEl.dataset.editing = 'true';

        const originalHTML = displayEl.innerHTML;
        displayEl.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.className = 'flex flex-col gap-2 w-full cursor-auto';

        const editorEl = document.createElement('div');

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors';

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.textContent = 'Save';
        saveBtn.className = 'px-3 py-1 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-all active:scale-95 disabled:opacity-50';

        const btnRow = document.createElement('div');
        btnRow.className = 'flex justify-end gap-2';
        btnRow.append(cancelBtn, saveBtn);

        wrapper.append(editorEl, btnRow);
        displayEl.appendChild(wrapper);

        const editor = createRichEditor(editorEl, { html, placeholder });
        editor.focus();

        const restore = () => {
            editor.destroy();
            displayEl.innerHTML = originalHTML;
            delete displayEl.dataset.editing;
        };

        const save = async () => {
            saveBtn.disabled = true;
            try {
                await onSave(editor.getHtml());
                delete displayEl.dataset.editing;
            } catch (err) {
                restore();
                alert('Failed to save: ' + err.message);
            }
        };

        // stopPropagation so the click doesn't reach displayEl and immediately re-open the editor
        cancelBtn.onclick = (e) => { e.stopPropagation(); restore(); };
        saveBtn.onclick = (e) => { e.stopPropagation(); save(); };

        editor.onKeydown((e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
                restore();
            } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                e.stopImmediatePropagation();
                save();
            }
        });
    },

    openCardDetail(card, role, callbacks = {}) {
        const modal = document.getElementById('card-detail-modal');
        const box = modal.querySelector('.relative');
        const content = document.getElementById('card-detail-body');

        content.innerHTML = `
            <div class="flex items-center justify-between mb-6">
                <h2 class="text-xl font-bold text-slate-800 dark:text-slate-100">Card Details</h2>
                <button class="close-detail-btn text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div class="detail-scroll max-h-[65vh] overflow-y-auto space-y-6 pr-2">
                <div class="space-y-1">
                    <label class="text-xs font-semibold text-slate-500 tracking-wider">Title</label>
                    <div class="detail-title text-lg font-bold text-slate-800 dark:text-slate-100 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-1 rounded transition-colors">${card.title}</div>
                </div>

                <div class="space-y-1">
                    <label class="text-xs font-semibold text-slate-500 tracking-wider">Description</label>
                    <div class="detail-description rich-content text-sm text-slate-600 dark:text-slate-400 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-2 rounded transition-colors">${card.description ? toDisplayHtml(card.description) : '<span class="text-slate-400 italic">No description - click to add one</span>'}</div>
                </div>

                <div class="flex flex-wrap gap-4">
                    <div class="space-y-1">
                        <label class="text-xs font-semibold text-slate-500 tracking-wider">Priority</label>
                        <div class="detail-priority flex gap-2 cursor-pointer p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            ${(() => {
                                const activePriorityClasses = {
                                    LOW: 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                                    MEDIUM: 'bg-yellow-100 border-yellow-500 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                                    HIGH: 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                                };
                                const inactivePriorityClasses = 'bg-slate-100 border-slate-300 text-slate-600 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400 hover:border-primary-400';
                                return ['LOW', 'MEDIUM', 'HIGH'].map(p => `
                                <span data-priority="${p}" class="px-2 py-1 text-xs font-bold rounded border cursor-pointer ${p === card.priority ? activePriorityClasses[p] : inactivePriorityClasses}">${p}</span>
                            `).join('');
                            })()}
                        </div>
                    </div>
                    <div class="space-y-1">
                        <label class="text-xs font-semibold text-slate-500 tracking-wider">Due Date</label>
                        <div class="detail-date text-sm text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-1 rounded transition-colors">${card.dueDate || 'No date set'}</div>
                    </div>
                </div>

                <div class="space-y-1">
                    <label class="text-xs font-semibold text-slate-500 tracking-wider">Labels (comma separated)</label>
                    <div class="detail-labels flex flex-wrap gap-1 cursor-pointer p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        ${card.labels.length ? card.labels.map(l => `<span class="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">${l}</span>`).join(' ') : '<span class="text-sm text-slate-400 italic">No labels - click to add</span>'}
                    </div>
                </div>

                <div class="pt-6 border-t border-slate-200 dark:border-slate-700 space-y-4">
                    <label class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Comments</label>
                    <div class="comments-list space-y-3">
                        <div class="text-center py-4 text-sm text-slate-400">Loading comments...</div>
                    </div>
                    <div class="space-y-2">
                        <div id="comment-editor"></div>
                        <div class="flex justify-end">
                            <button id="add-comment-btn" class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-lg transition-all active:scale-95 disabled:opacity-50">Comment</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="pt-6 mt-6 flex justify-between items-center border-t border-slate-200 dark:border-slate-700">
                <div class="flex gap-3">
                    <button id="archive-card-btn" class="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Archive</button>
                    <button id="delete-card-btn" class="px-4 py-2 text-sm font-semibold text-red-500 hover:text-red-700 transition-colors">Delete</button>
                </div>
                <button class="close-detail-btn px-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-all">Close</button>
            </div>
        `;

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            box.classList.remove('scale-95', 'opacity-0');
            box.classList.add('scale-100', 'opacity-100');
        }, 10);

        // Attach edit listeners
        if (role !== 'VIEWER') {
            const titleEl = content.querySelector('.detail-title');
            titleEl.onclick = () => callbacks?.onEditTitle?.(titleEl, card);
            const descEl = content.querySelector('.detail-description');
            descEl.onclick = (e) => {
                if (e.target.closest('a')) return; // let links open instead of entering edit mode
                callbacks?.onEditDescription?.(descEl, card);
            };
            const labelsEl = content.querySelector('.detail-labels');
            labelsEl.onclick = () => callbacks?.onEditLabels?.(labelsEl, card);
            const dateEl = content.querySelector('.detail-date');
            dateEl.onclick = () => callbacks?.onEditDate?.(dateEl, card);
            content.querySelectorAll('.detail-priority span').forEach(span => {
                span.onclick = () => callbacks?.onEditPriority?.(span.dataset.priority, card);
            });
        }

        // Attach archive/delete listeners
        const archiveBtn = content.querySelector('#archive-card-btn');
        const deleteBtn = content.querySelector('#delete-card-btn');
        if (role !== 'VIEWER') {
            if (archiveBtn) archiveBtn.onclick = () => callbacks?.onArchive?.(card.id);
            if (deleteBtn) deleteBtn.onclick = () => callbacks?.onDelete?.(card.id);
        } else {
            if (archiveBtn) archiveBtn.classList.add('hidden');
            if (deleteBtn) deleteBtn.classList.add('hidden');
        }

        // Attach close listeners
        modal.querySelectorAll('.close-detail-btn').forEach(btn => {
            btn.onclick = () => this.closeDetailModal();
        });

        // Rich-text comment composer (replaced together with the modal body on every render)
        this.commentEditor = createRichEditor(content.querySelector('#comment-editor'), {
            placeholder: 'Write a comment...',
            compact: true,
        });
    },

    closeDetailModal() {
        this.commentEditor = null;
        const modal = document.getElementById('card-detail-modal');
        const content = modal.querySelector('.relative');
        content.classList.remove('scale-100', 'opacity-100');
        content.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 200);
    },

    renderComments(container, comments) {
        if (!comments || comments.length === 0) {
            container.innerHTML = '<div class="text-center py-4 text-sm text-slate-400">No comments yet. Be the first to add one!</div>';
            return;
        }

        container.innerHTML = comments.map(c => `
            <div class="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1 group">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-slate-700 dark:text-slate-200">${c.userName}</span>
                        <span class="text-[10px] text-slate-400">${new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <button class="delete-comment-btn text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" data-comment-id="${c.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
                <div class="rich-content text-sm text-slate-600 dark:text-slate-400">${toDisplayHtml(c.content)}</div>
            </div>
        `).join('');
    },

    renderArchivedCards(container, archivedCards, role, onRestore) {
        if (!archivedCards || archivedCards.length === 0) {
            container.innerHTML = '<div class="col-span-full text-center py-12 text-slate-400">No archived cards found.</div>';
            return;
        }

        container.innerHTML = archivedCards.map(card => `
            <div class="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-3">
                <div>
                    <h4 class="font-bold text-slate-800 dark:text-slate-100 line-clamp-1">${card.title}</h4>
                    <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">${escapeHtml(toPlainText(card.description)) || 'No description'}</p>
                </div>
                <div class="flex items-center justify-between mt-auto pt-3 border-t border-slate-100 dark:border-slate-700">
                    <span class="text-[10px] text-slate-400">Archived: ${card.archivedAt ? new Date(card.archivedAt).toLocaleDateString() : 'Unknown'}</span>
                    ${role !== 'VIEWER' ? `
                        <button class="restore-card-btn text-xs font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors" data-card-id="${card.id}">
                            Restore
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');

        if (role !== 'VIEWER') {
            container.querySelectorAll('.restore-card-btn').forEach(btn => {
                btn.onclick = () => onRestore(btn.dataset.cardId);
            });
        }
    },

    openArchivedModal() {
        const modal = document.getElementById('archived-cards-modal');
        const content = modal.querySelector('.relative');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            content.classList.remove('scale-95', 'opacity-0');
            content.classList.add('scale-100', 'opacity-100');
        }, 10);
    },

    closeArchivedModal() {
        const modal = document.getElementById('archived-cards-modal');
        const content = modal.querySelector('.relative');
        content.classList.remove('scale-100', 'opacity-100');
        content.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 200);
    }
}
