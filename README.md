# GO-

**GO-** est une stack full-stack 100 % TypeScript pour construire des applications web et des systèmes logiciels sur Node.js.
Elle fournit ses propres fondations (noyau applicatif, runtime, contrats d'API, sécurité, configuration, CLI) et s'appuie sur
**Node.js**, **NestJS**, **Next.js**, **React** et **Angular** comme moteurs technologiques.

Aucune dépendance Java ou JVM.

## Démarrer un projet en une commande

```bash
npm create go-@latest mon-projet
cd mon-projet
cp apps/api/.env.example apps/api/.env
npm run build && npm test
npm run dev          # http://localhost:3000/api/v1/hello?name=GO-
```

Le projet généré contient un package de **contrats partagés** et une **API** prête à l'emploi, déjà testée.
Ensuite :

```bash
npx go- create package billing              # nouveau package dans packages/
npx go- create module notifications --dir apps/api
npx go- generate openapi --out docs/openapi.json
npx go- generate types docs/openapi.json --out src/api-types.ts
npx go- doctor
```

> La publication npm de `@go-/*` et `create-go-` se fait par le workflow `release.yml` (tag `v*`).
> Avant la première publication, la commande ci-dessus n'est pas encore disponible : voir [docs/deploiement.md](docs/deploiement.md).

## En direct, sans redéploiement

Une PR ouverte par Claude est en ligne sur `https://<site>/pr/<numéro>` ; sa fusion met la production à jour
sans coupure ni redéploiement Render, et les pages ouvertes se rechargent seules. Voir [docs/live.md](docs/live.md).

## Ce que contient GO-

| Package | Rôle |
|---|---|
| [`@go-/types`](packages/types) | Types et constantes communs (Result, environnements, codes d'erreur) |
| [`@go-/shared`](packages/shared) | Utilitaires et **schémas** : validation, types inférés, JSON Schema |
| [`@go-/core`](packages/core) | Application, modules, plugins, injection de dépendances, événements, erreurs, logger |
| [`@go-/config`](packages/config) | Configuration typée depuis l'environnement et les fichiers `.env` |
| [`@go-/contracts`](packages/contracts) | Contrats d'API partagés backend / frontends, génération OpenAPI 3.1 |
| [`@go-/runtime`](packages/runtime) | Démarrage, signaux, arrêt propre, serveur HTTP piloté par les contrats |
| [`@go-/security`](packages/security) | scrypt, JWT HS256, RBAC, CORS, en-têtes, limitation de débit, secrets |
| [`@go-/api-client`](packages/api-client) | Client HTTP typé et validé pour React, Next.js, Angular et Node |
| [`@go-/testing`](packages/testing) | Logger mémoire, horloge, application de test |
| [`@go-/hot`](packages/hot) | Mises à jour à chaud depuis GitHub, previews de PR, sans redéploiement (`go-hot`) |
| [`@go-/generators`](tools/generators) | Templates de projet / package / module, OpenAPI → TypeScript |
| [`@go-/cli`](tools/cli) | Commande `go-` |
| [`create-go-`](tools/create-go-) | `npm create go-@latest` |

Application de référence : [`apps/playground`](apps/playground), une API v1 complète
(authentification JWT, utilisateurs, permissions, OpenAPI, CORS, limitation de débit), testée de bout en bout
avec `@go-/api-client` comme le ferait un frontend.

## Le principe : un contrat, zéro duplication

```ts
// packages/contracts — écrit une fois
export const contract = defineContract({
  name: 'boutique', version: 'v1', basePath: '/api/v1',
  endpoints: {
    getProduct: defineEndpoint({
      method: 'GET', path: '/products/:id', summary: 'Produit', auth: 'products:read',
      params: s.object({ id: s.string().uuid() }),
      response: s.object({ id: s.string(), name: s.string(), price: s.number().min(0) }),
    }),
  },
});

// Backend : entrées validées, réponse nettoyée selon le contrat, erreurs normalisées
createHttpServer({ contract, handlers: { getProduct: ({ params }) => products.get(params.id) }, ... });

// Frontend (React, Next.js, Angular) : même types, même validation
const api = createApiClient(contract, { baseUrl, getToken });
const product = await api.getProduct({ params: { id } });   // typé
```

## Développer sur ce dépôt

```bash
npm install
npm run build        # tsc -b : build incrémental de tous les packages
npm test             # node:test sur tous les packages, outils et applications
npm run go- -- doctor
```

Prérequis : Node.js ≥ 22.12. Voir [docs/](docs) : [architecture](docs/architecture.md), [démarrage](docs/demarrage.md),
[CLI](docs/cli.md), [packages](docs/packages.md), [décisions techniques](docs/decisions.md),
[déploiement](docs/deploiement.md), [performances](docs/performances.md), [feuille de route](docs/feuille-de-route.md).

## Références officielles (`stacks/`)

Les dépôts officiels des frameworks sont référencés en submodules git, à titre de documentation et de source de vérité.
Ils ne sont **ni modifiés ni nécessaires** au build de GO- :

```bash
git submodule update --init --depth 1 stacks/nestjs/nest   # récupérer une référence si besoin
```

| Technologie | Dépôt officiel | Starter |
|---|---|---|
| Node.js | `stacks/nodejs/node` | `stacks/nodejs/hackathon-starter` |
| NestJS | `stacks/nestjs/nest` | `stacks/nestjs/typescript-starter` |
| Next.js | `stacks/nextjs/next.js` | `stacks/nextjs/next.js/examples` |
| React | `stacks/react/react` | `stacks/react/vite` |
| Angular | `stacks/angular/angular` | `npx @angular/cli new` |

## Licence

MIT
