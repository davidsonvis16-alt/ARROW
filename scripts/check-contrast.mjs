/**
 * Contrast check for the ARROW palette.
 *
 * Reads the design tokens as the browser computes them, in both themes, and
 * measures each text/background pair that the UI actually uses against the
 * WCAG AA threshold for body text (4.5:1). Run it after changing theme.css:
 *
 *   npm run dev
 *   node scripts/check-contrast.mjs
 *
 * Exits non-zero if any pair falls below the threshold.
 */
import { chromium } from 'playwright';

// Read the tokens as the browser actually computes them, in both themes, and
// check text/background pairs against the WCAG AA threshold for body text.
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

function luminance([r, g, b]) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const parse = (css) => css.match(/\d+/g).slice(0, 3).map(Number);

const failures = [];

const PAIRS = [
  ['--color-ink', '--color-offwhite', 'body text on page'],
  ['--color-ink', '--color-surface', 'body text on card'],
  ['--color-ink', '--color-surface-subtle', 'body text on subtle card'],
  ['--color-stone-dark', '--color-surface', 'secondary text on card'],
  ['--color-stone-dark', '--color-offwhite', 'secondary text on page'],
  ['--color-arrow-orange-text', '--color-surface', 'brand text on card'],
  ['--color-danger-text', '--color-danger-subtle', 'error text on error panel'],
  ['--color-forest', '--color-forest-subtle', 'accent text on accent panel'],
  ['--color-rail-ink', '--color-rail', 'nav text on rail'],
];

for (const dark of [false, true]) {
  const ctx = await browser.newContext({ colorScheme: dark ? 'dark' : 'light' });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

  const values = await page.evaluate((pairs) => {
    const cs = getComputedStyle(document.documentElement);
    const probe = document.createElement('div');
    document.body.appendChild(probe);
    const out = {};
    for (const token of new Set(pairs.flatMap((p) => [p[0], p[1]]))) {
      probe.style.color = cs.getPropertyValue(token).trim();
      out[token] = getComputedStyle(probe).color;
    }
    probe.remove();
    return out;
  }, PAIRS);

  console.log(`\n${dark ? 'DARK' : 'LIGHT'}`);
  for (const [fg, bg, label] of PAIRS) {
    const r = ratio(parse(values[fg]), parse(values[bg]));
    const pass = r >= 4.5 ? 'AA ' : r >= 3 ? 'AA-large' : 'FAIL';
    if (r < 4.5) failures.push(`${dark ? 'dark' : 'light'}: ${label} (${r.toFixed(2)})`);
    console.log(`  ${r.toFixed(2).padStart(6)}  ${pass.padEnd(9)} ${label}`);
  }
  await ctx.close();
}

await browser.close();

if (failures.length > 0) {
  console.error(`\n${failures.length} pair(s) below 4.5:1`);
  process.exit(1);
}
console.log('\nAll pairs meet WCAG AA for body text.');
