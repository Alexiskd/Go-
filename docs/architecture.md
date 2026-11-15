# Architecture

## Arborescence

```
Go-/
├── packages/          Code propriétaire GO- publié sur npm (@go-/*)
│   ├── types          aucune dépendance
│   ├── shared         → types
│   ├── core           → types, shared
│   ├── config         → types, shared, core
│   ├── contracts      → types, shared
│   ├── runtime        → types, shared, core, config, contracts
│   ├── security       → types, shared
│   ├── api-client     → types, shared, contracts
│   ├── testing        → types, core
│   └── hot            → types, core   (superviseur go-hot)
├── tools/             Outils de développement
│   ├── generators     templates, OpenAPI → TypeScript
│   ├── cli            commande go-
│   ├── create-go-     npm create go-@latest
│   └── scripts        publication npm
├── apps/
│   └── playground     application de référence (API v1 complète, privée)
├── stacks/            références officielles en submodules (lecture seule, hors build)
├── docs/
├── .github/workflows  CI et publication
└── render.yaml        déploiement de l'application de référence
```

Le graphe de dépendances est **acyclique** et vérifié par TypeScript (project references) :
un package ne peut importer que ce qu'il référence dans son `tsconfig.json`.

## Couches

| Couche | Packages | Peut être utilisée côté navigateur |
|---|---|---|
| Fondations | types, shared | oui |
| Contrats | contracts, api-client | oui |
| Noyau applicatif | core, config | core oui (sans Node) ; config non |
| Serveur | runtime, security | **non** (node:http, node:crypto, secrets) |

`@go-/security` et `@go-/config` ne doivent jamais être importés dans un bundle frontend :
les secrets restent côté serveur.

## Cycle de vie d'une application

```
bootstrap()           Node ≥ 22.12, NODE_ENV, fichiers .env, configuration validée, logger
  └─ createApp()      plugins.setup → modules.register → modules.onInit   (ordre des dépendances)
runApp()              modules.onStart ; SIGINT/SIGTERM → modules.onStop (ordre inverse, borné dans le temps)
```

Un **module** a une responsabilité unique, déclare ses dépendances (`dependsOn`) et enregistre ses services
dans le conteneur (`token<T>()`), sans décorateurs ni réflexion. Un **plugin** étend l'application de l'extérieur
(observabilité, intégrations) via le bus d'événements.

## Requête HTTP

```
requête → CORS / en-têtes → beforeRequest (rate limit) → route du contrat
        → authenticate → authorize(permission) → validation params / query / body
        → handler(entrées typées) → validation + nettoyage de la réponse → JSON
erreur  → GoError normalisée { code, message, status, details?, requestId }
```

Les réponses sont validées par le schéma du contrat : un champ interne (ex. `passwordHash`)
renvoyé par erreur est supprimé, un type incorrect produit une 500 journalisée.

## Où s'insèrent NestJS, Next.js, React et Angular

Les contrats (`@go-/contracts`) et le client (`@go-/api-client`) n'ont aucune dépendance framework :

- **Next.js / React** : `createApiClient(contract, …)` dans les Server Components, Route Handlers ou hooks.
- **Angular** : le client s'enveloppe dans un service injectable (`inject()`), ou dans `from()` pour RxJS.
- **NestJS** : les schémas des contrats valident les DTO dans un `PipeTransform` ; les modules NestJS
  restent les unités d'organisation côté serveur.

Les starters correspondants sont listés dans la [feuille de route](feuille-de-route.md).
