const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');
const { test } = require('node:test');

// Resolve the actual transitive dependency used by shadcn, including pnpm's patch.
const fromComponents = createRequire(path.resolve('packages/components/package.json'));
const fromShadcn = createRequire(fromComponents.resolve('shadcn'));
const fromGlob = createRequire(fromShadcn.resolve('fast-glob'));
const fromMicromatch = createRequire(fromGlob.resolve('micromatch'));
const braces = fromMicromatch('braces');
const rejected = { name: 'SyntaxError', message: /maximum nesting depth/ };

for (const [name, pattern] of [
  ['braces', '{'.repeat(4900) + 'a,b' + '}'.repeat(4900)],
  ['parentheses', '('.repeat(4900) + 'a' + ')'.repeat(4900)],
  ['mixed nesting', '{('.repeat(2450) + 'a' + ')}'.repeat(2450)],
  ['unclosed braces', '{'.repeat(4900)],
]) {
  test(`rejects excessive ${name}`, () => {
    for (const method of ['parse', 'compile', 'expand', 'stringify']) {
      assert.throws(() => braces[method](pattern), rejected);
    }
  });
}

test('direct AST walkers enforce the same bound', () => {
  for (const method of ['compile', 'expand', 'stringify']) {
    let ast = { type: 'text', value: 'a' };
    for (let i = 0; i < 10000; i++) {
      const parent = { type: 'root', nodes: [ast] };
      ast.parent = parent;
      ast = parent;
    }
    assert.throws(() => braces[method](ast), rejected);
  }
});

test('ordinary alternation, ranges, escaping and nesting still work', () => {
  assert.deepEqual(braces.expand('src/{a,{b,c}}.ts'), ['src/a.ts', 'src/b.ts', 'src/c.ts']);
  assert.deepEqual(braces.expand('{1..3}'), ['1', '2', '3']);
  assert.equal(braces.compile('src/{a,b}.ts'), 'src/(a|b).ts');
  assert.deepEqual(braces.expand('\\{a,b\\}'), ['{a,b}']);
  assert.equal(braces.stringify(braces.parse('a/{b,c}/d')), 'a/{b,c}/d');
  assert.doesNotThrow(() => braces.compile('{'.repeat(128) + 'a,b' + '}'.repeat(128)));
});
