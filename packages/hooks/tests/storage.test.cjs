const test = require('node:test');
const assert = require('node:assert/strict');
test('draft storage accepts an application database name and supplies a shared default', async () => {
 const { IndexedDraftStorage } = await import('../dist/autosave.js');
 const original = global.indexedDB;
 const calls = [];
 global.indexedDB = {open: (...args) => { calls.push(args); return {}; }};
 try {
  new IndexedDraftStorage('site:user', 'tab');
  new IndexedDraftStorage('site:user', 'tab', 'existing-plugin-drafts');
  assert.deepEqual(calls, [['wpxdev-autosave', 1], ['existing-plugin-drafts', 1]]);
 } finally {
  if (original === undefined) delete global.indexedDB;
  else global.indexedDB = original;
 }
});
