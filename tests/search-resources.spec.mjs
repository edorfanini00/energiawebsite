import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

for (const path of ['/about', '/hvac-optimization-evidence']) {
  for (const width of [320, 390, 1440]) {
    test(`${path} at ${width}: real page, readable content, native keyboard flow and assets`, async ({ page, request }) => {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const response = await page.goto(path);
      expect(response.status()).toBe(200);
      const raw = await response.text();
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://predictivehvaccontrol.com' + path);
      const text = await page.locator('main').innerText();
      expect(text).not.toMatch(/[-–—]|Draft|TODO|PLACEHOLDER|reviewed by/i);
      expect(text.split(/\s+/).length).toBeGreaterThan(path === '/about' ? 200 : 700);
      expect(raw).toContain('Energia AI');
      await expect(page.locator('script[src]')).toHaveCount(1);
      await expect(page.locator('script[src]')).toHaveAttribute('src', '/contact-links.js');
      expect(await page.locator('main :is(p, li, h1, h2, h3)').evaluateAll(nodes => nodes.filter(el => { const box = el.getBoundingClientRect(); return box.left < 0 || box.right > innerWidth + 1 || el.scrollWidth > el.clientWidth + 1; }).map(el => el.textContent))).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(img => img.decode())); });
      const links = await page.locator('a[href^="/"]').evaluateAll(nodes => [...new Set(nodes.map(a => new URL(a.href).pathname))]);
      for (const link of links) expect((await request.get(link)).status()).toBe(200);
      await page.keyboard.press('Tab');
      await expect(page.locator('.skip')).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('main')).toBeFocused();
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement.tagName)).toBe('A');
      // Walk the actual DOM sequence; every focused link must be in view.
      const allLinks = page.locator('main a');
      for (const link of await allLinks.all()) { await expect(link).toBeFocused(); await expect(link).toBeInViewport(); await page.keyboard.press('Tab'); }
      if (process.env.SEARCH_SCREENSHOTS) {
        await mkdir(process.env.SEARCH_SCREENSHOTS, { recursive: true });
        await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
        await page.screenshot({ path: join(process.env.SEARCH_SCREENSHOTS, path.slice(1) + '-' + width + '-top.png') });
        await page.screenshot({ path: join(process.env.SEARCH_SCREENSHOTS, path.slice(1) + '-' + width + '.png'), fullPage: true });
      }
      await page.locator('main a[data-contact-source]').first().focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#inquiry-name')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.locator('#inquiry-email')).toBeFocused();
      expect(errors).toEqual([]);
    });
  }
}

test('research retains denominators, methods, limitations and explicit third-party attribution', async ({ page }) => {
  await page.goto('/hvac-optimization-evidence');
  const text = await page.locator('main').innerText();
  for (const phrase of ['446 projects', 'whole building source energy savings of 6.4%', '3.4% and 12.4%', '298 utility commissioning projects', '41 utility projects', '107 projects', '10 organizations covering 1,333 buildings', '18 organizations covering 509 buildings', 'medians across organizations', 'did not normalize', 'only two campaign participants', 'synthetic research scenarios', 'hypothetical', 'not a report of savings', 'difficulty maintaining acceptable temperatures', 'do not describe a full year', 'one research implementation update', 'not an independent product ranking or a report of Energia AI field performance', 'Prepared with AI assistance']) expect(text).toContain(phrase);
  const citations = await page.locator('main a[href^="https:"]').evaluateAll(nodes => [...new Set(nodes.map(a => a.href))]);
  expect(citations).toEqual([
    'https://eta-publications.lbl.gov/sites/default/files/crowe_-_building_commissioning_costs_and_savings_.pdf',
    'https://eta-publications.lbl.gov/sites/default/files/kramer_provingbuildinganalytics_october2020.pdf',
    'https://eta-publications.lbl.gov/sites/default/files/2024-10/field_performance_of_building_load_flexibility_model_predictive_control.pdf',
  ]);
  const graph = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent())['@graph'];
  expect(graph[2].citation).toEqual(citations);
  expect(graph[2].publisher).toEqual({ '@id': 'https://predictivehvaccontrol.com/#organization' });
  expect(JSON.stringify(graph)).not.toMatch(/Person|reviewedBy|credential|award/);
  await page.goto('/about');
  const about = await page.locator('main').innerText();
  expect(about).toContain('A simulation is preparation, not a customer result');
  expect(about).toContain('verification of manual override and fallback for the actual installation');
  expect(about).not.toMatch(/\d+%|certified|CEO|CTO|Massimiliano|@/);
});

test('About identifies only the verified founder and links the actual profiles', async ({ page }) => {
  await page.goto('/about');
  await expect(page.locator('#founder + p')).toHaveText('Edoardo Orfanini, founder.');
  await expect(page.getByRole('link', { name: 'Edoardo Orfanini on LinkedIn', exact: true })).toHaveAttribute('href', 'https://www.linkedin.com/in/edoardo-orfanini/');
  await expect(page.getByRole('link', { name: 'Energia AI on LinkedIn', exact: true })).toHaveAttribute('href', 'https://www.linkedin.com/company/energia-ai/');
  expect(await page.locator('main').innerText()).not.toMatch(/sole founder|CEO|CTO|certified|qualified engineer|reviewed by|Celeritech|Revivex|Massimiliano/i);
});
