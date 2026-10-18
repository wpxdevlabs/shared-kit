const { test } = require('node:test');
const assert = require('node:assert/strict');
const generate = require('./dependabot-changeset.cjs');
const { releasesFor } = generate;
const manifest = (name, before = {}, after = {}) => ({ before: { name, ...before }, after: { name, ...after } });

test('releases only packages with dependency updates, including grouped and build updates', () => {
  assert.deepEqual(releasesFor([
    manifest('components', { dependencies: { ui: '1' } }, { dependencies: { ui: '2' } }),
    manifest('hooks', { devDependencies: { typescript: '1' } }, { devDependencies: { typescript: '2' } }),
    manifest('utils'),
  ], true), ['components', 'hooks']);
});

test('tooling-only changes have an empty changeset', () => {
  assert.deepEqual(releasesFor([manifest('utils')], false), []);
});

test('transitive-only updates release public packages conservatively', () => {
  assert.deepEqual(releasesFor([manifest('utils'), manifest('internal', {}, { private: true })], true), ['utils']);
});

test('creates a changeset and is idempotent on reruns', async () => {
  let saved;
  let writes = 0;
  const pr = {
    number: 42, state: 'open', title: 'Bump tooling', user: { login: 'dependabot[bot]' },
    base: { sha: 'base', repo: { full_name: 'owner/repo' } },
    head: { sha: 'head', ref: 'dependabot/npm/tooling', repo: { full_name: 'owner/repo' } },
  };
  const github = {
    paginate: async () => [{ filename: 'package.json' }, { filename: 'pnpm-lock.yaml' }],
    rest: {
      pulls: { get: async () => ({ data: pr }), listFiles() {} },
      git: { getTree: async () => ({ data: { tree: [{ path: 'packages/utils/package.json' }] } }) },
      repos: {
        getContent: async ({ path }) => {
          if (path.startsWith('.changeset/')) {
            if (!saved) throw Object.assign(new Error('missing'), { status: 404 });
            return { data: { content: saved, sha: 'file-sha' } };
          }
          return { data: { content: Buffer.from(JSON.stringify({ name: 'utils' })).toString('base64') } };
        },
        createOrUpdateFileContents: async ({ content, branch }) => {
          assert.equal(branch, pr.head.ref);
          saved = content;
          writes++;
        },
      },
    },
  };
  const context = { repo: { owner: 'owner', repo: 'repo' }, issue: { number: 42 } };
  await generate({ github, context });
  assert.equal(Buffer.from(saved, 'base64').toString(), '---\n---\n\nBump tooling\n');
  await generate({ github, context });
  assert.equal(writes, 1);
  pr.user.login = 'someone';
  await assert.rejects(generate({ github, context }), /Dependabot/);
});
