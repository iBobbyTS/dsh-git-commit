import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve, sep } from 'node:path';
import { git, visibleStatus } from '../lib/core/git.js';
import { pushBranch, mergeAndDeleteBranch } from '../lib/core/actions.js';
import { GitCommitService } from '../lib/core/service.js';
import { createHandler } from '../lib/index.js';

const base = fileURLToPath(new URL('../.agent-work/tmp/git-actions/', import.meta.url));
async function fixture(fn, target = 'trunk') {
  await mkdir(base, { recursive: true });
  const dir = await mkdtemp(join(base, 'fixture-'));
  const root = join(dir, 'repo'), remote = join(dir, 'remote.git');
  await mkdir(root);
  try {
    await git(root, ['init', '-b', target]);
    await git(root, ['config', 'core.hooksPath', join(root, '.git', 'hooks')]);
    await git(root, ['config', 'user.name', 'Test']);
    await git(root, ['config', 'user.email', 'test@example.com']);
    await git(root, ['config', 'commit.gpgsign', 'false']);
    await git(root, ['config', 'merge.gpgsign', 'false']);
    await writeFile(join(root, 'a.txt'), 'base\n');
    await git(root, ['add', '.']); await git(root, ['commit', '-m', 'initial']);
    await git(dir, ['init', '--bare', '-b', target, remote]);
    await git(root, ['remote', 'add', 'origin', remote]);
    await git(root, ['push', '-u', 'origin', target]);
    await git(root, ['remote', 'set-head', 'origin', '-a']);
    await git(root, ['switch', '-c', 'feature/actions']);
    await writeFile(join(root, 'feature.txt'), 'feature\n');
    await git(root, ['add', '.']); await git(root, ['commit', '-m', 'feature']);
    return await fn(root, remote);
  } finally {
    assert.ok(resolve(dir).startsWith(resolve(base) + sep), 'only remove this test fixture');
    await rm(dir, { recursive: true, force: true });
  }
}
for (const target of ['main', 'master', 'custom/default']) {
  test(`merge and delete switches to local ${target} from origin HEAD`, () => fixture(async root => {
    const status = await visibleStatus(root);
    assert.equal(status.defaultBranch, target); assert.equal(status.canMergeAndDelete, true);
    const result = await mergeAndDeleteBranch(root);
    assert.equal(result.success, true, result.error);
    assert.equal(result.merged, true); assert.equal(result.deleted, true);
    assert.equal((await git(root, ['branch', '--show-current'])).trim(), target);
    assert.equal(await git(root, ['show', 'HEAD:feature.txt']), 'feature\n');
    await assert.rejects(git(root, ['show-ref', '--verify', 'refs/heads/feature/actions']));
    assert.equal((await visibleStatus(root)).canMergeAndDelete, false);
    assert.equal((await mergeAndDeleteBranch(root)).success, false);
  }, target));
}
test('dirty working tree, staged changes and untracked files refuse switch/delete', () => fixture(async root => {
  for (const mode of ['untracked', 'unstaged', 'staged']) {
    const path = mode === 'untracked' ? 'new.txt' : 'a.txt';
    await writeFile(join(root, path), 'changed\n');
    if (mode === 'staged') await git(root, ['add', path]);
    const result = await mergeAndDeleteBranch(root);
    assert.equal(result.success, false); assert.equal(result.stage, 'preflight');
    assert.match(result.error, /Commit or stash/);
    assert.equal((await git(root, ['branch', '--show-current'])).trim(), 'feature/actions');
    if (mode === 'untracked') await rm(join(root, path)); // exact test-created path
    else await git(root, ['restore', '--staged', '--worktree', '--', path]);
  }
}));
test('missing origin HEAD or local default refuses mutation', () => fixture(async root => {
  await git(root, ['symbolic-ref', '--delete', 'refs/remotes/origin/HEAD']);
  assert.equal((await visibleStatus(root)).defaultBranch, null);
  assert.equal((await mergeAndDeleteBranch(root)).stage, 'preflight');
  await git(root, ['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/trunk']);
  await git(root, ['branch', '-d', 'trunk']);
  assert.equal((await mergeAndDeleteBranch(root)).success, false);
  assert.equal((await git(root, ['branch', '--show-current'])).trim(), 'feature/actions');
}));
test('detached HEAD and main are never deleted', () => fixture(async root => {
  await git(root, ['switch', '-c', 'main']);
  assert.equal((await visibleStatus(root)).canMergeAndDelete, false);
  assert.equal((await mergeAndDeleteBranch(root)).success, false);
  await git(root, ['switch', '--detach']);
  assert.equal((await visibleStatus(root)).canMergeAndDelete, false);
  assert.equal((await mergeAndDeleteBranch(root)).success, false);
  assert.equal((await pushBranch(root)).success, false);
}));
test('merge conflicts retain source and report merge stage without deleting', () => fixture(async root => {
  await writeFile(join(root, 'a.txt'), 'feature side\n');
  await git(root, ['add', '.']); await git(root, ['commit', '-m', 'feature conflict']);
  await git(root, ['switch', 'trunk']);
  await writeFile(join(root, 'a.txt'), 'target side\n');
  await git(root, ['add', '.']); await git(root, ['commit', '-m', 'target conflict']);
  await git(root, ['switch', 'feature/actions']);
  const result = await mergeAndDeleteBranch(root);
  assert.equal(result.success, false); assert.equal(result.stage, 'merge');
  assert.equal(result.merged, false); assert.equal(result.deleted, false);
  assert.match(result.error, /Source branch retained/);
  await git(root, ['show-ref', '--verify', 'refs/heads/feature/actions']);
  assert.equal((await git(root, ['branch', '--show-current'])).trim(), 'trunk');
  assert.match(await git(root, ['status', '--porcelain']), /UU a.txt/);
}));
test('completed merge and failed safe deletion are reported separately', () => fixture(async root => {
  // -d respects an upstream which has not received the feature yet, even though
  // the current local target contains the merge. We must not escalate to -D.
  await git(root, ['branch', '--set-upstream-to=origin/trunk', 'feature/actions']);
  const result = await mergeAndDeleteBranch(root);
  assert.equal(result.success, false); assert.equal(result.stage, 'delete');
  assert.equal(result.merged, true); assert.equal(result.deleted, false);
  assert.match(result.error, /Merged feature\/actions into trunk.*retained/);
  await git(root, ['show-ref', '--verify', 'refs/heads/feature/actions']);
  assert.equal(await git(root, ['show', 'HEAD:feature.txt']), 'feature\n');
}));
test('unfinished Git operations prevent switch and push', () => fixture(async root => {
  const path = (await git(root, ['rev-parse', '--git-path', 'MERGE_HEAD'])).trim();
  await writeFile(resolve(root, path), (await git(root, ['rev-parse', 'HEAD'])).trim()+'\n');
  for (const operation of [mergeAndDeleteBranch, pushBranch]) {
    const result = await operation(root);
    assert.equal(result.success, false); assert.match(result.error, /ongoing Git operation/);
  }
  assert.equal((await git(root, ['branch', '--show-current'])).trim(), 'feature/actions');
}));
test('push establishes upstream and rejects remote refusal without force', () => fixture(async (root, remote) => {
  const result = await pushBranch(root);
  assert.equal(result.success, true, result.error);
  assert.equal(result.upToDate, false, 'creating a remote branch is an actual push');
  const repeated = await pushBranch(root);
  assert.equal(repeated.success, true, repeated.error);
  assert.equal(repeated.upToDate, true, 'an unchanged second push reports already up to date');
  assert.equal((await git(root, ['rev-parse', '--abbrev-ref', '@{upstream}'])).trim(), 'origin/feature/actions');
  assert.equal((await git(remote, ['rev-parse', 'refs/heads/feature/actions'])).trim(), (await git(root, ['rev-parse', 'HEAD'])).trim());
  await git(remote, ['config', 'receive.denyNonFastForwards', 'true']);
  await git(root, ['reset', '--hard', 'HEAD~1']); // isolated fixture only
  const rejected = await pushBranch(root);
  assert.equal(rejected.success, false); assert.match(rejected.error, /rejected|non-fast-forward|behind/i);
}));
test('new actions use existing authenticated RPC and shared per-repository exclusion', () => fixture(async root => {
  const service = new GitCommitService({ get: () => undefined }, { notifier: null });
  try {
    let release;
    const held = service.followUp('push', { cwd: root }, () => new Promise(resolve => { release = resolve; }));
    // Let repository resolution and the test operation start before racing other methods.
    while (!release) await new Promise(resolve => setImmediate(resolve));
    assert.match((await service.commit({ cwd: root, message: 'test' })).error, /in progress/);
    assert.match((await service.mergeAndDelete({ cwd: root })).error, /in progress/);
    release({ success: true }); await held;
    const handler = createHandler(service);
    for (const method of ['push', 'mergeAndDelete']) {
      const response = await handler(new Request('http://localhost/api/git-commit', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'client-request', rpcId: 'actions-test', method: 'git-commit', payload: { method, payload: { cwd: root } } }),
      }));
      const data = await response.json();
      assert.equal(data.result.ok, true); assert.equal(data.result.value.success, true, data.result.value.error);
    }
  } finally { service.close(); }
}));
