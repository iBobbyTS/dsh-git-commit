import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const supported = new Set([
  '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-client-ui-renderer',
  '@deepseek-ai/dsh-client-ui-layout',
  '@deepseek-ai/dsh-client-ui-session',
  '@deepseek-ai/dsh-client-ui-sidebar-right',
]);

test('Client package graph names actual shipped DSH plugins', () => {
  assert.equal(manifest.name, 'dsh-git-commit');
  assert.equal(manifest.dsh.client.platform, 'web');
  assert.equal(manifest.exports['./client'], './lib/client.js');
  assert.deepEqual(new Set(manifest.dsh.client.inject), supported);
  assert.equal(manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-runtime'), false);
});

function nodes(node, predicate, result = []) {
  if (Array.isArray(node)) {
    for (const item of node) nodes(item, predicate, result);
  } else if (node && typeof node === 'object') {
    if (predicate(node)) result.push(node);
    for (const child of node.children ?? []) nodes(child, predicate, result);
  }
  return result;
}

test('Client loader mounts overlay and right-sidebar settings, tracking on-screen Session', () => {
  const definitions = new Map();
  const tabTypes = new Map();
  const opened = [];
  const appendedStyles = [];
  const selected = {
    id: 's1',
    getSnapshot: () => selected.id,
    subscribe: () => () => {},
  };
  // Current DSH SessionListState deliberately has NO "current" key.
  const sessions = {
    ids: ['s1', 's2'],
    byId: {
      s1: { cwd: '/repo-one' },
      s2: { cwd: '/repo-two' },
    },
  };
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useState: (initial) => [initial, () => {}],
    useRef: (initial) => ({ current: initial }),
    useEffect: () => {},
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  };
  const registrations = [];
  const window = { __ModuleLoader__: { load: (entry) => registrations.push(entry) } };
  const document = {
    createElement: () => ({ dataset: {}, remove() {} }),
    head: { appendChild: (element) => appendedStyles.push(element) },
  };
  runInNewContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), { window, document });
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].id, manifest.name);
  const plugin = registrations[0].factory((name) => {
    assert.equal(name, 'react');
    return React;
  });
  assert.deepEqual(Array.from(plugin.inject), ['slots', 'connection', 'sidebarRight', 'sidebarRightTabs']);

  plugin.apply({
    effect: (register) => register(),
    connection: { rpc: { call: async () => ({ ok: true, value: {} }) } },
    sidebarRight: {
      mounted: selected,
      openTab: (kind) => opened.push(kind),
    },
    sidebarRightTabs: { register: (definition) => {
      tabTypes.set(definition.kind, definition);
      return () => tabTypes.delete(definition.kind);
    } },
    slots: {
      inject: (_key, register) => register(),
      register: (definition, component) => {
        definitions.set(definition.name, component);
        return () => definitions.delete(definition.name);
      },
    },
  });

  assert.equal(appendedStyles[0].dataset.dshGitCommit, 'true');
  assert.equal(tabTypes.get('gitCommitSettings').id, 'dsh-git-commit/settings');
  assert.ok(definitions.has('sidebar.right.pane.tab'));
  const Pill = definitions.get('shell.overlay');
  assert.equal(typeof Pill, 'function');
  const props = { useSessions: (selector) => selector(sessions) };
  const one = Pill(props);
  assert.notEqual(one, null, 'visible Session must produce the floating pill');
  assert.equal(nodes(one, (node) => node.props?.className === 'dgc-branch')[0].props.title, '/repo-one');
  const buttons = nodes(one, node => node.type === 'button' && node.props?.className?.includes('dgc-icon-button'));
  assert.equal(buttons.length, 2, 'both floating actions have icon-only controls');
  for (const button of buttons) {
    assert.ok(button.props['aria-label'], 'accessible action label');
    assert.ok(button.props.title, 'native tooltip');
    assert.equal(button.children.length, 1, 'no visible text in action');
    assert.equal(button.children[0].type, 'svg');
    assert.equal(button.children[0].props['aria-hidden'], true);
  }
  assert.ok(buttons[0].props['aria-label'].includes('commit'));
  assert.equal(buttons[1].props['aria-label'], 'Commit settings');
  assert.ok(appendedStyles[0].textContent.includes('body[data-ds-dark-theme] .dgc-card'));
  assert.ok(appendedStyles[0].textContent.includes('body[data-ds-dark-theme] .dgc-primary'));
  assert.ok(appendedStyles[0].textContent.includes('body[data-ds-dark-theme] .dgc-secondary'));
  buttons[1].props.onClick();
  assert.deepEqual(opened, ['gitCommitSettings']);

  selected.id = 's2';
  const two = Pill(props);
  assert.equal(nodes(two, (node) => node.props?.className === 'dgc-branch')[0].props.title, '/repo-two');
  selected.id = undefined;
  assert.equal(Pill(props), null, 'global pages should hide the Session-scoped pill');
});
