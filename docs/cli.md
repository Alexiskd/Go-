# CLI `go-`

Installé dans chaque projet (`@go-/cli`, devDependency) ; à lancer avec `npx go-` ou via les scripts npm.

| Commande | Effet |
|---|---|
| `go- init [dossier] [--name n] [--install] [--force]` | Crée un projet GO- (contrats + API testée) |
| `go- create package <nom> [--scope @s] [--description d]` | Ajoute `packages/<nom>` (source, test, tsconfig) et sa référence dans `tsconfig.json` |
| `go- create module <nom> [--dir <package>]` | Ajoute `src/modules/<nom>.module.ts` et son test dans le package ciblé |
| `go- generate openapi [--contract f.js] [--export nom] [--out f.json]` | Exporte un contrat compilé en OpenAPI 3.1 (défaut : `packages/contracts/dist/index.js`) |
| `go- generate types <openapi.json> [--out f.ts]` | Génère les types TypeScript d'une API OpenAPI 3.x (y compris externe) |
| `go- build [--clean] [--verbose]` | `tsc -b` : build incrémental, uniquement ce qui a changé |
| `go- test [--no-build] [--reporter spec]` | Compile puis exécute tous les `dist/**/__tests__/*.test.js` avec `node:test` |
| `go- dev <app>` | Compile en continu et relance `apps/<app>/dist/main.js` à chaque changement |
| `go- doctor` | Vérifie Node.js, npm, TypeScript, la structure du projet et l'absence de dépendances JVM |

Les générateurs n'écrasent jamais un fichier existant sans `--force`, et n'écrivent rien en cas de conflit.
Codes de sortie : `0` succès, `1` erreur, `2` usage incorrect.

Développement local du CLI contre ce dépôt : `go- init demo --local /chemin/vers/Go-` utilise des dépendances `file:`.
