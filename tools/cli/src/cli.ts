import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { build, create, dev, doctor, generate, init, test, type Flags } from './commands.js';
import { CliError, type Io } from './context.js';

export const VERSION: string = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

export const HELP = `go- ${VERSION} — CLI de la stack GO-

Usage : go- <commande> [options]

  init [dossier]                   Crée un projet GO- (contrats + API)
      --name <nom>                 Nom du projet (défaut : nom du dossier)
      --install                    Lance npm install ensuite
      --local <dépôt>              Utilise un dépôt GO- local (dépendances file:)
  create package <nom>             Ajoute un package dans packages/
      --scope <@scope>  --description <texte>
  create module <nom>              Ajoute un module GO- (src/modules) et son test
      --dir <package>              Package cible (défaut : dossier courant)
  generate openapi                 Exporte le contrat en OpenAPI 3.1
      --contract <fichier.js> --export <nom> --out <openapi.json>
  generate types <openapi.json>    Génère les types TypeScript d'une API OpenAPI
      --out <fichier.ts>
  build [--clean] [--verbose]      Compile tout le projet (incrémental)
  test [--no-build]                Compile puis lance les tests (node:test)
  dev <application>                Lance apps/<application> avec rechargement
  doctor                           Vérifie l'environnement

Options globales : --force (écrase), --help, --version
`;

const COMMANDS: Record<string, (args: string[], flags: Flags, io: Io) => Promise<number>> = {
  init, create, generate, build, test, dev, doctor,
};

export function defaultIo(): Io {
  return { cwd: process.cwd(), env: process.env, out: (l) => console.log(l), err: (l) => console.error(l) };
}

/** Point d'entrée testable : renvoie le code de sortie au lieu de quitter le processus. */
export async function main(argv: readonly string[], io: Io = defaultIo()): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      strict: true,
      options: {
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
        force: { type: 'boolean' },
        install: { type: 'boolean' },
        clean: { type: 'boolean' },
        verbose: { type: 'boolean' },
        'no-build': { type: 'boolean' },
        name: { type: 'string' },
        local: { type: 'string' },
        scope: { type: 'string' },
        description: { type: 'string' },
        dir: { type: 'string' },
        contract: { type: 'string' },
        export: { type: 'string' },
        out: { type: 'string' },
        reporter: { type: 'string' },
      },
    });
  } catch (e) {
    io.err(`✖ ${(e as Error).message}\n`);
    io.err(HELP);
    return 2;
  }
  const { values, positionals } = parsed;
  if (values.version) {
    io.out(VERSION);
    return 0;
  }
  const [command, ...args] = positionals;
  if (!command || values.help) {
    io.out(HELP);
    return command || values.help ? 0 : 2;
  }
  const handler = COMMANDS[command];
  if (!handler) {
    io.err(`✖ Commande inconnue : « ${command} »\n`);
    io.err(HELP);
    return 2;
  }
  try {
    return await handler(args, values as Flags, io);
  } catch (e) {
    if (e instanceof CliError) {
      io.err(`✖ ${e.message}`);
      return e.exitCode;
    }
    if (e instanceof Error && e.name === 'FileConflictError') {
      io.err(`✖ ${e.message}`);
      return 1;
    }
    io.err(`✖ Erreur inattendue : ${e instanceof Error ? e.stack : String(e)}`);
    return 1;
  }
}
