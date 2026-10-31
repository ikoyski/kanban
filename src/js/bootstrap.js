import { loadPartials } from './partial-loader.js';
import * as Auth from './auth.js';

function bindSignInButton() {
    const button = document.getElementById('google-signin-btn');
    const message = document.getElementById('auth-message');

    if (!button || !message) {
        throw new Error('The sign-in view is missing its button or message element.');
    }

    button.addEventListener('click', async () => {
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        message.textContent = '';
        message.classList.add('hidden');

        try {
            await Auth.startLogin();
        } catch (error) {
            console.error('Could not start sign-in:', error);
            message.textContent = 'Could not start sign-in: ' + error.message;
            message.classList.remove('hidden');
            button.disabled = false;
            button.removeAttribute('aria-busy');
        }
    });
}

async function bootstrap() {
    try {
        // ui.js queries the DOM as soon as it is imported, so every partial
        // must be present before app.js (and its UI imports) is evaluated.
        await loadPartials();
        bindSignInButton();
        await import('./app.js');
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
