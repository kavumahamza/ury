import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { createApp, nextTick, reactive } from 'vue';
import tableSource from '../src/components/Table.vue?raw';
import menuSource from '../src/components/Menu.vue?raw';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import Table from '../src/components/Table.vue';
import Menu from '../src/components/Menu.vue';

const state = vi.hoisted(() => ({}));
vi.mock('../src/stores/Table.js', () => ({ useTableStore: () => state.table }));
vi.mock('../src/stores/Auth.js', () => ({ useAuthStore: () => state.auth }));
vi.mock('../src/stores/Menu.js', () => ({ useMenuStore: () => state.menu }));
vi.mock('../src/stores/invoiceData.js', () => ({ useInvoiceDataStore: () => state.invoiceData }));
vi.mock('../src/stores/recentOrder.js', () => ({ usetoggleRecentOrder: () => state.recentOrders }));
vi.mock('../src/stores/Customer.js', () => ({ useCustomerStore: () => ({}) }));
vi.mock('../src/stores/frappeSdk.js', () => ({ default: {} }));

let app;
let host;
beforeAll(async () => {
  // Generate the same native utility rules from the real component templates.
  // Assertions use readability/touch thresholds, not class names or token values.
  const sources = [tableSource, menuSource].map(raw => ({ raw, extension: 'vue' }));
  const { css } = await postcss([tailwindcss({ content: sources })]).process(
    '@tailwind base; @tailwind utilities;', { from: undefined },
  );
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
});
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const tables = [
    { name: 'Table 01', occupied: 0, state: 'Free' },
    { name: 'Garden Terrace 02', occupied: 1, state: 'Occupied', age: '0:08' },
    { name: 'Table 03', occupied: 1, state: 'Attention', age: '0:27' },
    { name: 'Table 04', occupied: 1, state: 'Active', age: '0:18' },
  ];
  state.auth = reactive({ cashier: false, viewItemImage: true, restrictTableOrder: false, removeTableOrderItem: 1 });
  state.table = reactive({
    tables, filteredTables: tables, rooms: [{ name: 'Dining' }], selectedRoom: 'Dining',
    getBadgeText: row => row.state, getBadgeType: row => ({ Free: 'green', Occupied: 'yellow', Attention: 'red', Active: 'default' })[row.state],
    getTimeDifference: row => row.age, addToSelectedTables: vi.fn(), routeToMenu: vi.fn(), routeToCart: vi.fn(),
    handleRoomChange: vi.fn(), toggleTableTypeSwitch: vi.fn(), toggleDropdown: vi.fn(),
  });
  state.invoiceData = reactive({ currency: 'UGX', billing: vi.fn() });
  state.recentOrders = reactive({ editPrintedInvoice: 0, restaurantTable: false });
  const items = [
    { item: 'CHICKEN', item_name: 'Grilled chicken with garden vegetables and pepper sauce', rate: '125,000', item_image: '/safe-synthetic.svg' },
    { item: 'SOUP', item_name: 'Cream of mushroom soup', rate: '18,000', qty: 2 },
  ];
  state.menu = reactive({
    items, paginatedItems: items, selectedOrderType: 'Dine In', course: [], pageNumbers: [1], currentPage: 1, totalPages: 1,
    getFullImagePath: path => path, itemNameExtract: name => name.slice(0, 2),
    addToCart: vi.fn(), incrementItemQuantity: vi.fn(), decrementItemQuantity: vi.fn(), showModal: vi.fn(),
  });
});
afterEach(() => { app?.unmount(); host?.remove(); vi.restoreAllMocks(); });
function mount(component) {
  host = document.createElement('div');
  document.body.append(host);
  app = createApp(component);
  app.mount(host);
  return host;
}
function pixels(value) { return (value.endsWith('rem') ? parseFloat(value) * 16 : parseFloat(value)) || 0; }
function touchHeight(element) {
  const css = getComputedStyle(element);
  const lineHeight = /^[\d.]+$/.test(css.lineHeight) ? Number(css.lineHeight) * pixels(css.fontSize) : pixels(css.lineHeight);
  return Math.max(pixels(css.minHeight), lineHeight + pixels(css.paddingTop) + pixels(css.paddingBottom) + pixels(css.borderTopWidth) + pixels(css.borderBottomWidth));
}
function buttonNamed(text) { return [...host.querySelectorAll('button')].find(button => button.textContent.includes(text)); }

