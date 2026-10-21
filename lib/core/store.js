/** Host-owned settings. Global and repository scopes are stored outside Git. */
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const HOME = () => process.env.DSH_HOME || join(homedir(), '.dsh');
/** Stable fallback for existing v1 settings files without presentation preferences. */
export const DEFAULT_COUNTDOWN_COLOR = '#f59e0b';
const countdownColor = value => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
  ? value.toLowerCase() : DEFAULT_COUNTDOWN_COLOR;
const validFloatingPosition = value => value !== null && value !== undefined && typeof value === 'object'
  && !Array.isArray(value) && Number.isFinite(value.right) && Number.isFinite(value.top)
  && value.right >= 0 && value.top >= 0 && value.right <= 100000 && value.top <= 100000;
const defaults = () => ({ version: 1, global: { instruction: '', model: null, autoHideNonGit: false, showTokenDetails: false, countdownColor: DEFAULT_COUNTDOWN_COLOR, floatingPosition: null }, repositories: {} });
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
      autoHideNonGit: data.global?.autoHideNonGit === true,
      showTokenDetails: data.global?.showTokenDetails === true,
      countdownColor: countdownColor(data.global?.countdownColor),
      floatingPosition: validFloatingPosition(data.global?.floatingPosition)
        ? {right:data.global.floatingPosition.right,top:data.global.floatingPosition.top} : null,
      repositoryInstruction: typeof repo.instruction === 'string' ? repo.instruction : '',
      inheritGlobal: repo.inheritGlobal !== false,
      model,
    };
  }
  async save(root, patch) {
    const allowed = ['globalInstruction', 'repositoryInstruction', 'inheritGlobal', 'model', 'autoHideNonGit', 'showTokenDetails', 'countdownColor', 'floatingPosition'];
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
      if ('autoHideNonGit' in patch) {
        if (typeof patch.autoHideNonGit !== 'boolean') throw new Error('autoHideNonGit must be a boolean');
        global.autoHideNonGit = patch.autoHideNonGit;
      }
      if ('showTokenDetails' in patch) {
        if (typeof patch.showTokenDetails !== 'boolean') throw new Error('showTokenDetails must be a boolean');
        global.showTokenDetails = patch.showTokenDetails;
      }
      if ('countdownColor' in patch) {
        if (typeof patch.countdownColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(patch.countdownColor)) {
          throw new Error('countdownColor must be a #RRGGBB color');
        }
        global.countdownColor = patch.countdownColor.toLowerCase();
      }
      if ('floatingPosition' in patch) {
        if (patch.floatingPosition !== null && !validFloatingPosition(patch.floatingPosition)) {
          throw new Error('floatingPosition must be null or finite nonnegative right/top coordinates');
        }
        global.floatingPosition = patch.floatingPosition === null ? null
          : {right:patch.floatingPosition.right,top:patch.floatingPosition.top};
      }
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
