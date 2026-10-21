/** Change tokens keep browser polling cheap: Git is queried only on changes. */
import { watch } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { git } from './git.js';

const IGNORE = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', 'target', '.next', '.venv', '__pycache__']);
export class RepoWatcher {
  constructor() { this.repos = new Map(); this.seed = 0; }
  async token(root) {
    let record = this.repos.get(root);
    if (record) return record.token;
    record = { token: ++this.seed, handles: [], timer: null, first: 0 };
    this.repos.set(root, record);
    const publish = () => { record.token += 1; record.first = 0; record.timer = null; };
    const bump = () => {
      const now = Date.now();
      if (!record.first) record.first = now;
      if (record.timer) clearTimeout(record.timer);
      if (now - record.first > 1000) return publish();
      record.timer = setTimeout(publish, 160);
      record.timer.unref?.();
    };
    const listen = (path, options, filter) => {
      try {
        const handle = watch(path, options, (_, file) => { if (filter(file)) bump(); });
        handle.on('error', () => bump());
        handle.unref?.();
        record.handles.push(handle);
      } catch { /* A low-frequency client fallback still ensures eventual refresh. */ }
    };
    listen(root, { recursive: true }, path => {
      if (!path) return true;
      const first = String(path).replaceAll('\\', '/').split('/')[0];
      return !IGNORE.has(first);
    });
    // Git worktrees have a .git FILE, and common refs may live in another checkout.
    for (const path of ['HEAD', 'index', 'packed-refs', 'refs', 'MERGE_HEAD']) {
      try {
        const actual = (await git(root, ['rev-parse', '--git-path', path])).trim();
        const full = resolve(root, actual);
        listen(dirname(full), {}, name => {
          if (!name) return true;
          if (path === 'refs') return String(name) === 'refs';
          return String(name) === path.split('/').at(-1);
        });
      } catch { /* Path may not exist on a freshly initialized repository. */ }
    }
    return record.token;
  }
  close() {
    for (const record of this.repos.values()) {
      if (record.timer) clearTimeout(record.timer);
      for (const handle of record.handles) handle.close();
    }
    this.repos.clear();
  }
}
