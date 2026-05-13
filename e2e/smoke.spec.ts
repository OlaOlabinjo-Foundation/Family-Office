import { expect, test } from '@playwright/test'

test('sign in and load dashboard', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Username').fill('lead')
  await page.getByLabel('Password').fill('demo')
  await page.getByRole('button', { name: 'Enter command centre' }).click()
  await expect(page).toHaveURL(/\/$/, { timeout: 45_000 })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 45_000 })
})
