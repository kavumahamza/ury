import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import test from 'node:test';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import { JSDOM } from 'jsdom';
import preset from '../../packages/ui/tailwind-preset.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { loadModule } from '../../packages/core/test/brand-harness.mjs';

const require = createRequire(import.meta.url);
const buttonSource = ts.transpileModule(readFileSync('packages/ui/src/components/button.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const buttonExports = {};
vm.runInNewContext(buttonSource, { exports: buttonExports, require: (name) => name === '../lib/cn'
  ? loadModule(resolve('packages/ui/src/lib/cn.ts'), {}, { clsx: require('clsx'), 'tailwind-merge': require('tailwind-merge') })
  : require(name) });
const nativeTabs = renderToStaticMarkup(React.createElement('nav', null,
  React.createElement(buttonExports.Button, { variant: 'tab', 'data-selected': true, id: 'selected' }, 'Dining room'),
  React.createElement(buttonExports.Button, { variant: 'tab', 'data-selected': false, id: 'unselected' }, 'Terrace')));


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
async function render(app, selection, dark = false, markup = controls, componentCss = '') {
  const result = await postcss([tailwind({ content: [{ raw: markup, extension: 'html' }], presets: app === 'pos' ? [preset] : undefined, corePlugins: { preflight: false } })])
    .process(stylesheet(resolve(app, 'src/index.css')) + componentCss, { from: resolve(app, 'src/index.css') });
  const dom = new JSDOM(`<html ${selection ? `data-ury-theme="${selection}"` : ''} class="${dark ? 'dark' : ''}"><body>${markup}</body></html>`);
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
  // jsdom does not reliably apply selector specificity. For native state/backdrop
  // colours, inspect matching emitted rules and apply their CSS cascade order.
  const cascadeColor = (selector, property) => {
    const element = dom.window.document.querySelector(selector);
    const candidates = [];
    postcss.parse(css).walkRules((rule) => {
      if (rule.parent.type === 'atrule' && rule.parent.name === 'media') return;
      const selectors = rule.selector.split(/,(?![^()]*\))/);
      for (const candidate of selectors) {
        let matches = false;
        try { matches = element.matches(candidate); } catch { continue; }
        if (!matches) continue;
        const simple = candidate.replace(/\\./g, '_').replace(/:(?:is|not)\(([^()]*)\)/g, (_, arms) =>
          arms.split(',').sort((a, b) => (b.match(/[.#[:]/g) || []).length - (a.match(/[.#[:]/g) || []).length)[0]);
        const idCount = (simple.match(/#[\w-]+/g) || []).length;
        const classCount = (simple.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+/g) || []).length;
        const typeCount = (simple.replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|:[\w-]+/g, '').match(/\b[a-zA-Z][\w-]*\b/g) || []).length;
        rule.walkDecls(property, (decl) => candidates.push({ value: decl.value, score: idCount * 10000 + classCount * 100 + typeCount }));
      }
    });
    const winner = candidates.sort((a, b) => a.score - b.score).at(-1);
    assert.ok(winner, `Missing native ${property} for ${selector}`);
    const sample = dom.window.document.createElement('span');
    sample.style.setProperty(property, winner.value);
    dom.window.document.body.appendChild(sample);
    const color = dom.window.getComputedStyle(sample).getPropertyValue(property);
    sample.remove();
    return color;
  };
  return { tokens, computed, cascadeColor };
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

for (const [selection, dark] of [[null, false], ['hospitality', false], ['hospitality', true]]) {
  test(`native POS room tabs retain selected background and text: ${selection || 'default'} / ${dark ? 'dark' : 'light'}`, async () => {
    const screen = await render('pos', selection, dark, nativeTabs);
    for (const property of ['background-color', 'color']) {
      assert.notEqual(screen.cascadeColor('#selected', property), screen.cascadeColor('#unselected', property),
        `Selected room must remain visibly distinct in ${property}`);
    }
  });
}
for (const [app, file] of [['urypos', 'urypos/src/components/Menu.vue'], ['mosaic', 'mosaic/src/components/kot.vue']]) {
  test(`${app}: native modal backdrop stays translucent while its card stays opaque`, async () => {
    const source = readFileSync(file, 'utf8');
    const backdropClass = source.match(/class="(fixed inset-0[^"\n]*bg-gray-100)"/)[1];
    const cardClass = source.match(/class="([^"\n]*rounded-lg bg-white[^"\n]*)"/)[1];
    const css = source.match(/<style[^>]*>([\s\S]*?)<\/style>/)[1];
    const markup = `<div id="backdrop" class="${backdropClass}"><article id="card" class="${cardClass}">Native permission/menu dialog</article></div>`;
    for (const selection of [null, 'hospitality']) {
      const screen = await render(app, selection, false, markup, css);
      assert.match(screen.cascadeColor('#backdrop', 'background-color'), /^rgba\([^)]*,\s*0\.[0-9]+\)$/, 'Native backdrop must retain alpha below 1');
      assert.match(screen.cascadeColor('#card', 'background-color'), /^rgb\(/, 'Native modal card must remain opaque');
    }
  });
}
