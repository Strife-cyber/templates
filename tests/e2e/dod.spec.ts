import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(fileURLToPath(import.meta.url), '../../../samples/output')
mkdirSync(OUT, { recursive: true })

async function openTemplate(page: import('@playwright/test').Page, name: string) {
  await page.goto('/')
  await page.getByRole('button', { name }).first().click()
  await expect(page).toHaveURL(/#\/editor\//)
}

async function chooseScenario(page: import('@playwright/test').Page, label: string) {
  // The scenario picker is the select that contains the 'Choose data…' option.
  await page
    .locator('select', { has: page.locator('option', { hasText: 'Choose data…' }) })
    .first()
    .selectOption({ label })
}

test.describe('Definition of Done', () => {
  test('A — payment receipt: bind, preview, switch record, export PDF', async ({ page }) => {
    await openTemplate(page, 'Payment Receipt')
    await chooseScenario(page, 'Payment receipt')
    await expect(page.getByText('PAYMENT RECEIPT', { exact: true })).toBeVisible()
    await expect(page.locator('text=College Bilingue')).toBeVisible()

    // Preview modal shows resolved data
    await page.getByRole('button', { name: 'Preview' }).click()
    await expect(page.locator('text=College Bilingue').last()).toBeVisible()
    await page.getByRole('button', { name: 'Close preview' }).click()

    // Export PDF → save artifact
    const dl = page.waitForEvent('download')
    await page.getByRole('button', { name: 'PDF', exact: true }).click()
    await (await dl).saveAs(join(OUT, 'payment-receipt.pdf'))
  })

  test('B — report card: subject table expands with collection rows', async ({ page }) => {
    await openTemplate(page, 'Report Card')
    await chooseScenario(page, 'Report card')
    await expect(page.locator('text=College Bilingue Saint-André')).toBeVisible()
    await expect(page.locator('text=Mathematics').first()).toBeVisible()
    await expect(page.locator('text=No rows')).toHaveCount(0)

    const dl = page.waitForEvent('download')
    await page.getByRole('button', { name: 'PDF', exact: true }).click()
    await (await dl).saveAs(join(OUT, 'report-card.pdf'))
  })

  test('C — class PV: row source, formulas, recalc, PDF + XLSX', async ({ page }) => {
    await openTemplate(page, 'Class PV — Term Averages')
    await chooseScenario(page, 'Class report (PV)')
    // Row source populates bound columns; formulas compute averages.
    await expect(page.locator('text=Mbappe Acha').first()).toBeVisible()
    const dl = page.waitForEvent('download')
    await page.getByRole('button', { name: 'XLSX' }).click()
    await (await dl).saveAs(join(OUT, 'class-pv.xlsx'))

    const dl2 = page.waitForEvent('download')
    await page.getByRole('button', { name: 'PDF', exact: true }).click()
    await (await dl2).saveAs(join(OUT, 'class-pv.pdf'))
  })
})
