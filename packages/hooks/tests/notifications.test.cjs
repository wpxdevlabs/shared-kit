const test = require('node:test');
const assert = require('node:assert/strict');
let confirmedSave, saveProblem;
test.before(async () => { ({ confirmedSave, saveProblem } = await import('../dist/autosave.js')); });
const snapshot = (entries, storageError = '') => ({entries, ready: true, storageError, connection: 'available'});
const entry = (status, version, extra = {}) => ({key: 'settings', status, pending: status !== 'saved', localOnly: false, baseline: {version}, ...extra});
test('save notification requires a confirmed new version, not page load or reverted edits', () => {
 assert.equal(confirmedSave(snapshot([]), snapshot([entry('saved', 'v1')])), false);
 assert.equal(confirmedSave(snapshot([entry('pending', 'v1')]), snapshot([entry('saved', 'v1')])), false);
 assert.equal(confirmedSave(snapshot([entry('saving', 'v1')]), snapshot([entry('saved', 'v2')])), true);
});
test('older save responses with newer pending edits do not announce success', () => {
 assert.equal(confirmedSave(snapshot([entry('saving', 'v1')]), snapshot([entry('pending', 'v2')])), false);
});
test('local license drafts never count as published saves', () => {
 assert.equal(confirmedSave(snapshot([entry('saving', 'v1', {localOnly: true})]), snapshot([entry('saved', 'v2', {localOnly: true})])), false);
});
test('storage failures and actionable queue problems have priority over background drafts', () => {
 assert.equal(saveProblem(snapshot([entry('offline', 'v1'), entry('conflict', 'v1', {key: 'global'})])), 'conflict');
 assert.equal(saveProblem(snapshot([entry('offline', 'v1')], 'quota exceeded')), 'storage');
 assert.equal(saveProblem(snapshot([entry('failed', 'v1', {localOnly: true})])), undefined);
 assert.equal(saveProblem(snapshot([entry('saved', 'v1')])), undefined);
});
