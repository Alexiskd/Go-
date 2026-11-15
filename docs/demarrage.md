# Démarrage rapide

## Prérequis

- Node.js **22.12** ou plus récent (`node -v`)
- npm 10+

## Créer un projet

```bash
npm create go-@latest mon-projet      # génère et installe
cd mon-projet
cp apps/api/.env.example apps/api/.env
npm run build
npm test
npm run dev
```

Sans installation automatique : `npm create go-@latest mon-projet -- --no-install`.
Équivalent avec le CLI installé : `npx @go-/cli init mon-projet --install`.

## Ce qui est généré

```
mon-projet/
├── packages/contracts/src/index.ts   contrat v1 (health, hello)
├── apps/api/src/
│   ├── config.ts                     variables API_PORT, API_HOST
│   ├── app.ts                        modules de l'application
│   ├── main.ts                       bootstrap + runApp
│   └── __tests__/api.test.ts         test de bout en bout avec @go-/api-client
├── tsconfig.base.json / tsconfig.json
└── package.json                      workspaces, scripts build / test / dev / doctor
```

## Ajouter un endpoint

1. Déclarer l'endpoint dans `packages/contracts/src/index.ts` :
   ```ts
   addition: defineEndpoint({
     method: 'POST', path: '/addition', summary: 'Additionne deux nombres',
     body: s.object({ a: s.number(), b: s.number() }),
     response: s.object({ result: s.number() }),
   }),
   ```
2. `npm run build` : TypeScript signale le handler manquant dans `apps/api/src/app.ts`.
3. L'implémenter : `addition: ({ body }) => ({ result: body.a + body.b })`.
4. Le consommer depuis n'importe quel frontend : `await api.addition({ body: { a: 1, b: 2 } })`.

## Configuration

Chaque application déclare sa configuration avec `defineConfig` ; les variables sont lues avec un préfixe
(`API_PORT` pour `port`), converties selon le schéma et validées au démarrage. Ordre de priorité :
variables réelles > `.env.<env>.local` > `.env.<env>` > `.env.local` > `.env`.
Une configuration invalide arrête le démarrage avec la liste des variables fautives.
