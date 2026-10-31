import { test, expect } from '@playwright/test';
import { installCdnStubs, mockKanbanApi } from './helpers.js';

test('loads the sign-in view and starts OAuth with PKCE', async ({ page }) => {
    await installCdnStubs(page);

    let authorizationUrl;
    await page.route('https://auth.ikoyski.top/oauth2/authorize**', async route => {
        authorizationUrl = new URL(route.request().url());
        await route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: '<!doctype html><title>Mock authorization server</title><p>OAuth request intercepted by Playwright.</p>',
        });
    });

    await page.goto('/kanban.html');
    await expect(page.locator('#app-auth-view')).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();

    await page.getByRole('button', { name: /continue with google/i }).click();

    await expect.poll(() => authorizationUrl?.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authorizationUrl.searchParams.get('client_id')).toBe('kanban-web');
    expect(authorizationUrl.searchParams.get('response_type')).toBe('code');
    expect(authorizationUrl.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:4173/kanban.html');
    expect(authorizationUrl.searchParams.get('state')).toBeTruthy();
    expect(authorizationUrl.searchParams.get('code_challenge')).toBeTruthy();
});

test('exchanges an OAuth callback code and opens the authenticated board', async ({ page }) => {
    await installCdnStubs(page);
    const api = await mockKanbanApi(page, { seedToken: false });
    const expectedState = 'playwright-state';
    const expectedVerifier = 'playwright-code-verifier';

    await page.addInitScript(({ state, verifier }) => {
        sessionStorage.setItem('kanban-auth-pending', JSON.stringify({
            state,
            verifier,
            returnSearch: '',
        }));
    }, { state: expectedState, verifier: expectedVerifier });

    let tokenRequest;
    await page.route('https://auth.ikoyski.top/oauth2/token', async route => {
        tokenRequest = new URLSearchParams(route.request().postData() || '');
        await route.fulfill({
            status: 200,
            headers: { 'access-control-allow-origin': 'http://127.0.0.1:4173' },
            contentType: 'application/json',
            body: JSON.stringify({
                access_token: 'callback-access-token',
                token_type: 'Bearer',
                expires_in: 3600,
            }),
        });
    });

    await page.goto(`/kanban.html?code=mock-authorization-code&state=${expectedState}`);

    await expect(page.locator('#app-board-view')).toBeVisible();
    await expect(page.locator('#board-name')).toContainText('Demo Board');
    await expect.poll(() => tokenRequest?.get('code')).toBe('mock-authorization-code');
    expect(tokenRequest.get('code_verifier')).toBe(expectedVerifier);
    expect(tokenRequest.get('redirect_uri')).toBe('http://127.0.0.1:4173/kanban.html');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('kanban-auth'))).toContain('callback-access-token');
    await expect(page).not.toHaveURL(/code=|state=/);
    expect(api.calls.some(call => call.path === '/v1/users/me')).toBeTruthy();
});

test('keeps the sign-in view usable when the auth redirect returns an OAuth error', async ({ page }) => {
    await installCdnStubs(page);

    await page.addInitScript(() => {
        sessionStorage.setItem('kanban-auth-pending', JSON.stringify({
            state: 'known-state',
            verifier: 'known-verifier',
            returnSearch: '',
        }));
    });

    await page.goto('/kanban.html?error=access_denied&error_description=Consent+was+denied&state=known-state');

    await expect(page.locator('#app-auth-view')).toBeVisible();
    await expect(page.locator('#auth-message')).toContainText('Consent was denied');
});
