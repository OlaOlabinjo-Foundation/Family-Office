import { expect, test } from '@playwright/test'

async function signInAsLead(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel('Username').fill('lead')
  await page.getByLabel('Password').fill('demo')
  await page.getByRole('button', { name: 'Enter command centre' }).click()
  await expect(page).toHaveURL(/\/$/, { timeout: 45_000 })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 45_000 })
}

test.describe('Critical paths', () => {
  test('lead can open treasury and reports', async ({ page }) => {
    await signInAsLead(page)
    await page.getByRole('link', { name: /Treasury/i }).first().click()
    await expect(page).toHaveURL(/\/treasury/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 })

    await page.getByRole('link', { name: /^Reports$/i }).first().click()
    await expect(page).toHaveURL(/\/reports/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 })
  })

  test('lead can open compliance and global search', async ({ page }) => {
    await signInAsLead(page)
    await page.getByRole('link', { name: /^Compliance$/i }).first().click()
    await expect(page).toHaveURL(/\/documents/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 })

    await page.getByPlaceholder(/min\. 2 characters/i).fill('asset')
    await page.getByRole('button', { name: /^Search$/i }).click()
    await expect(page).toHaveURL(/\/search\?q=asset/)
  })

  test('lead can open Excel import hub', async ({ page }) => {
    await signInAsLead(page)
    await page.getByRole('link', { name: /Excel Import/i }).first().click()
    await expect(page).toHaveURL(/\/import/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 })
  })

  test('chairman can sign in and view overview', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: /Chairman/i }).click()
    await page.getByRole('button', { name: 'Enter command centre' }).click()
    await expect(page).toHaveURL(/\/$/, { timeout: 45_000 })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 45_000 })
  })
})
