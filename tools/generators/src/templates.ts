import { camelCase, constantCase, kebabCase, pascalCase } from '@go-/shared';
import { toJson, type GeneratedFile } from './fs.js';

export const GO_VERSION = '^0.1.0';
export const GO_PACKAGES = ['types', 'shared', 'core', 'config', 'contracts', 'runtime', 'security', 'api-client', 'testing', 'generators', 'cli'] as const;
export type GoPackage = (typeof GO_PACKAGES)[number];

/** Résout la version d'un package GO- (registre npm par défaut, chemin local pour le développement). */
export type GoDependencyResolver = (pkg: GoPackage) => string;
export const npmResolver: GoDependencyResolver = () => GO_VERSION;

const NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
export function assertPackageName(name: string): void {
  if (!NAME.test(name) || name.length > 214) throw new Error(`Nom de package npm invalide : « ${name} » (minuscules, chiffres, -, . et _)`);
}

const deps = (resolve: GoDependencyResolver, pkgs: readonly GoPackage[]) =>
  Object.fromEntries(pkgs.map((p) => [`@go-/${p}`, resolve(p)]));

export const TSCONFIG_BASE = {
  compilerOptions: {
    target: 'ES2023',
    lib: ['ES2023'],
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    types: ['node'],
    strict: true,
    noUncheckedIndexedAccess: true,
    noImplicitOverride: true,
    noFallthroughCasesInSwitch: true,
    verbatimModuleSyntax: true,
    isolatedModules: true,
    declaration: true,
    declarationMap: true,
    sourceMap: true,
    composite: true,
    incremental: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
  },
};

const packageTsconfig = (references: string[] = []) => ({
  extends: '../../tsconfig.base.json',
  compilerOptions: { rootDir: 'src', outDir: 'dist', tsBuildInfoFile: 'dist/.tsbuildinfo' },
  include: ['src'],
  ...(references.length && { references: references.map((path) => ({ path })) }),
});

/* ------------------------------------------------------------------ */
/* Projet complet : go- init                                          */
/* ------------------------------------------------------------------ */

export interface WorkspaceTemplateOptions {
  name: string;
  resolve?: GoDependencyResolver;
}

