import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createApp, nextTick, reactive } from 'vue';
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
function buttonNamed(text) { return [...host.querySelectorAll('button')].find(button => button.textContent.includes(text)); }

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
it('shows full dish names, named imagery, and a local initials fallback', () => {
  mount(Menu);
  expect([...host.querySelectorAll('h2')].map(node => node.textContent.trim()))
    .toContain(state.menu.items[0].item_name);
  const images = [...host.querySelectorAll('img')];
  expect(images).toHaveLength(1);
  expect(images[0].alt).toBe(state.menu.items[0].item_name);
  expect(images[0].getAttribute('src')).toBe('/safe-synthetic.svg');
  expect(host.textContent).toContain('Cr');
  expect(host.textContent).toContain('UGX 125,000');
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
