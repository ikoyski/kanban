import { loadPartials } from './partial-loader.js';
import * as Auth from './auth.js';

document.addEventListener('click', async (event) => {
    const button = event.target.closest?.('#signin-btn');
    if (!button) return;
    event.preventDefault();
    const message = document.getElementById('auth-message');
    if (!message || button.disabled) return;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    message.textContent = 'Connecting to the sign-in service…';
    message.classList.remove('hidden');
    try {
        await Auth.startLogin();
    } catch (error) {
        console.error('Could not start sign-in:', error);
        message.textContent = 'Could not start sign-in: ' + error.message;
        button.disabled = false;
        button.removeAttribute('aria-busy');
    }
}, true);

async function bootstrap() {
    try {
        await loadPartials();

        // Refresh shared DOM references after all partials have loaded.
        await import('./ui/dom.js');

        // Install all extracted implementations before the security and lifecycle decorators.
        // This ordering ensures decorators wrap the active UI methods.
        await import('./ui/board-view.js');
        await import('./ui/board-cards.js');
        await import('./ui/app-state.js');
        await import('./ui/modals.js');
        await import('./ui/members.js');
        await import('./ui/content-renderers.js');
        await import('./ui/inline-edit.js');
        await import('./ui/card-detail.js');

        await import('./ui-security.js');
        await import('./ui-edit-preservation.js');
        await import('./ui-editor-lifecycle.js');
        await import('./app.js?v=20261101-app-modules');
    } catch (error) {
        console.error('Kanban failed to initialize:', error);
        const message = document.createElement('div');
        message.className = 'min-h-screen flex items-center justify-center p-6 bg-slate-50 text-slate-800';
        message.setAttribute('role', 'alert');
        const content = document.createElement('div');
        content.className = 'max-w-md rounded-xl border border-red-200 bg-white p-6 shadow-lg';
        const title = document.createElement('h1');
        title.className = 'text-lg font-bold';
        title.textContent = 'Kanban could not finish loading';
        const description = document.createElement('p');
        description.className = 'mt-2 text-sm text-slate-600';
        description.textContent = 'A page component could not be loaded. Check your connection and refresh the page. If the problem continues, contact the application administrator.';
        const refresh = document.createElement('button');
        refresh.type = 'button';
        refresh.className = 'mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700';
        refresh.textContent = 'Refresh page';
        refresh.addEventListener('click', () => window.location.reload());
        content.append(title, description, refresh);
        message.append(content);
        document.body.replaceChildren(message);
    }
}
bootstrap();
