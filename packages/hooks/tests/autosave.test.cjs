const test = require('node:test');
const assert = require('node:assert/strict');
let SaveQueue;
test.before(async () => { ({ SaveQueue } = await import('../dist/autosave.js')); });
const tick = async () => {
	for (let i = 0; i < 8; i++)
		await new Promise((resolve) => setImmediate(resolve));
};
const baseline = (key) => ({ key, data: { value: 0 }, version: 'v0' });
function harness(options = {}) {
	let now = 0,
		counter = 0;
	const calls = [],
		rows = new Map();
	const storage = {
		load: async () => options.restored || [],
		put: async (e) => {
			if (options.storageFails) throw Error('quota');
			rows.set(e.key, structuredClone(e));
		},
		ack: async (k, id) => {
			if (rows.get(k)?.draftId === id) rows.delete(k);
		},
		clear: async (k) => rows.delete(k),
	};
	const q = new SaveQueue({
		storage,
		validate: options.validate,
		read: async (key) => baseline(key),
		write: async (key, op) => {
			calls.push({ key, ...structuredClone(op) });
			if (options.write) return options.write(key, op, calls);
			return { key, data: op.data, version: `v${calls.length}` };
		},
		now: () => now,
		id: () => `operation-${String(++counter).padStart(20, '0')}`,
		random: () => 0.5,
	});
	return {
		q,
		calls,
		rows,
		setTime: (v) => {
			now = v;
		},
		async start(key = 'global') {
			await q.initialize();
			await q.ensure(key);
		},
		async pump() {
			await q.pump();
			await tick();
		},
	};
}
test('rapid edits coalesce and no-op changes do not save', async () => {
	const h = harness();
	try {
		await h.start();
		h.q.edit('global', { value: 1 });
		h.setTime(100);
		h.q.edit('global', { value: 2 });
		h.q.edit('global', { value: 2 });
		h.setTime(899);
		await h.pump();
		assert.equal(h.calls.length, 0);
		h.setTime(900);
		await h.pump();
		assert.equal(h.calls.length, 1);
		assert.equal(h.calls[0].data.value, 2);
		assert.equal(h.q.get('global').status, 'saved');
		assert.equal(h.rows.size, 0);
	} finally {
		h.q.dispose();
	}
});
test('continuous editing flushes within three seconds', async () => {
	const h = harness();
	try {
		await h.start();
		for (let i = 1; i <= 8; i++) {
			h.setTime((i - 1) * 400);
			h.q.edit('global', { value: i });
		}
		h.setTime(3000);
		await h.pump();
		assert.equal(h.calls.length, 1);
		assert.equal(h.calls[0].data.value, 8);
	} finally {
		h.q.dispose();
	}
});
test('an older response cannot mark a newer edit saved', async () => {
	let resolve;
	const h = harness({
		write: (key, op) =>
			new Promise((r) => {
				resolve = () => r({ key, data: op.data, version: 'v1' });
			}),
	});
	try {
		await h.start();
		h.q.edit('global', { value: 1 }, true);
		await h.pump();
		h.q.edit('global', { value: 2 });
		resolve();
		await tick();
		assert.equal(h.q.get('global').data.value, 2);
		assert.equal(h.q.get('global').status, 'pending');
		assert.equal(h.q.get('global').baseline.version, 'v1');
		assert.equal(h.rows.get('global').data.value, 2);
	} finally {
		h.q.dispose();
	}
});
test('ambiguous failures retain the exact operation while newer edits wait', async () => {
	let fail = true;
	const h = harness({
		write: async (key, op) => {
			if (fail) throw Object.assign(Error('offline'), { status: 0 });
			return { key, data: op.data, version: 'v1' };
		},
	});
	try {
		await h.start();
		h.q.edit('global', { value: 1 }, true);
		await h.pump();
		h.q.edit('global', { value: 2 });
		fail = false;
		h.setTime(1000);
		await h.pump();
		assert.equal(h.calls[0].operationId, h.calls[1].operationId);
		assert.deepEqual(h.calls[0].data, h.calls[1].data);
		assert.equal(h.q.get('global').data.value, 2);
		assert.equal(h.q.get('global').status, 'pending');
		h.setTime(2000);
		await h.pump();
		assert.equal(h.calls[2].baseVersion, 'v1');
		assert.notEqual(h.calls[2].operationId, h.calls[1].operationId);
	} finally {
		h.q.dispose();
	}
});
test('queue limits concurrency to two and serializes each resource', async () => {
	const resolvers = [];
	const h = harness({
		write: (key, op) =>
			new Promise((r) =>
				resolvers.push(() => r({ key, data: op.data, version: 'v1' }))
			),
	});
	try {
		await h.start();
		for (const key of ['global', 'crawler:a', 'crawler:b', 'crawler:c']) {
			await h.q.ensure(key);
			h.q.edit(key, { value: 1 }, true);
		}
		await h.pump();
		assert.equal(h.calls.length, 2);
		h.q.edit('global', { value: 2 }, true);
		await h.pump();
		assert.equal(h.calls.length, 2);
		resolvers.shift()();
		await tick();
		await h.pump();
		assert.equal(h.calls.length, 3);
		assert.equal(h.calls.filter((c) => c.key === 'global').length, 1);
		while (resolvers.length) resolvers.shift()();
		await tick();
	} finally {
		h.q.dispose();
	}
});
test('Retry-After is honored and retry storms pause after five failures', async () => {
	const h = harness({
		write: async () => {
			throw Object.assign(Error('busy'), { status: 429, retryAfter: 20000 });
		},
	});
	try {
		await h.start();
		h.q.edit('global', { value: 1 }, true);
		await h.pump();
		assert.equal(h.q.get('global').due, 20000);
		h.setTime(19999);
		await h.pump();
		assert.equal(h.calls.length, 1);
		for (let i = 1; i < 5; i++) {
			h.setTime(i * 40000);
			await h.pump();
		}
		assert.equal(h.q.get('global').status, 'failed');
		h.setTime(1000000);
		await h.pump();
		assert.equal(h.calls.length, 5);
		h.q.retry();
		await h.pump();
		assert.equal(h.calls.length, 6);
	} finally {
		h.q.dispose();
	}
});
test('authentication failures pause and preserve the draft', async () => {
	const h = harness({
		write: async () => {
			throw Object.assign(Error('sign in'), { status: 403 });
		},
	});
	try {
		await h.start();
		h.q.edit('global', { value: 1 }, true);
		await h.pump();
		assert.equal(h.q.get('global').status, 'auth');
		h.setTime(99999);
		await h.pump();
		assert.equal(h.calls.length, 1);
		assert.ok(h.rows.has('global'));
	} finally {
		h.q.dispose();
	}
});
test('conflicts require explicit resolution before writing again', async () => {
	let fail = true;
	const h = harness({
		write: async (key, op) => {
			if (fail)
				throw Object.assign(Error('conflict'), {
					status: 409,
					current: { key, data: { value: 9 }, version: 'v9' },
				});
			return { key, data: op.data, version: 'v1' };
		},
	});
	try {
		await h.start();
		h.q.edit('global', { value: 1 }, true);
		await h.pump();
		assert.equal(h.q.get('global').status, 'conflict');
		h.q.retry();
		h.setTime(9999);
		await h.pump();
		assert.equal(h.calls.length, 1);
		fail = false;
		await h.q.resolve('global', false);
		assert.equal(h.q.get('global').status, 'saved');
		assert.equal(h.q.get('global').data.value, 0);
	} finally {
		h.q.dispose();
	}
});
test('persisted ambiguous writes survive a refresh with the original ID', async () => {
	const entry = {
		key: 'global',
		data: { value: 2 },
		baseline: baseline('global'),
		draftId: 'draft-2',
		operation: {
			operationId: 'operation-original-123',
			baseVersion: 'v0',
			data: { value: 1 },
			draftId: 'draft-1',
		},
		pending: true,
		localOnly: false,
		status: 'saving',
		attempts: 1,
		due: 0,
		editedAt: 1,
	};
	const h = harness({ restored: [entry] });
	try {
		await h.start();
		h.setTime(800);
		await h.pump();
		assert.equal(h.calls[0].operationId, entry.operation.operationId);
		assert.equal(h.calls[0].data.value, 1);
		assert.equal(h.q.get('global').data.value, 2);
	} finally {
		h.q.dispose();
	}
});
test('local license drafts never hit the save endpoint', async () => {
	const h = harness();
	try {
		await h.start();
		h.q.setLocalDraft('license-draft:1', {
			postId: '1',
			contact: 'editor@example.com',
		});
		h.setTime(99999);
		await h.pump();
		assert.equal(h.calls.length, 0);
		await tick();
		assert.equal(h.rows.get('license-draft:1').data.postId, '1');
		const id = h.q.get('license-draft:1').draftId;
		h.q.setLocalDraft('license-draft:1', {
			postId: '1',
			contact: 'new@example.com',
		});
		await h.q.clearDraft('license-draft:1', id);
		assert.ok(h.q.get('license-draft:1'));
	} finally {
		h.q.dispose();
	}
});
test('storage failure is visible and does not falsely claim durable drafts', async () => {
	const h = harness({ storageFails: true });
	try {
		await h.start();
		h.q.edit('global', { value: 1 }, true);
		await h.pump();
		assert.match(h.q.getSnapshot().storageError, /locally/);
		assert.equal(h.q.get('global').status, 'saved');
	} finally {
		h.q.dispose();
	}
});
test('conflicting restored drafts are blocked instead of silently overwritten', async () => {
	const base = {
		key: 'global',
		baseline: baseline('global'),
		pending: true,
		localOnly: false,
		status: 'pending',
		attempts: 0,
		due: 0,
	};
	const h = harness({
		restored: [
			{ ...base, draftId: 'a', data: { value: 1 }, editedAt: 1 },
			{ ...base, draftId: 'b', data: { value: 2 }, editedAt: 2 },
		],
	});
	try {
		await h.start();
		h.setTime(9999);
		await h.pump();
		assert.equal(h.q.get('global').status, 'conflict');
		assert.equal(h.calls.length, 0);
	} finally {
		h.q.dispose();
	}
});

