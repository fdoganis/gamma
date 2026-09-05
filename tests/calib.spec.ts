import { test, expect } from '@playwright/test';

// ?calib runs CalibState (dev-only, folds out of prod). No WebXR here, so no
// joints are recorded and nothing is sent — this just checks the guided scene
// boots, the whack phase auto-paces (advances without a hit), and it reaches the
// idle phase without errors. Real capture needs a headset (see the guide).
test('calib scene: boots, auto-paces, no errors', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console.error: ${m.text()}`); });

  await page.goto('/?calib');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(800);

  const a = await canvas.screenshot();
  await page.waitForTimeout(6000); // ~2 auto-paced whack windows
  const b = await canvas.screenshot();

  expect(Buffer.compare(a, b), 'the whack phase advanced (target respawned)').not.toBe(0);
  expect(problems, 'no page errors in the calib scene').toEqual([]);
});
