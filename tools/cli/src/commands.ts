import { existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { toOpenApi, type ContractSpec } from '@go-/contracts';
import {
  addProjectReference, moduleTemplate, npmResolver, openApiToTs, packageTemplate, workspaceTemplate, writeFiles,
  type GoDependencyResolver,
} from '@go-/generators';
import { kebabCase } from '@go-/shared';
import { CliError, detectScope, findBinary, findTestFiles, readJson, requireRoot, requireTsc, run, type Io } from './context.js';

export type Flags = Record<string, string | boolean | undefined>;
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

/* ---------------- init ---------------- */

/** Résolveur pour un dépôt GO- local (`--local <chemin>`) : dépendances `file:`. */
export function localResolver(repo: string): GoDependencyResolver {
  const abs = resolve(repo);
  if (!existsSync(join(abs, 'packages', 'core', 'package.json'))) throw new CliError(`--local : ${abs} n'est pas un dépôt GO-`);
  return (pkg) => `file:${join(abs, pkg === 'cli' || pkg === 'generators' ? 'tools' : 'packages', pkg)}`;
}

export async function init(args: string[], flags: Flags, io: Io): Promise<number> {
  const target = resolve(io.cwd, args[0] ?? '.');
  const name = str(flags.name) ?? kebabCase(basename(target));
  if (!name) throw new CliError('Impossible de déduire un nom de projet : utilisez --name');
  if (existsSync(target) && readdirSync(target).filter((f) => f !== '.git').length && !flags.force) {
    throw new CliError(`Le dossier ${target} n'est pas vide (utilisez --force pour générer quand même)`);
  }
  const local = str(flags.local);
  const files = writeFiles(target, workspaceTemplate({ name, resolve: local ? localResolver(local) : npmResolver }), { force: !!flags.force });
  io.out(`✔ Projet « ${name} » créé dans ${target} (${files.length} fichiers)`);
  if (flags.install) {
    const npm = findBinary('npm', target, io.env);
    if (!npm) throw new CliError('npm introuvable dans le PATH');
    io.out('→ npm install');
    const code = await run(npm, ['install'], { cwd: target, stdio: io.stdio });
    if (code !== 0) throw new CliError('npm install a échoué', code);
  }
  const rel = relative(io.cwd, target) || '.';
  io.out('\nÉtapes suivantes :');
  if (rel !== '.') io.out(`  cd ${rel}`);
  if (!flags.install) io.out('  npm install');
  io.out('  npm run build && npm test');
  io.out('  npm run dev');
  return 0;
}

/* ---------------- create ---------------- */

export async function create(args: string[], flags: Flags, io: Io): Promise<number> {
  const [kind, name] = args;
  if (!kind || !name) throw new CliError('Usage : go- create <package|module> <nom>');
  if (kind === 'package') {
    const root = requireRoot(io);
    const scope = str(flags.scope) ?? detectScope(root);
    const files = packageTemplate({ name, ...(scope && { scope }), ...(str(flags.description) && { description: str(flags.description)! }) });
    writeFiles(root, files, { force: !!flags.force });
    const dir = dirname(dirname(files[2]!.path));
    addProjectReference(join(root, 'tsconfig.json'), dir);
    io.out(`✔ Package créé : ${dir} (référencé dans tsconfig.json)`);
    io.out('  Relancez « npm install » pour lier le nouveau workspace.');
    return 0;
  }
  if (kind === 'module') {
    const dir = resolve(io.cwd, str(flags.dir) ?? '.');
    if (!existsSync(join(dir, 'package.json')) || !existsSync(join(dir, 'tsconfig.json'))) {
      throw new CliError(`${dir} n'est pas un package TypeScript (package.json et tsconfig.json attendus) — précisez --dir`);
    }
    const deps = readJson<{ dependencies?: Record<string, string> }>(join(dir, 'package.json')).dependencies ?? {};
    if (!deps['@go-/core']) io.err('⚠ Ce package ne dépend pas de @go-/core : ajoutez-le à ses dependencies.');
    const files = writeFiles(dir, moduleTemplate({ name }), { force: !!flags.force });
    io.out(`✔ Module créé : ${files.map((f) => relative(io.cwd, join(dir, f))).join(', ')}`);
    return 0;
  }
  throw new CliError(`Type inconnu « ${kind} » : go- create package <nom> | go- create module <nom> [--dir <package>]`);
}

/* ---------------- generate ---------------- */

const isContract = (v: unknown): v is ContractSpec =>
  !!v && typeof v === 'object' && typeof (v as ContractSpec).basePath === 'string' && typeof (v as ContractSpec).endpoints === 'object';

export async function loadContract(file: string, exportName?: string): Promise<ContractSpec> {
  if (!existsSync(file)) throw new CliError(`Module de contrat introuvable : ${file} (compilez d'abord avec « go- build »)`);
  const mod = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
  if (exportName) {
    if (!isContract(mod[exportName])) throw new CliError(`L'export « ${exportName} » de ${file} n'est pas un contrat GO-`);
    return mod[exportName];
  }
  const found = Object.values(mod).find(isContract);
  if (!found) throw new CliError(`Aucun contrat GO- exporté par ${file} (précisez --export)`);
  return found;
}

export async function generate(args: string[], flags: Flags, io: Io): Promise<number> {
  const [kind, input] = args;
  if (kind === 'openapi') {
    const root = requireRoot(io);
    const file = resolve(io.cwd, str(flags.contract) ?? join(root, 'packages', 'contracts', 'dist', 'index.js'));
    const contract = await loadContract(file, str(flags.export));
    const out = resolve(io.cwd, str(flags.out) ?? 'openapi.json');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(toOpenApi(contract), null, 2) + '\n');
    io.out(`✔ OpenAPI 3.1 écrit dans ${relative(io.cwd, out)} (${Object.keys(contract.endpoints).length} opérations)`);
    return 0;
  }
  if (kind === 'types') {
    if (!input) throw new CliError('Usage : go- generate types <openapi.json> [--out src/api-types.ts]');
    const source = isAbsolute(input) ? input : resolve(io.cwd, input);
    if (!existsSync(source)) throw new CliError(`Fichier introuvable : ${input}`);
    let doc: Record<string, unknown>;
    try {
      doc = readJson(source);
    } catch {
      throw new CliError(`${input} n'est pas un JSON valide`);
    }
    const out = resolve(io.cwd, str(flags.out) ?? 'api-types.ts');
    mkdirSync(dirname(out), { recursive: true });
    try {
      writeFileSync(out, openApiToTs(doc));
    } catch (e) {
      throw new CliError((e as Error).message);
    }
    io.out(`✔ Types TypeScript écrits dans ${relative(io.cwd, out)}`);
    return 0;
  }
  throw new CliError('Usage : go- generate <openapi|types> …');
}

