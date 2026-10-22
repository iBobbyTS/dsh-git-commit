import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = file => readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const pkg=JSON.parse(source('package.json'));

test('npm package name, host bundle patch and published entries match scoped identity',()=>{
  assert.equal(pkg.name,'@ibobbyts/dsh-git-commit');
  assert.equal(pkg.version,'0.2.1');
  assert.equal(pkg.publishConfig.access,'public');
  assert.equal(pkg.repository.url,'git+https://github.com/iBobbyTS/dsh-git-commit.git');
  assert.equal(pkg.dsh.bundle.patch,'./cordis.patch.yml');
  assert.match(source('cordis.patch.yml'),/name:\s*['"]?@ibobbyts\/dsh-git-commit/);
  assert.match(source('cordis.patch.yml'),/id:\s*dsh-git-commit/);
  assert.match(source('lib/index.js'),/provide\('gitCommit'/);
  assert.match(source('README.md'),/ctx\.gitCommit\.commit\(\{ cwd \}\)/);
});

test('npm release workflow is tag gated, OIDC-only and safe on manual dispatch',()=>{
  const release=source('.github/workflows/npm-publish.yml');
  const ci=source('.github/workflows/ci.yml');
  assert.match(release,/id-token: write/);
  assert.match(release,/if: github\.event_name == 'push'\s*\n\s*run: npm publish --access public/);
  assert.match(release,/npm pack --dry-run --ignore-scripts/);
  assert.match(release,/git merge-base --is-ancestor HEAD refs\/remotes\/origin\/main/);
  assert.match(release,/registry-url: https:\/\/registry\.npmjs\.org/);
  assert.doesNotMatch(release,/secrets\.NPM_TOKEN|NODE_AUTH_TOKEN/);
  assert.match(ci,/pull_request:/);
  assert.match(source('docs/RELEASING.md'),/Trusted publishing/);
});
