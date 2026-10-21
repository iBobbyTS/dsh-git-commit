/** Git operations; no shell interpolation and no inherited Git repository overrides. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, readFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const execute = promisify(execFile);
const MAX_BUFFER = 64 * 1024 * 1024;
const EMPTY = 'UNBORN';
const disallowedEnv = /^(?:GIT_(?:DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|PREFIX|CEILING_DIRECTORIES|NAMESPACE|CONFIG(?:_COUNT|_KEY_\d+|_VALUE_\d+)?|ENVIRONMENT|OPTIONAL_LOCKS)|GIT_TRACE.*)$/;

export async function git(cwd, args, options = {}) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !disallowedEnv.test(key)));
  Object.assign(env, options.env ?? {});
  const { stdout } = await execute('git', ['-C', cwd, ...args], {
    encoding: 'utf8', maxBuffer: options.maxBuffer ?? MAX_BUFFER,
    timeout: options.timeout ?? 60000, env, windowsHide: true,
  });
  return stdout;
}

export async function repoRoot(cwd) {
  if (typeof cwd !== 'string' || !cwd.trim()) throw new Error('A repository directory is required');
  const candidate = await realpath(resolve(cwd));
  return (await git(candidate, ['rev-parse', '--show-toplevel'])).trim();
}

/** Return null for an existing directory outside a Git working tree. Other errors are real failures. */
export async function repoRootOrNull(cwd) {
  if (typeof cwd !== 'string' || !cwd.trim()) return null;
  try { return await repoRoot(cwd); }
  catch (error) {
    const detail = `${error?.stderr ?? ''} ${error?.message ?? ''}`;
    if (/not a git repository/i.test(detail)) return null;
    throw error;
  }
}

export async function headSha(root) {
  try { return (await git(root, ['rev-parse', '--verify', 'HEAD'])).trim(); }
  catch { return EMPTY; }
}

