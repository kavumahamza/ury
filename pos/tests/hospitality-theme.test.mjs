import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import postcss from 'postcss';
import { JSDOM } from 'jsdom';

const css = postcss.parse(readFileSync('packages/ui/src/styles/hospitality.css', 'utf8'));

function rootTokens(selection, dark = false) {
  const document = new JSDOM('<html></html>').window.document;
  if (selection) document.documentElement.dataset.uryTheme = selection;
  if (dark) document.documentElement.classList.add('dark');
  const tokens = {};
  css.walkRules((rule) => {
    if (document.documentElement.matches(rule.selector)) {
      rule.walkDecls(/^--/, ({ prop, value }) => { tokens[prop] = value; });
    }
  });
  return tokens;
}

test('warm surfaces require the fixed opt-in and preserve explicit dark mode', () => {
  const tokens = rootTokens('hospitality');
  assert.ok(tokens['--background'], 'Opt-in needs a canvas');
  assert.notEqual(tokens['--background'], tokens['--card'], 'Cards need distinct surfaces');
  const [hue, saturation] = tokens['--background'].split(' ').map(Number.parseFloat);
  assert.ok(hue > 20 && hue < 60 && saturation > 0, 'Canvas needs a warm neutral');
  for (const selection of [null, 'off', 'invalid']) assert.deepEqual(rootTokens(selection), {});
  assert.deepEqual(rootTokens('hospitality', true), {});
});

test('hospitality preserves native heading typography', () => {
  css.walkDecls(/^(font|font-family|line-height|overflow-wrap)$/, (decl) => {
    assert.fail(`Appearance opt-in must retain native typography: ${decl.prop}`);
  });
});

test('focus policy remains independent of appearance selection', () => {
  css.walkRules((rule) => assert.ok(!rule.selector.includes(':focus'), 'Theme must not gate focus policy'));
  css.walkDecls('--ring', () => assert.fail('Theme must retain the native focus token'));
});

test('reduced motion policy remains independent of appearance selection', () => {
  css.walkAtRules('media', (rule) => assert.ok(!rule.params.includes('prefers-reduced-motion'),
    'Theme must not gate reduced motion policy'));
});

test('native control/status/backdrop colors retain ownership', () => {
  assert.ok(!Object.keys(rootTokens('hospitality')).some((name) => name.startsWith('--primary')));
  css.walkDecls((decl) => {
    if (decl.prop.startsWith('--')) return;
    assert.ok(['background-color', 'color'].includes(decl.prop), 'Only neutral surface colors belong here');
    assert.ok(decl.parent.selector.endsWith(' body') || decl.parent.selector.includes('#app >'),
      'Color adapters must stay on the page canvas, preserving native controls and backdrops');
  });
});
