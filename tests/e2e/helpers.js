export const API_ORIGIN = 'https://api.ikoyski.top';
export const API_PREFIX = '/kanban-backend';

export function makeBoard(id = 'demo-board', name = 'Demo Board') {
    const sampleCardId = id === 'demo-board' ? 'sample-card' : `sample-card-${id}`;
    return {
        id,
        name,
        role: 'OWNER',
        columns: {
            todo: {
                id: 'todo',
                title: 'To Do',
                position: 0,
                cardIds: [sampleCardId],
            },
            doing: {
                id: 'doing',
                title: 'In Progress',
                position: 1,
                cardIds: [],
            },
        },
        cards: {
            [sampleCardId]: {
                id: sampleCardId,
                title: 'Sample task',
                description: 'A sample description for browser tests.',
                priority: 'MEDIUM',
                dueDate: '',
                labels: ['Testing'],
                commentCount: 0,
                createdAt: '2026-01-01T00:00:00Z',
            },
        },
    };
}

export async function installCdnStubs(page) {
    await page.route('https://cdn.tailwindcss.com', route => route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: "window.tailwind = window.tailwind || {}; document.head.insertAdjacentHTML('beforeend', '<style>.hidden{display:none!important}.flex{display:flex}.inline-flex{display:inline-flex}</style>');",
    }));

    await page.route('https://cdn.jsdelivr.net/**', async route => {
        const url = route.request().url();

        if (url.includes('Sortable.min.js')) {
            await route.fulfill({
                status: 200,
                contentType: 'application/javascript',
                body: `
                    window.Sortable = {
                        create(element, options) {
                            const instance = { destroy() {} };
                            element.__playwrightSortable = options;
                            return instance;
                        }
                    };
                `,
            });
            return;
        }

        if (url.includes('/quill.snow.css')) {
            await route.fulfill({ status: 200, contentType: 'text/css', body: '' });
            return;
        }

        if (url.includes('/quill.js')) {
            await route.fulfill({
                status: 200,
                contentType: 'application/javascript',
                body: `
                    window.Quill = class QuillMock {
                        constructor(host) {
                            const container = document.createElement('div');
                            container.className = 'ql-container';
                            this.root = document.createElement('div');
                            this.root.className = 'ql-editor';
                            this.root.contentEditable = 'true';
                            container.appendChild(this.root);
                            host.appendChild(container);
                            this.clipboard = { convert: ({ html }) => html };
                            this.history = { clear() {} };
                        }
                        getText() { return this.root.textContent + '\\n'; }
                        setContents(html) { this.root.innerHTML = String(html || ''); }
                        setText(text) { this.root.textContent = text || ''; }
                        getLength() { return this.getText().length; }
                        setSelection() {}
                        focus() { this.root.focus(); }
                    };
                `,
            });
            return;
        }

        if (url.includes('/purify.min.js')) {
            await route.fulfill({
                status: 200,
                contentType: 'application/javascript',
                body: `
                    window.DOMPurify = {
                        addHook() {},
                        removeHook() {},
                        sanitize(value) { return String(value ?? ''); }
                    };
                `,
            });
            return;
        }

        await route.continue();
    });
}

export async function seedAuthenticatedSession(page) {
    await page.addInitScript(() => {
        localStorage.setItem('kanban-auth', JSON.stringify({
            accessToken: 'playwright-access-token',
            expiresAt: Date.now() + 60 * 60 * 1000,
        }));
    });
}