it('makes each table identity and supported occupied age readable at a glance', () => {
  mount(Table);
  for (const name of host.querySelectorAll('h5')) {
    expect(pixels(getComputedStyle(name).fontSize)).toBeGreaterThanOrEqual(24);
  }
  const age = [...host.querySelectorAll('span')].find(span => span.textContent.trim() === '0:08');
  expect(pixels(getComputedStyle(age).fontSize)).toBeGreaterThanOrEqual(16);
});
it('exposes occupied table navigation and cart viewing as named keyboard controls', () => {
  mount(Table);
  const navigation = host.querySelector('button[aria-label="Open menu for Garden Terrace 02"]');
  expect(navigation).not.toBeNull();
  navigation.click();
  expect(state.table.routeToMenu).toHaveBeenCalledWith(state.table.tables[1]);
  const cart = host.querySelector('button[aria-label="View order for Garden Terrace 02"]');
  expect(cart).not.toBeNull();
  cart.click();
  expect(state.table.routeToCart).toHaveBeenCalledWith(state.table.tables[1]);
});
it('retains free/occupied/attention/active labels and native free-table and billing actions', () => {
  mount(Table);
  for (const label of ['Free', 'Occupied', 'Attention', 'Active', '0:27']) expect(host.textContent).toContain(label);
  buttonNamed('Open Table').click();
  expect(state.table.addToSelectedTables).toHaveBeenCalledWith(state.table.tables[0]);
  buttonNamed('Bill').click();
  expect(state.invoiceData.billing).toHaveBeenCalledWith(state.table.tables[1]);
});
it('prevents restricted table controls from invoking native navigation', async () => {
  state.auth.restrictTableOrder = true;
  mount(Table);
  buttonNamed('Open Table').click();
  for (const button of host.querySelectorAll('button[aria-label^="Open menu"], button[aria-label^="View order"]')) button.click();
  await nextTick();
  expect(state.table.addToSelectedTables).not.toHaveBeenCalled();
  expect(state.table.routeToMenu).not.toHaveBeenCalled();
  expect(state.table.routeToCart).not.toHaveBeenCalled();
});
it('wraps full dish names instead of silently clipping them beside imagery', () => {
  mount(Menu);
  const name = [...host.querySelectorAll('h2')].find(node => node.textContent.includes('Grilled chicken'));
  expect(name.textContent).toContain(state.menu.items[0].item_name);
  expect(getComputedStyle(name).whiteSpace).not.toBe('nowrap');
  expect(getComputedStyle(name).overflow).not.toBe('hidden');
});
it('gives item imagery its dish name and keeps initials fallback local', () => {
  mount(Menu);
  expect(host.querySelector('img').alt).toBe(state.menu.items[0].item_name);
  expect([...host.querySelectorAll('img')].every(image => !image.src.includes('dummyimage.com'))).toBe(true);
  expect(host.textContent).toContain('Cr');
  expect(host.textContent).toContain('UGX 125,000');
});
it('keeps every add and quantity action touchable with visible keyboard focus', () => {
  mount(Menu);
  const controls = [buttonNamed('ADD +'), ...[...host.querySelectorAll('button')].filter(button => ['-', '+'].includes(button.textContent.trim()))];
  for (const button of controls) {
    expect(touchHeight(button)).toBeGreaterThanOrEqual(44);
    // Native utility generation must contain a :focus-visible ring for each control.
    const focusedRules = [...document.styleSheets].flatMap(sheet => [...sheet.cssRules])
      .filter(rule => rule.selectorText?.includes(':focus-visible') && rule.style.getPropertyValue('box-shadow'))
      .some(rule => button.className.split(/\s+/).some(token => rule.selectorText.startsWith(`.${token.replaceAll(':', '\\:')}:`)));
    expect(focusedRules).toBe(true);
  }
});
it('keeps add/increment/decrement and details routed to the existing menu actions', () => {
  mount(Menu);
  buttonNamed('ADD +').click();
  expect(state.menu.addToCart).toHaveBeenCalledWith(state.menu.items[0]);
  expect(state.menu.items[0].showInput).toBe(true);
  [...host.querySelectorAll('button')].find(button => button.textContent.trim() === '+').click();
  [...host.querySelectorAll('button')].find(button => button.textContent.trim() === '-').click();
  host.querySelector('input[name="qty_input"]').click();
  expect(state.menu.incrementItemQuantity).toHaveBeenCalledWith(state.menu.items[1]);
  expect(state.menu.decrementItemQuantity).toHaveBeenCalledWith(state.menu.items[1]);
  expect(state.menu.showModal).toHaveBeenCalledWith(state.menu.items[1]);
});
it('retains the native printed-order decrement guard', () => {
  state.recentOrders.editPrintedInvoice = 1;
  state.auth.removeTableOrderItem = 0;
  mount(Menu);
  [...host.querySelectorAll('button')].find(button => button.textContent.trim() === '-').click();
  expect(state.menu.decrementItemQuantity).not.toHaveBeenCalled();
});
