import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CommitNotifier, NOTICE_MAX_AGE_MS, PendingNoticeStore, noticeContent, noticePath } from '../lib/core/notice.js';
import { GitCommitService } from '../lib/core/service.js';
import { git } from '../lib/core/git.js';

async function tempDir() {
  return await mkdtemp(join(tmpdir(), 'dgc-notice-'));
}

async function repoFixture(fn) {
  const root = await mkdtemp(join(tmpdir(), 'dgc-notice-repo-'));
  try {
    await git(root, ['init', '-b', 'main']);
    await git(root, ['config', 'user.name', 'Test']);
    await git(root, ['config', 'user.email', 'test@example.com']);
    await writeFile(join(root, 'a.txt'), 'one\n');
    await git(root, ['add', '-A']);
    await git(root, ['commit', '-m', 'initial']);
    return await fn(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}

/** Stand-in for a live Agent: the notifier only touches session, inbox.remove, and inject. */
function fakeAgent(sessionId, cwd) {
  const agent = {
    session: { id: sessionId, header: { cwd } },
    injected: [],
    removed: [],
    inbox: { nextStep: [], remove(id) { agent.removed.push(id); return true; } },
    inject(message) { agent.injected.push(message); },
  };
  return agent;
}

function fakeCtx(agents = new Map()) {
  return {
    get: name => name === 'agents' ? { get: id => agents.get(id) } : undefined,
    logger: { warn() {} },
  };
}

const entry = (overrides = {}) => ({
  messageId: 'message-1',
  hash: 'abc1234',
  text: 'Git commit abc1234 was created in this repository: "feat: x"',
  summary: 'Committed abc1234 · feat: x',
  cwd: null,
  at: Date.now(),
  ...overrides,
});

test('notice content carries the hash and only the commit subject', () => {
  const content = noticeContent({ hash: 'abc1234', message: 'feat: add two\n\nA body the model does not need.' });
  assert.match(content.text, /Git commit abc1234 was created in this repository: "feat: add two"/);
  assert.match(content.text, /Do not commit the same changes again/);
  assert.doesNotMatch(content.text, /A body the model/);
  assert.equal(content.summary, 'Committed abc1234 · feat: add two');

  const long = noticeContent({ hash: 'abc1234', message: 'x'.repeat(400) });
  assert.ok(long.summary.length <= 120, long.summary);
  assert.ok(long.summary.endsWith('…'));
  assert.ok(long.text.length > long.summary.length, 'the model text keeps more detail than the collapsed row');

  assert.equal(noticeContent({ hash: 'abc1234', message: '' }).summary, 'Committed abc1234 · (no subject)');
});

test('pending notices round-trip through the atomic file and survive reload', async () => {
  const dir = await tempDir();
  try {
    const path = join(dir, 'notices.json');
    const store = new PendingNoticeStore(path);
    const value = entry();
    await store.put('session-1', value);

    assert.equal(store.peek('session-1').messageId, 'message-1');
    const onDisk = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(onDisk.version, 1);
    assert.equal(onDisk.sessions['session-1'].hash, 'abc1234');

    const reloaded = new PendingNoticeStore(path);
    await reloaded.ready();
    assert.deepEqual(reloaded.peek('session-1'), value);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('a corrupt notice file degrades to an empty store instead of failing the commit', async () => {
  const dir = await tempDir();
  try {
    const path = join(dir, 'notices.json');
    await writeFile(path, '{ not JSON');
    const store = new PendingNoticeStore(path);
    await store.ready();
    assert.equal(store.peek('session-1'), undefined);
    await store.put('session-1', entry());
    assert.equal(JSON.parse(await readFile(path, 'utf8')).sessions['session-1'].messageId, 'message-1');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('expired entries are pruned and clearIf only retires the matching message', async () => {
  const dir = await tempDir();
  try {
    const path = join(dir, 'notices.json');
    const stale = new PendingNoticeStore(path, { now: () => 1_000_000 + NOTICE_MAX_AGE_MS + 1 });
    await stale.put('session-1', entry({ at: 1_000_000 }));
    assert.equal(stale.peek('session-1'), undefined);

    const store = new PendingNoticeStore(join(dir, 'live.json'));
    await store.put('session-1', entry());
    assert.equal(await store.clearIf('session-1', 'foreign-message'), false);
    assert.equal(store.peek('session-1').messageId, 'message-1');
    assert.equal(await store.clearIf('session-1', 'message-1'), true);
    assert.equal(store.peek('session-1'), undefined);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('announce injects a notice message and records it as pending', async () => {
  const dir = await tempDir();
  try {
    const store = new PendingNoticeStore(join(dir, 'notices.json'));
    const agent = fakeAgent('session-1', '/repo');
    const notifier = new CommitNotifier(fakeCtx(new Map([['session-1', agent]])), { store });

    await notifier.announce('session-1', { hash: 'abc1234', message: 'feat: x', cwd: '/repo' });

    assert.equal(agent.injected.length, 1);
    const [message] = agent.injected;
    assert.equal(message.role, 'user');
    assert.deepEqual(message.source, { kind: 'git-commit', form: 'notice', summary: 'Committed abc1234 · feat: x' });
    assert.match(message.content[0].text, /abc1234/);
    assert.equal(store.peek('session-1').messageId, message.id);
    assert.equal(store.peek('session-1').cwd, '/repo');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('announce without a live Agent stays pending and is replayed once the Session reopens', async () => {
  await repoFixture(async root => {
    const dir = await tempDir();
    try {
      const store = new PendingNoticeStore(join(dir, 'notices.json'));
      const hash = (await git(root, ['rev-parse', 'HEAD'])).trim().slice(0, 7);
      const detached = fakeCtx();
      const notifier = new CommitNotifier(detached, { store });
      await notifier.announce('session-1', { hash, message: 'feat: x', cwd: root });
      assert.equal(store.peek('session-1').text.includes(hash), true);
      const announcedId = store.peek('session-1').messageId;

      const agent = fakeAgent('session-1', root);
      const attached = new CommitNotifier(fakeCtx(new Map([['session-1', agent]])), { store });
      await attached.replay(agent);

      assert.equal(agent.injected.length, 1);
      assert.notEqual(agent.injected[0].id, announcedId, 'the replay uses a fresh message identity');
      assert.equal(store.peek('session-1').messageId, agent.injected[0].id);
      assert.match(agent.injected[0].content[0].text, new RegExp(hash));
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});

test('replay leaves a notice alone while the crash-surviving message is still queued', async () => {
  await repoFixture(async root => {
    const dir = await tempDir();
    try {
      const store = new PendingNoticeStore(join(dir, 'notices.json'));
      const hash = (await git(root, ['rev-parse', 'HEAD'])).trim().slice(0, 7);
      await store.put('session-1', entry({ cwd: root, hash, messageId: 'queued-1' }));
      const agent = fakeAgent('session-1', root);
      agent.inbox.nextStep = [{ id: 'queued-1' }];
      await new CommitNotifier(fakeCtx(new Map([['session-1', agent]])), { store }).replay(agent);

      assert.equal(agent.injected.length, 0, 'the pending inbox already holds this notice');
      assert.equal(store.peek('session-1').messageId, 'queued-1');
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});

test('replay drops a notice whose commit is no longer HEAD', async () => {
  await repoFixture(async root => {
    const dir = await tempDir();
    try {
      const store = new PendingNoticeStore(join(dir, 'notices.json'));
      await store.put('session-1', entry({ cwd: root, hash: 'deadbee' }));
      const agent = fakeAgent('session-1', root);
      await new CommitNotifier(fakeCtx(new Map([['session-1', agent]])), { store }).replay(agent);

      assert.equal(agent.injected.length, 0);
      assert.equal(store.peek('session-1'), undefined);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});

test('delivery and discard retire the record, and a newer commit replaces the queued row', async () => {
  const dir = await tempDir();
  try {
    const store = new PendingNoticeStore(join(dir, 'notices.json'));
    const agent = fakeAgent('session-1', '/repo');
    const notifier = new CommitNotifier(fakeCtx(new Map([['session-1', agent]])), { store });

    await notifier.announce('session-1', { hash: 'abc1234', message: 'feat: x', cwd: '/repo' });
    const first = agent.injected[0];
    assert.equal(await notifier.delivered(agent.session, { type: 'tool/result', data: { id: first.id } }), false,
      'only the appended user message proves delivery');
    assert.equal(await notifier.delivered(agent.session, { type: 'user/message', data: { id: 'someone-else' } }), false);
    assert.equal(store.peek('session-1').messageId, first.id);

    await notifier.announce('session-1', { hash: 'def5678', message: 'fix: y', cwd: '/repo' });
    assert.deepEqual(agent.removed, [first.id], 'the superseded row leaves the inbox before the replacement');
    assert.equal(store.peek('session-1').hash, 'def5678');

    assert.equal(await notifier.delivered(agent.session, { type: 'user/message', data: { id: first.id } }), false,
      'an already superseded message no longer retires the record');
    assert.equal(await notifier.discarded(agent, { id: agent.injected[1].id }), true);
    assert.equal(store.peek('session-1'), undefined);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('a successful commit announces itself to the requesting Session', async () => {
  await repoFixture(async root => {
    const dir = await tempDir();
    try {
      await writeFile(join(root, 'a.txt'), 'one\ntwo\n');
      const agents = new Map();
      const agent = fakeAgent('session-1', root);
      agents.set('session-1', agent);
      const store = new PendingNoticeStore(join(dir, 'notices.json'));
      const ctx = {
        get: name => name === 'agents' ? { get: id => agents.get(id) } : undefined,
        llm: { listProviders: () => [], listModels: async () => [] },
      };
      const service = new GitCommitService(ctx, { notifier: new CommitNotifier(ctx, { store }) });
      const result = await service.commit({ cwd: root, sessionId: 'session-1', message: 'feat: add two' });
      service.close();

      assert.equal(result.success, true, result.error);
      assert.equal(agent.injected.length, 1);
      assert.match(agent.injected[0].content[0].text, new RegExp(result.hash));
      assert.equal(store.peek('session-1').hash, result.hash);
      assert.equal(store.peek('session-1').messageId, agent.injected[0].id);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});

test('a commit without a Session, or with the notifier disabled, injects nothing', async () => {
  await repoFixture(async root => {
    await writeFile(join(root, 'a.txt'), 'one\ntwo\n');
    const agent = fakeAgent('session-1', root);
    const dir = await tempDir();
    try {
      const store = new PendingNoticeStore(join(dir, 'notices.json'));
      const ctx = {
        get: name => name === 'agents' ? { get: id => id === 'session-1' ? agent : undefined } : undefined,
        llm: { listProviders: () => [], listModels: async () => [] },
      };
      // No sessionId: another Host plugin committed for a directory, so no inbox exists.
      const anonymous = new GitCommitService(ctx, { notifier: new CommitNotifier(ctx, { store }) });
      const first = await anonymous.commit({ cwd: root, message: 'feat: add two' });
      anonymous.close();
      assert.equal(first.success, true, first.error);
      assert.equal(agent.injected.length, 0);
      assert.equal(store.peek('session-1'), undefined);

      await writeFile(join(root, 'a.txt'), 'one\ntwo\nthree\n');
      const disabled = new GitCommitService(ctx, { notifier: null });
      const second = await disabled.commit({ cwd: root, sessionId: 'session-1', message: 'feat: add three' });
      disabled.close();
      assert.equal(second.success, true, second.error);
      assert.equal(agent.injected.length, 0);
      assert.equal(store.peek('session-1'), undefined);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});

test('noticePath follows DSH_HOME so the store stays inside the profile home', async () => {
  const previous = process.env.DSH_HOME;
  const dir = await tempDir();
  process.env.DSH_HOME = dir;
  try {
    assert.equal(noticePath(), join(dir, 'dsh-git-commit-notices.json'));
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previous;
    await rm(dir, { recursive: true, force: true });
  }
});
