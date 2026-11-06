import { execFileSync } from 'node:child_process'
import { build } from 'tsdown'
import { rmSync } from 'node:fs'

// Only this package's generated runtime directory is owned by this build.
rmSync('lib', { recursive: true, force: true })
await build({
  entry: ["src/index.ts", "src/core/watcher.ts", "src/core/errors.ts", "src/core/message.ts", "src/core/actions.ts", "src/core/notice.ts", "src/core/git.ts", "src/core/service.ts", "src/core/metrics.ts", "src/core/store.ts"], outDir: 'lib', root: 'src', unbundle: true,
  platform: 'node', format: 'esm', outExtensions: () => ({ js: '.js' }), target: 'node22', sourcemap: true,
  clean: false, dts: false, deps: { neverBundle: [/.*/] },
})
await build({
 entry: ["src/client.ts"], outDir: 'lib', platform: 'browser', format: 'cjs',
 target: 'es2022', sourcemap: true, clean: false, dts: false,
 deps: { neverBundle: ["react", "react/jsx-runtime", "react-dom", "@deepseek-ai/dsh-client-ui-primitives"] },
 outputOptions: {
   entryFileNames: 'client.js',
   banner: 'window.__ModuleLoader__.load({ id: \"@ibobbyts/dsh-git-commit\", factory: (require) => {',
   intro: 'var module = { exports: {} }; var exports = module.exports;',
   footer: 'return module.exports; } });',
 },
})

execFileSync('pnpm',['exec','tsc','-p','tsconfig.build.json'],{stdio:'inherit'})
