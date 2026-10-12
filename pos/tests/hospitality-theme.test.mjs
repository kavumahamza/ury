import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import test from 'node:test';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import { JSDOM } from 'jsdom';
import preset from '../../packages/ui/tailwind-preset.js';

function stylesheet(file) {
  return readFileSync(file, 'utf8').replace(/@import\s+['"]([^'"]+)['"];?/g, (_, name) => {
    const target = name.startsWith('@ury/ui/')
      ? resolve('packages/ui/src', name.slice('@ury/ui/'.length))
      : resolve(dirname(file), name);
    return stylesheet(target);
  });
}
const controls = '<main class="bg-gray-100"><article class="bg-white border-gray-200"><h1>Salama restaurant</h1><p class="text-gray-500">Unpaid bill · Table 12</p><button class="bg-primary text-primary-foreground">Settle UGX 126,000</button><p class="text-red-700">Late</p></article></main>';

function rgb(value) {
  const [h, s, l] = value.split(' ').map(Number.parseFloat);
  const a = s / 100 * Math.min(l / 100, 1 - l / 100);
  return [0, 8, 4].map((n) => {
    const k = (n + h / 30) % 12;
    return l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  });
}
function contrast(first, second) {
  const luminance = (value) => rgb(value).map((c) => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
    .reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
  const pair = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (pair[0] + .05) / (pair[1] + .05);
}
async function render(app, selection, dark = false) {
  const result = await postcss([tailwind({ content: [{ raw: controls, extension: 'html' }], presets: app === 'pos' ? [preset] : undefined, corePlugins: { preflight: false } })])
    .process(stylesheet(resolve(app, 'src/index.css')), { from: resolve(app, 'src/index.css') });
  const dom = new JSDOM(`<html ${selection ? `data-ury-theme="${selection}"` : ''} class="${dark ? 'dark' : ''}"><body>${controls}</body></html>`);
  const tokens = {};
  const priorities = {};
  result.root.walkRules((rule) => {
    if (rule.selector.includes('::') || !rule.nodes.some((node) => node.type === 'decl' && node.prop.startsWith('--'))) return;
    if (rule.parent.type === 'atrule' && rule.parent.name === 'media') return;
    if (dom.window.document.documentElement.matches(rule.selector)) {
      const priority = (rule.selector.match(/[.#[:]/g) || []).length;
      rule.walkDecls(/^--/, (decl) => {
        if (priority >= (priorities[decl.prop] ?? -1)) {
          tokens[decl.prop] = decl.value;
          priorities[decl.prop] = priority;
        }
      });
    }
  });
  // Resolve token values for jsdom, which does not implement CSS var() colours.
  const resolveTokens = (value) => value.replace(/var\((--[\w-]+)(?:,\s*([^()]+))?\)/g,
    (original, key, fallback) => tokens[key] ? resolveTokens(tokens[key]) : fallback || original);
  for (const key of Object.keys(tokens)) tokens[key] = resolveTokens(tokens[key]);
  // The fixture represents a light device; jsdom does not evaluate media queries.
  result.root.walkAtRules('media', (rule) => {
    if (rule.params === '(prefers-color-scheme: light)') rule.replaceWith(...rule.nodes);
  });
  const css = resolveTokens(result.root.toString());
  const style = dom.window.document.createElement('style');
  style.textContent = css;
  dom.window.document.head.appendChild(style);
  const computed = (selector) => dom.window.getComputedStyle(dom.window.document.querySelector(selector));
  return { tokens, computed };
}

for (const app of ['pos', 'urypos', 'mosaic']) {
  test(`${app}: opts into a warm canvas, distinct cards, readable headings and visible focus`, async () => {
    const before = await render(app, null);
    const after = await render(app, 'hospitality');
    assert.notEqual(after.computed('body').backgroundColor, before.computed('body').backgroundColor, 'Missing hospitality canvas');
    const [red, , blue] = rgb(after.tokens['--background']);
    assert.ok(red > blue, 'Canvas must be warm rather than cool grey');
    assert.notEqual(after.computed('main').backgroundColor, after.computed('article').backgroundColor, 'Bills need a distinct card surface');
    assert.ok(after.computed('h1').fontFamily.includes('serif'), 'Headings need the approved system serif');
    assert.ok(contrast(after.tokens['--foreground'], after.tokens['--background']) >= 4.5, 'Body copy must pass AA');
    assert.ok(contrast(after.tokens['--muted-foreground'], after.tokens['--card']) >= 4.5, 'Secondary copy must pass AA');
    assert.ok(contrast(after.tokens['--ring'], after.tokens['--background']) >= 3, 'Keyboard focus must remain visible');
    assert.equal(after.computed('.text-red-700').color, before.computed('.text-red-700').color, 'Late status keeps its semantic colour');
  });
  test(`${app}: absent and invalid selections retain default rendering`, async () => {
    const before = await render(app, null);
    for (const selection of ['off', 'invalid']) {
      const after = await render(app, selection);
      for (const selector of ['body', 'main', 'article', 'h1', 'button']) {
        assert.equal(after.computed(selector).cssText, before.computed(selector).cssText);
      }
    }
  });
}
test('POS hospitality selection preserves existing dark palette and brand actions', async () => {
  const before = await render('pos', null, true);
  const after = await render('pos', 'hospitality', true);
  for (const token of ['--background', '--foreground', '--card', '--primary', '--ring']) {
    assert.equal(after.tokens[token], before.tokens[token], token);
  }
  assert.equal((await render('pos', 'hospitality')).tokens['--primary'], (await render('pos', null)).tokens['--primary']);
});