export async function branchName(root) {
  try { return (await git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'])).trim(); }
  catch { return `detached@${(await headSha(root)).slice(0, 7)}`; }
}

export function parseNumstat(raw) {
  let additions = 0, deletions = 0, binary = 0;
  const entries = raw.split('\0');
  for (let i = 0; i < entries.length; i++) {
    const item = entries[i];
    if (!item) continue;
    const match = /^(\d+|-)\t(\d+|-)\t(.*)$/s.exec(item);
    if (!match) continue;
    if (match[3] === '') i += 2; // -z rename/copy: old and new paths follow separately
    if (match[1] === '-' || match[2] === '-') { binary++; continue; }
    additions += Number(match[1]);
    deletions += Number(match[2]);
  }
  return { additions, deletions, binary };
}

async function untrackedStats(root) {
  const names = (await git(root, ['ls-files', '--others', '--exclude-standard', '-z'])).split('\0').filter(Boolean);
  let additions = 0, unknown = 0;
  for (const name of names) {
    try {
      const data = await readFile(join(root, name));
      if (data.byteLength > 4 * 1024 * 1024 || data.includes(0)) { unknown++; continue; }
      if (data.length) additions += data.toString('utf8').split('\n').length - (data[data.length - 1] === 10 ? 1 : 0);
    } catch { unknown++; }
  }
  return { additions, untracked: names.length, unknown };
}

export async function visibleStatus(cwd) {
  const root = await repoRoot(cwd);
  const head = await headSha(root);
  let tracked;
  if (head === EMPTY) {
    const [staged, unstaged] = await Promise.all([
      git(root, ['diff', '--cached', '--numstat', '-z']),
      git(root, ['diff', '--numstat', '-z']),
    ]);
    const a = parseNumstat(staged), b = parseNumstat(unstaged);
    tracked = { additions: a.additions + b.additions, deletions: a.deletions + b.deletions, binary: a.binary + b.binary };
  } else {
    tracked = parseNumstat(await git(root, ['diff', 'HEAD', '--numstat', '-z']));
  }
  const untracked = await untrackedStats(root);
  const staged = (await git(root, ['diff', '--cached', '--name-only', '-z'])).split('\0').filter(Boolean).length;
  return {
    root, repo: basename(root), branch: await branchName(root), head,
    additions: tracked.additions + untracked.additions,
    deletions: tracked.deletions, binary: tracked.binary,
    untracked: untracked.untracked, unknownUntrackedLines: untracked.unknown,
    stagedFiles: staged,
  };
}

/** The existing real index is never modified by building a preview. */
export async function preparedSnapshot(root, mode) {
  const head = await headSha(root);
  let temp;
  let env = {};
  try {
    if (mode === 'all') {
      temp = await mkdtemp(join(tmpdir(), 'dsh-git-commit-'));
      env = { GIT_INDEX_FILE: join(temp, 'index') };
      await git(root, head === EMPTY ? ['read-tree', '--empty'] : ['read-tree', 'HEAD'], { env });
      await git(root, ['add', '-A', '--', '.'], { env, timeout: 180000 });
    }
    const tree = (await git(root, ['write-tree'], { env })).trim();
    const [pathsRaw, numstatRaw] = await Promise.all([
      git(root, ['diff', '--cached', '--name-only', '-z'], { env }),
      git(root, ['diff', '--cached', '--numstat', '-z'], { env }),
    ]);
    const paths = pathsRaw.split('\0').filter(Boolean);
    const stats = parseNumstat(numstatRaw);
    let diff, clipped = false;
    try {
      diff = await git(root, ['diff', '--cached', '--no-ext-diff', '--no-color', '--unified=1'], { env });
    } catch (e) {
      if (!/maxBuffer|stdout maxBuffer/i.test(String(e))) throw e;
      clipped = true;
      // Preserve file coverage: sampled per-file diffs and full path metadata, never a prefix-only truncation.
      const samples = [];
      for (const path of paths.slice(0, 48)) {
        try {
          const patch = await git(root, ['diff', '--cached', '--no-ext-diff', '--unified=1', '--', path], { env, maxBuffer: 384 * 1024 });
          if (patch.length) samples.push(patch.slice(0, 16000));
        } catch { samples.push(`diff --git a/${path} b/${path}\n[large file body omitted]\n`); }
      }
      diff = samples.join('\n');
    }
    return { root, head, tree, paths, diff, clipped, ...stats, mode };
  } finally {
    if (temp) await rm(temp, { recursive: true, force: true });
  }
}

export async function plannedMode(root) {
  const names = await git(root, ['diff', '--cached', '--name-only', '-z']);
  return names.length ? 'staged' : 'all';
}

export async function commitPrepared(snapshot, message) {
  const { root, mode, tree, head } = snapshot;
  if (await headSha(root) !== head) throw new Error('HEAD moved while the commit message was generated');
  if (mode === 'all') {
    if (await plannedMode(root) !== 'all') throw new Error('Files were staged while the commit was being prepared');
    const current = await preparedSnapshot(root, 'all');
    if (current.tree !== tree) throw new Error('Working tree changed while the commit message was generated');
    await git(root, ['add', '-A', '--', '.'], { timeout: 180000 });
  }
  const currentTree = (await git(root, ['write-tree'])).trim();
  if (currentTree !== tree) throw new Error('Git index changed while the commit was being prepared');
  if (await headSha(root) !== head) throw new Error('HEAD moved before committing');
  await git(root, ['commit', '-m', message], { timeout: 180000 });
  const hash = (await git(root, ['rev-parse', 'HEAD'])).trim();
  const actualMessage = (await git(root, ['log', '-1', '--format=%B']).catch(() => message)).trim();
  const rawStats = await git(root, ['show', '--root', '--numstat', '-z', '--format=', 'HEAD']).catch(() => null);
  const stats = rawStats === null ? { additions: snapshot.additions, deletions: snapshot.deletions } : parseNumstat(rawStats);
  return { success: true, status: 'success', scope: mode, additions: stats.additions, deletions: stats.deletions, message: actualMessage, hash: hash.slice(0, 7), fullHash: hash };
}

export { EMPTY as UNBORN_HEAD };