export async function mockKanbanApi(page, { seedToken = true } = {}) {
    const boards = {
        'demo-board': makeBoard(),
        'second-board': makeBoard('second-board', 'Second Board'),
    };
    const boardList = Object.values(boards).map(({ id, name }) => ({ id, name }));
    const calls = [];
    const commentsByCard = {};
    const archivedCards = {};

    if (seedToken) await seedAuthenticatedSession(page);

    await page.route(`${API_ORIGIN}/kanban-backend/**`, async route => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname.replace(API_PREFIX, '');
        const method = request.method();

        let requestBody = null;
        try {
            if (request.postData()) requestBody = request.postDataJSON();
        } catch {
            // Some requests (such as preflight and GET requests) have no JSON body.
        }

        calls.push({
            method,
            path,
            authorization: request.headers().authorization || null,
            body: requestBody,
        });

        const corsHeaders = {
            'access-control-allow-origin': 'http://127.0.0.1:4173',
            'access-control-allow-headers': 'authorization,content-type',
            'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
        };

        if (method === 'OPTIONS') {
            await route.fulfill({ status: 204, headers: corsHeaders });
            return;
        }

        if (request.headers().authorization !== 'Bearer playwright-access-token' &&
            request.headers().authorization !== 'Bearer callback-access-token') {
            await route.fulfill({
                status: 401,
                headers: corsHeaders,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Unauthorized in test fixture' }),
            });
            return;
        }

        const respond = (body, status = 200) => route.fulfill({
            status,
            headers: corsHeaders,
            contentType: 'application/json',
            body: body === null ? '' : JSON.stringify(body),
        });

        if (method === 'GET' && path === '/v1/users/me') {
            await respond({
                email: 'playwright@example.test',
                displayName: 'Playwright User',
                avatarUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22%3E%3Ccircle cx=%2220%22 cy=%2220%22 r=%2220%22 fill=%22%23ddd%22/%3E%3C/svg%3E',
            });
            return;
        }

        if (method === 'GET' && path === '/v1/boards') {
            await respond(boardList);
            return;
        }

        const boardMatch = path.match(/^\/v1\/boards\/([^/]+)$/);
        if (method === 'GET' && boardMatch) {
            const board = boards[boardMatch[1]];
            await respond(board ? JSON.parse(JSON.stringify(board)) : { message: 'Board not found' }, board ? 200 : 404);
            return;
        }

        const commentsMatch = path.match(/^\/v1\/comments\/card\/([^/]+)$/);
        if (commentsMatch && method === 'GET') {
            await respond(commentsByCard[commentsMatch[1]] || []);
            return;
        }

        if (commentsMatch && method === 'POST') {
            const comment = {
                id: `comment-${calls.length}`,
                userName: 'Playwright User',
                createdAt: new Date().toISOString(),
                content: request.postDataJSON().content,
            };
            commentsByCard[commentsMatch[1]] ??= [];
            commentsByCard[commentsMatch[1]].push(comment);
            await respond(comment, 201);
            return;
        }

        const deleteCommentMatch = path.match(/^\/v1\/comments\/([^/]+)$/);
        if (deleteCommentMatch && method === 'DELETE') {
            Object.keys(commentsByCard).forEach(cardId => {
                commentsByCard[cardId] = commentsByCard[cardId].filter(
                    comment => comment.id !== deleteCommentMatch[1]
                );
            });
            await respond(null, 204);
            return;
        }

        const archivedListMatch = path.match(/^\/v1\/cards\/board\/([^/]+)\/archived$/);
        if (archivedListMatch && method === 'GET') {
            await respond(archivedCards[archivedListMatch[1]] || []);
            return;
        }

        const archiveMatch = path.match(/^\/v1\/cards\/([^/]+)\/archive$/);
        if (archiveMatch && method === 'POST') {
            const cardId = archiveMatch[1];
            const board = Object.values(boards).find(item => item.cards[cardId]);
            if (!board) {
                await respond({ message: 'Card not found' }, 404);
                return;
            }
            const sourceColumn = Object.values(board.columns).find(column => column.cardIds.includes(cardId));
            const card = board.cards[cardId];
            archivedCards[board.id] ??= [];
            archivedCards[board.id].push({
                ...card,
                archivedAt: new Date().toISOString(),
                originalColumnId: sourceColumn?.id || 'todo',
            });
            if (sourceColumn) sourceColumn.cardIds = sourceColumn.cardIds.filter(id => id !== cardId);
            delete board.cards[cardId];
            await respond(null, 204);
            return;
        }

        const restoreMatch = path.match(/^\/v1\/cards\/([^/]+)\/restore$/);
        if (restoreMatch && method === 'POST') {
            const cardId = restoreMatch[1];
            const boardId = Object.keys(archivedCards).find(id =>
                archivedCards[id].some(card => card.id === cardId)
            );
            const board = boardId ? boards[boardId] : null;
            if (!board) {
                await respond({ message: 'Archived card not found' }, 404);
                return;
            }
            const index = archivedCards[boardId].findIndex(card => card.id === cardId);
            const [card] = archivedCards[boardId].splice(index, 1);
            const { archivedAt, originalColumnId, ...restoredCard } = card;
            board.cards[cardId] = restoredCard;
            const destination = board.columns[originalColumnId] || board.columns.todo;
            destination.cardIds.push(cardId);
            await respond(null, 204);
            return;
        }

        if (method === 'POST' && path === '/v1/cards') {
            const body = request.postDataJSON();
            const cardId = `created-card-${calls.length}`;
            const card = {
                id: cardId,
                title: body.title,
                description: body.description || '',
                priority: body.priority || 'MEDIUM',
                dueDate: body.dueDate || '',
                labels: body.labels || [],
                commentCount: 0,
                createdAt: new Date().toISOString(),
            };
            const board = Object.values(boards).find(item => item.columns[body.columnId]);
            if (board) {
                board.cards[cardId] = card;
                board.columns[body.columnId].cardIds.push(cardId);
            }
            await respond(card, 201);
            return;
        }

        const moveMatch = path.match(/^\/v1\/cards\/([^/]+)\/move$/);
        if (method === 'PATCH' && moveMatch) {
            const body = request.postDataJSON();
            const cardId = moveMatch[1];
            const board = Object.values(boards).find(item => item.cards[cardId]);
            if (!board || !board.columns[body.columnId]) {
                await respond({ message: 'Card or destination not found' }, 404);
                return;
            }
            for (const column of Object.values(board.columns)) {
                column.cardIds = column.cardIds.filter(id => id !== cardId);
            }
            board.columns[body.columnId].cardIds.splice(body.position, 0, cardId);
            await respond(null, 204);
            return;
        }

        const cardMatch = path.match(/^\/v1\/cards\/([^/]+)$/);
        if (cardMatch && method === 'PATCH') {
            const patch = request.postDataJSON();
            const cardId = cardMatch[1];
            const board = Object.values(boards).find(item => item.cards[cardId]);
            if (!board) {
                await respond({ message: 'Card not found' }, 404);
                return;
            }
            Object.assign(board.cards[cardId], patch);
            await respond(board.cards[cardId]);
            return;
        }

        if (cardMatch && method === 'DELETE') {
            const cardId = cardMatch[1];
            for (const board of Object.values(boards)) {
                delete board.cards[cardId];
                for (const column of Object.values(board.columns)) {
                    column.cardIds = column.cardIds.filter(id => id !== cardId);
                }
            }
            await respond(null, 204);
            return;
        }

        await respond({ message: `Unhandled test API request: ${method} ${path}` }, 404);
    });

    return { boards, calls, commentsByCard, archivedCards };
}