test('reverting an unsent edit removes the previous persisted draft', async () => {
	const h = harness();
	try {
		await h.start();
		h.q.edit('global', { value: 1 });
		await tick();
		assert.equal(h.rows.size, 1);
		h.q.edit('global', { value: 0 });
		await tick();
		assert.equal(h.rows.size, 0);
		h.setTime(9999);
		await h.pump();
		assert.equal(h.calls.length, 0);
	} finally {
		h.q.dispose();
	}
});

test('a conflict already matching the latest draft confirms saved values', async () => {
	const h = harness({ write: async (key, op) => {
		throw { status: 409, current: { key, data: op.data, version: 'v-other-tab' } };
	} });
	try {
		await h.start();
		h.q.edit('global', { value: 1 });
		h.setTime(800);
		await h.pump();
		assert.equal(h.q.get('global').status, 'saved');
		assert.equal(h.q.get('global').baseline.version, 'v-other-tab');
		assert.equal(h.rows.size, 0);
	} finally { h.q.dispose(); }
});

test('nullable crawler choices round-trip as inherited permissions', async () => {
 const h = harness();
 try {
  await h.start('crawler:fixture');
  const data = {allow_training: null, allow_answer: 1, allow_index: null};
  h.q.edit('crawler:fixture', data);
  h.setTime(800); await h.pump();
  assert.deepEqual(h.calls[0].data, data);
  assert.equal(h.q.get('crawler:fixture').status, 'saved');
 } finally {h.q.dispose();}
});

test('application validation blocks writes until a corrected edit', async () => {
 const h = harness({validate: (key, data) => key === 'custom' && data.value < 0 ? 'Value must be positive.' : undefined});
 try {
  await h.start('custom');
  h.q.edit('custom', {value: -1}, true);
  await h.pump();
  assert.equal(h.calls.length, 0);
  assert.equal(h.q.getSnapshot().entries[0].status, 'validation');
  h.q.edit('custom', {value: 1}, true);
  await h.pump();
  assert.equal(h.calls.length, 1);
  assert.equal(h.q.getSnapshot().entries[0].status, 'saved');
 } finally { h.q.dispose(); }
});