/* ---------------- build / test / dev ---------------- */

export async function build(_args: string[], flags: Flags, io: Io): Promise<number> {
  const root = requireRoot(io);
  const tsc = requireTsc(root, io.env);
  const args = ['-b', ...(flags.clean ? ['--clean'] : []), ...(flags.verbose ? ['--verbose'] : [])];
  const code = await run(tsc, args, { cwd: root, stdio: io.stdio });
  if (code === 0) io.out(flags.clean ? '✔ Sorties de build supprimées' : '✔ Build terminé');
  return code;
}

export async function test(_args: string[], flags: Flags, io: Io): Promise<number> {
  const root = requireRoot(io);
  if (!flags['no-build']) {
    const code = await build([], {}, io);
    if (code !== 0) return code;
  }
  const files = findTestFiles(root);
  if (!files.length) {
    io.out('Aucun test trouvé (fichiers src/__tests__/*.test.ts).');
    return 0;
  }
  return run(process.execPath, ['--test', ...(flags.reporter ? [`--test-reporter=${flags.reporter}`] : []), ...files], { cwd: root, stdio: io.stdio });
}

export function planDev(root: string, app: string): { entry: string; watchArgs: string[] } {
  const appDir = join(root, 'apps', app);
  if (!existsSync(join(appDir, 'package.json'))) {
    const apps = existsSync(join(root, 'apps')) ? readdirSync(join(root, 'apps')).join(', ') : 'aucune';
    throw new CliError(`Application « ${app} » introuvable dans apps/ (disponibles : ${apps})`);
  }
  return { entry: join(appDir, 'dist', 'main.js'), watchArgs: ['-b', '--watch', '--preserveWatchOutput'] };
}

export async function dev(args: string[], _flags: Flags, io: Io): Promise<number> {
  const app = args[0];
  if (!app) throw new CliError('Usage : go- dev <application>');
  const root = requireRoot(io);
  const plan = planDev(root, app);
  const tsc = requireTsc(root, io.env);
  const first = await run(tsc, ['-b'], { cwd: root, stdio: io.stdio });
  if (first !== 0) return first;
  io.out(`→ ${app} : recompilation et redémarrage automatiques (Ctrl+C pour quitter)`);
  const { spawn } = await import('node:child_process');
  const children = [
    spawn(tsc, plan.watchArgs, { cwd: root, stdio: 'inherit' }),
    spawn(process.execPath, ['--watch', plan.entry], { cwd: join(root, 'apps', app), stdio: 'inherit', env: process.env }),
  ];
  return new Promise((resolvePromise) => {
    const stop = () => children.forEach((c) => c.kill('SIGTERM'));
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    let remaining = children.length;
    children.forEach((c) => c.on('exit', () => --remaining === 0 && resolvePromise(0)));
  });
}

/* ---------------- doctor ---------------- */

export async function doctor(_args: string[], _flags: Flags, io: Io): Promise<number> {
  const checks: { label: string; ok: boolean; hint?: string }[] = [];
  const [major, minor] = process.versions.node.split('.').map(Number) as [number, number];
  checks.push({ label: `Node.js ${process.versions.node}`, ok: major > 22 || (major === 22 && minor >= 12), hint: 'Node.js 22.12 ou plus récent requis' });
  checks.push({ label: 'npm', ok: !!findBinary('npm', io.cwd, io.env), hint: 'installez npm' });
  const root = (await import('./context.js')).findRoot(io.cwd);
  checks.push({ label: 'projet GO- (package.json + workspaces)', ok: !!root, hint: 'go- init <dossier>' });
  if (root) {
    checks.push({ label: 'tsconfig.json racine', ok: existsSync(join(root, 'tsconfig.json')) });
    checks.push({ label: 'TypeScript', ok: !!findBinary('tsc', root, io.env), hint: 'npm install' });
    checks.push({ label: 'dépendances installées (node_modules)', ok: existsSync(join(root, 'node_modules')), hint: 'npm install' });
    const pkg = readJson<{ dependencies?: Record<string, string>; devDependencies?: Record<string, string> }>(join(root, 'package.json'));
    const java = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((d) => /java|jvm|jdk/i.test(d));
    checks.push({ label: 'aucune dépendance Java/JVM', ok: java.length === 0, hint: java.join(', ') });
  }
  for (const c of checks) io.out(`${c.ok ? '✔' : '✖'} ${c.label}${!c.ok && c.hint ? ` — ${c.hint}` : ''}`);
  const failed = checks.filter((c) => !c.ok).length;
  io.out(failed ? `\n${failed} problème(s) détecté(s)` : '\nTout est prêt.');
  return failed ? 1 : 0;
}
