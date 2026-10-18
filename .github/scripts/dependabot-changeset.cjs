const dependencyFields = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

function releasesFor(manifests, lockfileChanged) {
  const changed = manifests.filter(({ before, after }) =>
    dependencyFields.some(field => JSON.stringify(before[field] || {}) !== JSON.stringify(after[field] || {}))
  );
  // A transitive-only update cannot be attributed safely without resolving the lockfile.
  const targets = changed.length ? changed : lockfileChanged ? manifests : [];
  return targets.filter(({ after }) => !after.private).map(({ after }) => after.name).sort();
}

module.exports = async ({ github, context }) => {
  const { owner, repo } = context.repo;
  const { data: pr } = await github.rest.pulls.get({ owner, repo, pull_number: context.issue.number });
  if (pr.state !== 'open' || pr.user.login !== 'dependabot[bot]' ||
      pr.head.repo.full_name !== pr.base.repo.full_name || !pr.head.ref.startsWith('dependabot/')) {
    throw new Error('Expected an open, same-repository Dependabot pull request');
  }
  const files = await github.paginate(github.rest.pulls.listFiles, {
    owner, repo, pull_number: pr.number, per_page: 100,
  });
  const path = `.changeset/dependabot-${pr.number}.md`;
  const read = async (file, ref) => {
    const { data } = await github.rest.repos.getContent({ owner, repo, path: file, ref });
    return { content: Buffer.from(data.content, 'base64').toString('utf8'), sha: data.sha };
  };
  const { data: tree } = await github.rest.git.getTree({ owner, repo, tree_sha: pr.base.sha, recursive: 'true' });
  if (tree.truncated) throw new Error('Repository tree was truncated');
  const manifests = [];
  for (const entry of tree.tree.filter(entry => /^packages\/[^/]+\/package.json$/.test(entry.path))) {
    const before = JSON.parse((await read(entry.path, pr.base.sha)).content);
    const after = JSON.parse((await read(entry.path, pr.head.sha)).content);
    manifests.push({ before, after });
  }
  // Root manifest updates are tooling changes; do not release every package for them.
  const rootChanged = files.some(file => file.filename === 'package.json');
  const releases = releasesFor(manifests, !rootChanged && files.some(file => file.filename === 'pnpm-lock.yaml'));
  const summary = pr.title.replace(/[\r\n]+/g, ' ').trim();
  const content = `---\n${releases.map(name => `${JSON.stringify(name)}: patch\n`).join('')}---\n\n${summary}\n`;
  let existing;
  try { existing = await read(path, pr.head.sha); } catch (error) { if (error.status !== 404) throw error; }
  if (existing?.content === content) return;
  // Do not overwrite a newer Dependabot update with stale release metadata.
  const { data: latest } = await github.rest.pulls.get({ owner, repo, pull_number: pr.number });
  if (latest.head.sha !== pr.head.sha) throw new Error('Pull request changed; a newer run will update its changeset');
  await github.rest.repos.createOrUpdateFileContents({
    owner, repo, path, branch: pr.head.ref,
    message: 'chore: add changeset for dependency updates',
    content: Buffer.from(content).toString('base64'),
    ...(existing ? { sha: existing.sha } : {}),
  });
};
module.exports.releasesFor = releasesFor;
