import { test, expect } from '@playwright/test';
const paths = ['/hvac-optimization', '/hvac-optimization-pilot', '/hvac-optimization-companies', '/privacy', '/about', '/hvac-optimization-evidence'];
for (const path of paths) {
  for (const tagged of [false, true]) {
    test(`${path} direct contact ${tagged ? 'tagged' : 'untagged'} without storage`, async ({ page }) => {
      await page.addInitScript(() => {
        for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name, { get() { throw new Error('Storage unavailable'); } });
        Object.defineProperty(document, 'cookie', { get() { throw new Error('Cookies unavailable'); }, set() { throw new Error('Cookies unavailable'); } });
      });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.emulateMedia({ reducedMotion: tagged ? 'reduce' : 'no-preference' });
      await page.goto(path + (tagged ? '?utm_source=synthetic&utm_medium=organic&utm_campaign=research&email=PRIVATE&_vercel_share=SECRET&source_path=/privacy' : ''));
      const link = page.locator('main a[data-contact-source]').first();
      const href = await link.getAttribute('href');
      const target = new URL(href, page.url());
      expect(target.pathname).toBe('/');
      expect(target.searchParams.get('source_path')).toBe(path);
      expect(target.searchParams.get('utm_source')).toBe(tagged ? 'synthetic' : null);
      expect(href).not.toMatch(/PRIVATE|SECRET|email|_vercel/);
      await link.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#inquiry-name')).toBeFocused();
      await expect(page.locator('#inquiry-name')).toBeInViewport();
      await page.reload();
      await expect(page.locator('#inquiry-name')).toBeFocused();
      expect(new URL(page.url()).searchParams.get('source_path')).toBe(path);
      await page.goBack();
      expect(new URL(page.url()).pathname).toBe(path);
      await page.goForward();
      expect(new URL(page.url()).searchParams.get('source_path')).toBe(path);
      await page.keyboard.press('Tab');
      expect(errors).toEqual([]);
    });
  }
  test(`${path} native contact without JavaScript`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    try {
      const page = await context.newPage();
      await page.goto(baseURL + path + '?utm_source=not-carried');
      await page.locator('main a[data-contact-source]').first().click();
      expect(new URL(page.url()).searchParams.get('source_path')).toBe(path);
      expect(new URL(page.url()).searchParams.has('utm_source')).toBe(false);
      await expect(page.locator('#contact-title')).toBeInViewport();
      await expect(page.locator('.contact__fallback')).toBeVisible();
    } finally { await context.close(); }
  });
}

test('malicious and duplicate query fields cannot taint resource contact links', async ({ page }) => {
  for (const search of ['?utm_source=one&utm_source=two&utm_campaign=valid&source_path=//evil.example', '?utm_source=' + 'x'.repeat(101), '?utm_source=valid&x=' + 'x'.repeat(2001)]) {
    await page.goto('/hvac-optimization' + search);
    const href = await page.locator('main a[data-contact-source]').first().getAttribute('href');
    const params = new URL(href, page.url()).searchParams;
    expect(params.get('source_path')).toBe('/hvac-optimization');
    expect(params.has('utm_source')).toBe(false);
    expect(href).not.toContain('evil');
  }
});

test('a resource-to-resource visit records only the final contact page, with no invented referrer', async ({ page }) => {
  await page.goto('/hvac-optimization-pilot?utm_source=initial_campaign');
  await page.locator('.buyer-guide__related a[href="/hvac-optimization-companies"]').click();
  const href = await page.locator('main a[data-contact-source]').getAttribute('href');
  const params = new URL(href, page.url()).searchParams;
  expect(params.get('source_path')).toBe('/hvac-optimization-companies');
  expect([...params.keys()]).toEqual(['source_path']);
});
