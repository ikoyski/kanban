import { test, expect } from '@playwright/test';
import { installCdnStubs, mockKanbanApi } from './helpers.js';

test.describe('authenticated board workflows', () => {
    let api;

    test.beforeEach(async ({ page }) => {
        await installCdnStubs(page);
        api = await mockKanbanApi(page);
        await page.goto('/kanban.html');
        await expect(page.locator('#app-board-view')).toBeVisible();
        await expect(page.locator('#board-name')).toContainText('Demo Board');
    });

    test('resolves all HTML partials before rendering the authenticated board', async ({ page }) => {
        await expect(page.locator('#app-auth-view')).toBeHidden();
        await expect(page.locator('#board-container .card')).toHaveCount(1);
        await expect(page.locator('[data-include]')).toHaveCount(0);
        await expect(page.locator('#profile-trigger')).toBeAttached();
        await expect(page.locator('#card-detail-modal')).toBeAttached();
    });

    test('searches cards and opens the card detail modal', async ({ page }) => {
        await page.locator('#search-input').fill('not a matching task');
        await expect(page.locator('.card[data-card-id="sample-card"]')).toBeHidden();

        await page.locator('#search-input').fill('sample task');
        await expect(page.locator('.card[data-card-id="sample-card"]')).toBeVisible();

        await page.locator('.card[data-card-id="sample-card"]').click();
        await expect(page.locator('#card-detail-modal')).toBeVisible();
        await expect(page.locator('#card-detail-body')).toContainText('Card Details');
        await expect(page.locator('#card-detail-body .detail-title')).toHaveText('Sample task');
    });

    test('creates a card and sends the expected payload to the API', async ({ page }) => {
        await page.locator('#col-todo .add-card-btn').click();
        await expect(page.locator('#card-modal')).toBeVisible();

        await page.locator('#form-title').fill('Regression test card');
        await page.locator('#form-labels').fill('UI, Regression');
        await page.locator('label').filter({
            has: page.locator('input[name="priority"][value="HIGH"]'),
        }).click();
        await page.locator('#card-form button[type="submit"]').click();

        await expect(page.locator('.card', { hasText: 'Regression test card' })).toBeVisible();
        const createCall = api.calls.find(call => call.method === 'POST' && call.path === '/v1/cards');
        expect(createCall).toBeTruthy();
        expect(createCall.body).toMatchObject({
            title: 'Regression test card',
            priority: 'HIGH',
            labels: ['UI', 'Regression'],
            columnId: 'todo',
        });
    });

    test('deletes a card only after confirmation', async ({ page }) => {
        const card = page.locator('.card[data-card-id="sample-card"]');
        await card.locator('.delete-btn').click();
        await expect(page.locator('#confirm-modal')).toBeVisible();
        await expect(card).toBeVisible();

        await page.locator('#confirm-delete').click();

        await expect(page.locator('.card[data-card-id="sample-card"]')).toHaveCount(0);
        expect(api.calls.some(call => call.method === 'DELETE' && call.path === '/v1/cards/sample-card')).toBeTruthy();
    });

    test('switches between boards', async ({ page }) => {
        await page.locator('#profile-trigger').click();
        await page.locator('#board-switcher').selectOption('second-board');
        await expect(page.locator('#board-name')).toContainText('Second Board');
        await expect(page.locator('.card')).toHaveAttribute('data-card-id', 'sample-card-second-board');
        expect(api.calls.some(call => call.method === 'GET' && call.path === '/v1/boards/second-board')).toBeTruthy();
    });

    test('toggles dark mode from the profile menu', async ({ page }) => {
        await page.locator('#profile-trigger').click();
        await page.locator('#theme-toggle-menu').click();
        await expect(page.locator('html')).toHaveClass(/dark/);
        await expect(page.locator('#menu-dropdown')).toBeHidden();
    });
});