export function workspaceTemplate({ name, resolve = npmResolver }: WorkspaceTemplateOptions): GeneratedFile[] {
  assertPackageName(name);
  const slug = name.replace(/^@[^/]+\//, '');
  const scope = `@${slug}`;
  const contractsName = `${scope}/contracts`;
  return [
    {
      path: 'package.json',
      content: toJson({
        name: slug,
        private: true,
        type: 'module',
        engines: { node: '>=22.12.0' },
        workspaces: ['packages/*', 'apps/*'],
        scripts: {
          build: 'go- build',
          test: 'go- test',
          dev: 'go- dev api',
          start: 'node apps/api/dist/main.js',
          doctor: 'go- doctor',
        },
        devDependencies: { '@go-/cli': resolve('cli'), '@types/node': '^22.10.0', typescript: '^7.0.2' },
      }),
    },
    { path: 'tsconfig.base.json', content: toJson(TSCONFIG_BASE) },
    { path: 'tsconfig.json', content: toJson({ files: [], references: [{ path: 'packages/contracts' }, { path: 'apps/api' }] }) },
    { path: '.gitignore', content: 'node_modules/\ndist/\n*.tsbuildinfo\n.env\n.env.local\n.env.*.local\n' },
    { path: '.nvmrc', content: '22\n' },
    {
      path: 'README.md',
      content: `# ${slug}

Projet créé avec la stack **GO-**.

\`\`\`bash
npm install
cp apps/api/.env.example apps/api/.env
npm run build
npm test
npm run dev        # API sur http://localhost:3000/api/v1/health
\`\`\`

- \`packages/contracts\` : contrats API partagés (backend et frontends).
- \`apps/api\` : API Node.js sur le runtime GO-.

Générer du code : \`npx go- create package <nom>\`, \`npx go- create module <nom> --dir apps/api\`.
`,
    },

    /* --- contrats partagés --- */
    {
      path: 'packages/contracts/package.json',
      content: toJson({
        name: contractsName,
        version: '0.1.0',
        private: true,
        type: 'module',
        main: './dist/index.js',
        types: './dist/index.d.ts',
        exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' } },
        dependencies: deps(resolve, ['shared', 'contracts']),
      }),
    },
    { path: 'packages/contracts/tsconfig.json', content: toJson(packageTsconfig()) },
    {
      path: 'packages/contracts/src/index.ts',
      content: `import { defineContract, defineEndpoint } from '@go-/contracts';
import { s, type Infer } from '@go-/shared';

export const HelloResponse = s.object({ message: s.string() });
export type HelloResponse = Infer<typeof HelloResponse>;

export const contract = defineContract({
  name: '${slug}',
  version: 'v1',
  basePath: '/api/v1',
  endpoints: {
    health: defineEndpoint({ method: 'GET', path: '/health', summary: 'État de santé', response: s.object({ status: s.literal('ok') }) }),
    hello: defineEndpoint({
      method: 'GET',
      path: '/hello',
      summary: 'Message de bienvenue',
      query: s.object({ name: s.string().min(1).max(50).default('monde') }),
      response: HelloResponse,
    }),
  },
});
`,
    },

    /* --- API --- */
    {
      path: 'apps/api/package.json',
      content: toJson({
        name: `${scope}/api`,
        version: '0.1.0',
        private: true,
        type: 'module',
        main: './dist/main.js',
        scripts: { start: 'node dist/main.js' },
        dependencies: { [contractsName]: '0.1.0', ...deps(resolve, ['core', 'config', 'shared', 'runtime']) },
        devDependencies: deps(resolve, ['api-client']),
      }),
    },
    { path: 'apps/api/tsconfig.json', content: toJson(packageTsconfig(['../../packages/contracts'])) },
    { path: 'apps/api/.env.example', content: 'NODE_ENV=development\nAPI_PORT=3000\nAPI_HOST=0.0.0.0\n' },
    {
      path: 'apps/api/src/config.ts',
      content: `import { defineConfig } from '@go-/config';
import { s } from '@go-/shared';

export const config = defineConfig({
  port: s.number().int().min(0).max(65535).default(3000),
  host: s.string().default('0.0.0.0'),
});
`,
    },
    {
      path: 'apps/api/src/app.ts',
      content: `import type { GoModule } from '@go-/core';
import { httpModule } from '@go-/runtime';
import { contract } from '${contractsName}';

export function createModules(options: { port: number; host: string }): GoModule[] {
  return [
    httpModule({
      port: options.port,
      host: options.host,
      server: () => ({
        contract,
        handlers: {
          health: () => ({ status: 'ok' as const }),
          hello: ({ query }) => ({ message: \`Bonjour, \${query.name} !\` }),
        },
      }),
    }),
  ];
}
`,
    },
    {
      path: 'apps/api/src/main.ts',
      content: `import { bootstrap, runApp } from '@go-/runtime';
import { createModules } from './app.js';
import { config } from './config.js';

const { app } = bootstrap({ name: 'api', config, envPrefix: 'API', modules: (values) => createModules(values) });
await runApp(app);
`,
    },
    {
      path: 'apps/api/src/__tests__/api.test.ts',
      content: `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '@go-/api-client';
import { createApp, createLogger } from '@go-/core';
import { HTTP_SERVER } from '@go-/runtime';
import { contract } from '${contractsName}';
import { createModules } from '../app.js';

test('l’API répond conformément au contrat', async (t) => {
  const app = createApp({ name: 'api', env: 'test', logger: createLogger({ level: 'silent' }), modules: createModules({ port: 0, host: '127.0.0.1' }) });
  await app.start();
  t.after(() => app.stop());
  const { port } = app.container.resolve(HTTP_SERVER).server.address() as { port: number };
  const api = createApiClient(contract, { baseUrl: \`http://127.0.0.1:\${port}\` });
  assert.deepEqual(await api.health(), { status: 'ok' });
  assert.deepEqual(await api.hello({ query: { name: 'GO-' } }), { message: 'Bonjour, GO- !' });
});
`,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* go- create package                                                 */
/* ------------------------------------------------------------------ */

export function packageTemplate(options: { name: string; scope?: string; description?: string; resolve?: GoDependencyResolver }): GeneratedFile[] {
  const dir = kebabCase(options.name);
  if (!dir) throw new Error('Nom de package vide');
  const fullName = options.scope ? `${options.scope}/${dir}` : dir;
  assertPackageName(fullName);
  const fn = camelCase(options.name);
  return [
    {
      path: `packages/${dir}/package.json`,
      content: toJson({
        name: fullName,
        version: '0.1.0',
        description: options.description ?? '',
        type: 'module',
        main: './dist/index.js',
        types: './dist/index.d.ts',
        exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' } },
        files: ['dist', '!dist/__tests__', '!dist/**/*.tsbuildinfo'],
        sideEffects: false,
        dependencies: {},
      }),
    },
    { path: `packages/${dir}/tsconfig.json`, content: toJson(packageTsconfig()) },
    {
      path: `packages/${dir}/src/index.ts`,
      content: `/** ${fullName}${options.description ? ` — ${options.description}` : ''} */
export function ${fn}Info(): { name: string } {
  return { name: '${fullName}' };
}
`,
    },
    {
      path: `packages/${dir}/src/__tests__/index.test.ts`,
      content: `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ${fn}Info } from '../index.js';

test('${fullName}', () => {
  assert.equal(${fn}Info().name, '${fullName}');
});
`,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* go- create module                                                  */
/* ------------------------------------------------------------------ */

export function moduleTemplate(options: { name: string }): GeneratedFile[] {
  const file = kebabCase(options.name);
  if (!file) throw new Error('Nom de module vide');
  const Pascal = pascalCase(options.name);
  const camel = camelCase(options.name);
  const TOKEN = `${constantCase(options.name)}_SERVICE`;
  return [
    {
      path: `src/modules/${file}.module.ts`,
      content: `import { defineModule, token } from '@go-/core';

export interface ${Pascal}Service {
  status(): { module: string; started: boolean };
}

export function create${Pascal}Service(): ${Pascal}Service & { started: boolean } {
  return {
    started: false,
    status() {
      return { module: '${file}', started: this.started };
    },
  };
}

export const ${TOKEN} = token<ReturnType<typeof create${Pascal}Service>>('${file}');

/** Module « ${file} » : enregistrez ici ses services, démarrez et arrêtez ses ressources. */
export const ${camel}Module = defineModule({
  name: '${file}',
  register: ({ container }) => void container.factory(${TOKEN}, () => create${Pascal}Service()),
  onStart: ({ container, logger }) => {
    container.resolve(${TOKEN}).started = true;
    logger.debug('module démarré');
  },
  onStop: ({ container }) => {
    container.resolve(${TOKEN}).started = false;
  },
});
`,
    },
    {
      path: `src/__tests__/${file}.module.test.ts`,
      content: `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, createLogger } from '@go-/core';
import { ${TOKEN}, ${camel}Module } from '../modules/${file}.module.js';

test('module ${file} : cycle de vie', async () => {
  const app = createApp({ name: 'test', env: 'test', logger: createLogger({ level: 'silent' }), modules: [${camel}Module] });
  await app.start();
  assert.deepEqual(app.container.resolve(${TOKEN}).status(), { module: '${file}', started: true });
  await app.stop();
  assert.equal(app.container.resolve(${TOKEN}).started, false);
});
`,
    },
  ];
}
