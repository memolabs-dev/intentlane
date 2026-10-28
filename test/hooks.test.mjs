import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('..', import.meta.url));

function run(root, command, args, extraEnv = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, CI: '', ...extraEnv },
  });
}

test('installer activates a real hook that rejects bad staged content', () => {
  const root = mkdtempSync(join(tmpdir(), 'memo-precommit-'));
  try {
    mkdirSync(join(root, '.githooks'));
    mkdirSync(join(root, 'scripts'));
    copyFileSync(join(sourceRoot, '.githooks/pre-commit'), join(root, '.githooks/pre-commit'));
    copyFileSync(join(sourceRoot, 'scripts/install-git-hooks.sh'), join(root, 'scripts/install-git-hooks.sh'));
    writeFileSync(join(root, 'package.json'), JSON.stringify({
      private: true,
      scripts: { 'check:staged': 'node -e "process.exit(0)"' },
    }));

    assert.equal(run(root, 'git', ['init', '-q']).status, 0);
    assert.equal(run(root, 'sh', ['scripts/install-git-hooks.sh']).status, 0);
    assert.equal(run(root, 'git', ['config', '--local', '--get', 'core.hooksPath']).stdout.trim(), '.githooks');

    writeFileSync(join(root, 'sample.txt'), 'bad whitespace  \n');
    assert.equal(run(root, 'git', ['add', 'sample.txt']).status, 0);
    const bad = run(root, 'sh', ['.githooks/pre-commit']);
    assert.notEqual(bad.status, 0, 'trailing whitespace must fail');

    writeFileSync(join(root, 'sample.txt'), 'clean content\n');
    assert.equal(run(root, 'git', ['add', 'sample.txt']).status, 0);
    const good = run(root, 'sh', ['.githooks/pre-commit']);
    assert.equal(good.status, 0, good.stderr + good.stdout);

    writeFileSync(join(root, '.env'), 'DUMMY=fake\n');
    assert.equal(run(root, 'git', ['add', '-f', '.env']).status, 0);
    const secret = run(root, 'sh', ['.githooks/pre-commit']);
    assert.notEqual(secret.status, 0, 'credential-like files must fail');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
