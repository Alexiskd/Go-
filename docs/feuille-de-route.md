# Feuille de route

| Phase | Contenu | État |
|---|---|---|
| 1 | Audit du dépôt (README, submodules, branches) | fait |
| 2 | Architecture et choix techniques ([décisions](decisions.md)) | fait |
| 3 | Monorepo : workspaces, TypeScript commun, build incrémental | fait |
| 4 | `@go-/core` | fait |
| 5 | Packages communs : types, shared, config, contracts, runtime, security, api-client, testing | fait |
| 6 | Backend : API de référence sur le runtime GO- (`apps/playground`) | fait |
| 6b | Starter **NestJS** (`templates/nestjs`, `apps/api`) : modules Auth/Users/Permissions/Health, WebSocket, SSE, TypeORM + PostgreSQL | à faire |
| 7 | **Next.js / React** : `apps/web`, `@go-/ui` (composants, CSS Modules, design tokens), sessions | à faire |
| 8 | **Angular** : `apps/admin` (signals, RxJS, routing, auth) consommant `@go-/api-client` | à faire |
| 9 | CLI `go-` + `create-go-` | fait — `create app/api/component` arriveront avec les starters 6b–8 |
| 10 | Build et tests (CI GitHub Actions Node 22/24) | fait — ESLint/Prettier à brancher avec les starters |
| 11 | Documentation | fait |
| 12 | Validation globale | fait pour le périmètre livré |

Les phases 6b, 7 et 8 nécessitent l'installation des frameworks (NestJS, Next.js, Angular, TypeORM)
depuis le registre npm ; chaque starter sera livré compilé et testé, comme le reste de la stack.
