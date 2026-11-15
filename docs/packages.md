# Packages

## @go-/shared — schémas

```ts
const User = s.object({
  email: s.string().email(),
  age: s.number().int().min(0).optional(),
  role: s.enum(['admin', 'user']).default('user'),
});
type User = Infer<typeof User>;          // { email: string; age?: number; role: 'admin' | 'user' }
User.parse(input);                       // lève SchemaError (toutes les erreurs, avec chemins)
User.safeParse(input);                   // Result
User.toJSONSchema();                     // utilisé pour OpenAPI
```
Clés inconnues supprimées, valeurs par défaut clonées, `extend` / `pick` / `omit` / `partial`, `union`, `literal`, `nullable`.

## @go-/core

- `createApp({ name, modules, plugins, config, logger })` → `init` / `start` / `stop`
- `defineModule({ name, dependsOn, register, onInit, onStart, onStop })`
- `Container` + `token<T>(nom)` : `value`, `factory` (singleton ou non), `createChild`, détection des cycles
- `EventBus<Événements>` typé ; les erreurs des gestionnaires sont agrégées, jamais avalées
- `GoError` et sous-classes (`ValidationError`, `NotFoundError`…) → `toPayload()` normalisé ; les 5xx ne divulguent rien
- `createLogger` : JSON en production, lisible en développement, masquage automatique des secrets

## @go-/config

`defineConfig(shape, { secrets })` → `load({ prefix, env, overrides })` ; `loadEnvFiles`, `parseDotenv`,
`resolveEnvironment`, `redactConfig`.

## @go-/contracts

`defineEndpoint`, `defineContract` (routes dupliquées et paramètres non déclarés refusés), `toOpenApi`,
`buildPath`, `ApiErrorSchema`, pagination, et le contrat de référence `apiV1` (rôles, permissions, DTO).

## @go-/runtime

`bootstrap`, `runApp` (signaux, erreurs fatales, arrêt borné), `createHttpServer` (contrat → HTTP), `httpModule`,
`assertNodeVersion`.

Le serveur compresse les réponses JSON de plus de 1 Ko (brotli, sinon gzip), ajoute un ETag faible et répond `304`
aux GET inchangés, et applique le `cacheControl` déclaré par l'endpoint :

```ts
listBodies: defineEndpoint({ method: 'GET', path: '/bodies', summary: 'Astres', response: BodyList,
  cacheControl: 'public, max-age=60, stale-while-revalidate=300' }),
```
Options : `compression: false | { threshold }`, `etag: false`.

## @go-/security

`hashPassword` / `verifyPassword` / `needsRehash` (scrypt), `signJwt` / `verifyJwt` / `bearerToken` (HS256 uniquement,
`alg: none` refusé), `definePolicy` (RBAC avec héritage et jokers), `createCorsPolicy`, `securityHeaders`,
`createRateLimiter`, `requireSecret`, `generateSecret`, `safeEqual`. Primitives exclusivement issues de `node:crypto`.

## @go-/api-client

`createApiClient(contract, { baseUrl, getToken, fetch, credentials, dedupe })` : une méthode typée par endpoint,
réponses validées, `ApiClientError` normalisée. Les GET identiques lancés en même temps partagent une seule requête
réseau (`dedupe`, activé par défaut). Aucune dépendance : navigateur, Next.js, Angular, Node.

## @go-/testing

`createMemoryLogger`, `createClock`, `startTestApp`, `createTempDir`.
