import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the app with controlled API timing, including an arrival during Ack.
class Element {
  children = []; dataset = {}; hidden = false; textContent = ''; events = {};
  append(child) { this.insertBefore(child, null); }
  insertBefore(child, before) {
    child.remove();
    this.children.splice(before ? this.children.indexOf(before) : this.children.length, 0, child);
    child.parent = this;
  }
  remove() {
    if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(name, handler) { this.events[name] = handler; }
}
function surface() {
  const list = new Element(), loader = new Element(), empty = new Element(), status = new Element(), newBar = new Element();
  const board = new Element(); board.append(loader); list.hidden = true; empty.hidden = true; newBar.hidden = true;
  const selectors = { '[data-testid="incident-list"]': list, '[data-testid="loader"]': loader,
    '[data-testid="empty"]': empty, '.status': status, '[data-testid="new-bar"]': newBar };
  return { list, loader, empty, status, newBar, board, selectors };
}
const { list, loader, empty, status, newBar, board, selectors } = surface();
let finishFetch, finishAck, timer, fetches = 0, failFetch = false, failAck = false;
const ackedIds = [];
const context = vm.createContext({
  document: { querySelector: s => selectors[s], createElement: () => new Element() },
  navigator: { language: 'en-GB' },
  setInterval: (callback, ms) => { assert.equal(ms, 2000); timer = callback; },
});
const api = new vm.SyntheticModule(['fetchIncidents', 'ack'], function () {
  this.setExport('fetchIncidents', () => {
    fetches++;
    if (failFetch) return Promise.reject(new Error('offline'));
    return new Promise(resolve => { finishFetch = resolve; });
  });
  this.setExport('ack', id => {
    ackedIds.push(id);
    if (failAck) return Promise.reject(new Error('offline'));
    return new Promise(resolve => { finishAck = resolve; });
  });
}, { context });
const app = new vm.SourceTextModule(await readFile('app/app.js', 'utf8'), { context });
await app.link(() => api); await app.evaluate();
assert.equal(loader.parent, board); assert.equal(list.hidden, true);
await timer(); assert.equal(fetches, 1, 'skip overlapping polls');
const incident = (id, openedAt) => ({ id, openedAt, service: 'booking', region: 'EU',
  summary: '<img src=x onerror=alert(1)>', severity: 'sev1' });
const older = incident('OLD', '2026-11-11T03:11:00Z');
const newer = incident('NEW', '2026-11-12T03:11:00Z');
finishFetch({ incidents: [older, newer] }); await new Promise(setImmediate);
assert.equal(loader.parent, null); assert.equal(list.hidden, false);
assert.deepEqual(list.children.map(r => r.dataset.id), ['NEW', 'OLD']);
const oldRow = list.children[1], button = oldRow.children[4];
assert.equal(oldRow.children[2].textContent, 'booking · EU · <img src=x onerror=alert(1)>');
assert.equal(oldRow.children[3].dateTime, older.openedAt);
const click = button.events.click(); assert.equal(button.disabled, true);
const latest = incident('LATEST', '2026-11-12T04:00:00Z');
const refresh = timer(); finishFetch({ incidents: [latest, newer, older] });
await refresh;
assert.deepEqual(list.children.map(r => r.dataset.id), ['NEW', 'OLD'], 'polling must not move visible targets');
assert.equal(list.children[1], oldRow); assert.equal(newBar.hidden, false); assert.equal(newBar.textContent, '1 new');
finishAck({}); await click;
assert.deepEqual(ackedIds, ['OLD']); assert.equal(oldRow.children[4].dataset.testid, 'acked');
newBar.events.click(); assert.equal(newBar.hidden, true);
assert.deepEqual(list.children.map(r => r.dataset.id), ['LATEST', 'NEW', 'OLD']);
assert.equal(list.children[2], oldRow, 'applying pending arrivals preserves the acknowledged row');
const poll = timer(); finishFetch({ incidents: [latest, newer, older] }); await poll;
assert.equal(oldRow.children[4].dataset.testid, 'acked', 'Ack mark survives refresh');
assert.equal(newBar.hidden, true, 'applied arrivals are not counted twice');
failAck = true; await list.children[1].children[4].events.click();
assert.equal(list.children[1].children[4].disabled, false); assert.match(status.textContent, /Could not acknowledge NEW/);
failFetch = true; await timer(); assert.equal(list.children.length, 3); assert.match(status.textContent, /Could not refresh/);
failFetch = false; const recovery = timer(); finishFetch({ incidents: [] }); await recovery;
assert.equal(list.children.length, 3, 'background responses do not remove visible rows');
assert.equal(status.textContent, '');

// Run the actual app in both acceptance zones, including locale-specific clocks.
for (const [zone, locale, expected] of [
  ['Pacific/Auckland', 'en-NZ', '12/11/2026, 04:11:00 pm'],
  ['Europe/Berlin', 'de-DE', '12.11.2026, 04:11:00'],
  ['UTC', 'en-GB', null],
]) {
  process.env.TZ = zone;
  const localSurface = surface();
  const localContext = vm.createContext({
    document: { querySelector: s => localSurface.selectors[s], createElement: () => new Element() },
    navigator: { language: locale }, setInterval: () => {},
  });
  const localApi = new vm.SyntheticModule(['fetchIncidents', 'ack'], function () {
    this.setExport('fetchIncidents', async () => ({ incidents: expected ? [newer] : [] }));
    this.setExport('ack', async () => ({}));
  }, { context: localContext });
  const localApp = new vm.SourceTextModule(await readFile('app/app.js', 'utf8'), { context: localContext });
  await localApp.link(() => localApi); await localApp.evaluate(); await new Promise(setImmediate);
  if (expected) assert.equal(localSurface.list.children[0].children[3].textContent.toLowerCase(), expected);
  else {
    assert.equal(localSurface.loader.parent, null);
    assert.equal(localSurface.empty.hidden, false);
    assert.equal(localSurface.list.children.length, 0);
  }
}
console.log('PASS: loader/empty, stable polling, explicit new-bar application, Ack identity/state, error recovery, safe text, Auckland/Berlin local times.');
