# Déploiement

## Publier GO- sur npm

1. Créer l'organisation **`go-`** sur npmjs.com (scope `@go-`).
2. Créer un token npm *granular* (lecture/écriture sur `@go-` et `create-go-`) et l'ajouter au dépôt GitHub :
   **Settings → Secrets and variables → Actions → `NPM_TOKEN`**.
3. Publier une version :
   ```bash
   git tag v0.1.0 && git push origin v0.1.0
   ```
   Le workflow `release.yml` compile, teste, vérifie les archives (`publish.mjs --dry-run`) puis publie
   chaque package dans l'ordre des dépendances, avec provenance. Une version déjà publiée est ignorée.

Ensuite, `npm create go-@latest mon-projet` fonctionne pour tout le monde.

## Déployer une application

Chaque application se déploie seule : `npm install && npm run build`, puis `node apps/<app>/dist/main.js`.
Les submodules `stacks/` ne sont jamais nécessaires.

### Render

Après le premier déploiement, les mises à jour se font à chaud, sans redéploiement : voir [live.md](live.md).

`render.yaml` déploie l'API de référence (`apps/playground`) : secret JWT généré par Render,
`API_ADMIN_EMAIL`, `API_ADMIN_PASSWORD` et `API_CORS_ORIGINS` à renseigner dans le tableau de bord,
health check sur `/api/v1/health`.

### Linux (systemd, conteneur…)

```bash
NODE_ENV=production API_PORT=3000 API_JWT_SECRET=… node apps/playground/dist/main.js
```
Le processus s'arrête proprement sur SIGTERM (connexions terminées, modules arrêtés en ordre inverse, délai borné).
Logs JSON sur la sortie standard en production.

## Variables de l'application de référence

| Variable | Défaut | Rôle |
|---|---|---|
| `API_PORT` / `API_HOST` | 3000 / 0.0.0.0 | écoute |
| `API_JWT_SECRET` | — | **obligatoire en production**, ≥ 32 caractères |
| `API_JWT_EXPIRES_IN` | 3600 | durée des jetons (s) |
| `API_CORS_ORIGINS` | — | origines autorisées, séparées par des virgules |
| `API_ADMIN_EMAIL` / `API_ADMIN_PASSWORD` | — | compte administrateur créé au démarrage |
| `API_PASSWORD_COST` | 15 | coût scrypt (2^n) |
| `API_RATE_LIMIT_PER_MINUTE` | 120 | requêtes par IP |
| `LOG_LEVEL` | selon l'environnement | debug, info, warn, error, silent |
