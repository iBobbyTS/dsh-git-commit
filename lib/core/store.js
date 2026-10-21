/** Host-owned settings. Global and repository scopes are stored outside Git. */
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const HOME = () => process.env.DSH_HOME || join(homedir(), '.dsh');
const defaults = () => ({ version: 1, global: { instruction: '', model: null }, repositories: {} });
const plain = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const string = (value, field, limit = 12000) => {
  if (typeof value !== 'string' || value.length > limit) throw new Error(`${field} must be a string of at most ${limit} characters`);
  return value;
};

export class InstructionStore {
  constructor(path = join(HOME(), 'dsh-git-commit.json')) {
    this.path = path;
    this.writes = Promise.resolve();
  }
  async read() {
    try {
      const data = JSON.parse(await readFile(this.path, 'utf8'));
      if (!plain(data) || data.version !== 1) throw new Error('Unsupported commit settings version');
      return { version: 1, global: plain(data.global) ? data.global : defaults().global, repositories: plain(data.repositories) ? data.repositories : {} };
    } catch (error) {
      if (error.code === 'ENOENT') return defaults();
      throw error;
    }
  }
  async get(root) {
    const data = await this.read();
    const repo = typeof root === 'string' && plain(data.repositories[root]) ? data.repositories[root] : {};
    const rawModel = data.global?.model;
    const model = plain(rawModel) && typeof rawModel.provider === 'string' && typeof rawModel.model === 'string' ? { provider: rawModel.provider, model: rawModel.model } : null;
    return {
      globalInstruction: typeof data.global?.instruction === 'string' ? data.global.instruction : '',
      repositoryInstruction: typeof repo.instruction === 'string' ? repo.instruction : '',
      inheritGlobal: repo.inheritGlobal !== false,
      model,
    };
  }
  async save(root, patch) {
    const allowed = ['globalInstruction', 'repositoryInstruction', 'inheritGlobal', 'model'];
    if (!plain(patch) || Object.keys(patch).some(key => !allowed.includes(key))) throw new Error('Unknown commit setting');
    if (root === null && ('repositoryInstruction' in patch || 'inheritGlobal' in patch)) {
      throw new Error('Repository-specific settings require a Git repository');
    }
    if (root !== null && (typeof root !== 'string' || !root)) throw new Error('Invalid repository scope');
    const apply = async () => {
      const data = await this.read();
      const global = plain(data.global) ? data.global : {};
      const current = root !== null && plain(data.repositories[root]) ? data.repositories[root] : {};
      if ('globalInstruction' in patch) global.instruction = string(patch.globalInstruction, 'globalInstruction');
      if ('repositoryInstruction' in patch) current.instruction = string(patch.repositoryInstruction, 'repositoryInstruction');
      if ('inheritGlobal' in patch) {
        if (typeof patch.inheritGlobal !== 'boolean') throw new Error('inheritGlobal must be a boolean');
        current.inheritGlobal = patch.inheritGlobal;
      }
      if ('model' in patch) {
        if (patch.model !== null && (!plain(patch.model) || !patch.model.provider || !patch.model.model)) throw new Error('Invalid model selection');
        global.model = patch.model === null ? null : {
          provider: string(patch.model.provider, 'model.provider', 200),
          model: string(patch.model.model, 'model.model', 400),
        };
      }
      data.global = global;
      if (root !== null) data.repositories[root] = current;
      await mkdir(dirname(this.path), { recursive: true });
      const tmp = `${this.path}.${randomUUID()}.tmp`;
      try {
        await writeFile(tmp, JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
        await rename(tmp, this.path);
      } finally { await rm(tmp, { force: true }); }
      return this.get(root);
    };
    const next = this.writes.then(apply);
    this.writes = next.catch(() => {});
    return next;
  }
}
