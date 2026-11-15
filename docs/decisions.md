# Décisions techniques

## 1. Orchestrateur : npm workspaces + TypeScript project references

Étudiés : npm workspaces, Turborepo, Nx.
- **Retenu** : npm workspaces pour la résolution des packages, `tsc -b` pour un build **incrémental et ordonné**
  (seuls les projets modifiés et leurs dépendants sont recompilés ; cache `.tsbuildinfo`).
- Turborepo apportera le cache distant et l'exécution parallèle des tâches non TypeScript
  (Next.js, Angular) quand ces applications rejoindront le dépôt ; il s'ajoute sans rien remplacer.
- Nx écarté : trop structurant pour la taille actuelle, et redondant avec les références de projet.

## 2. Validation : schémas GO- intégrés (`@go-/shared`)

Une seule définition sert à la validation, aux types et à OpenAPI, sans dépendance externe :
les contrats sont ainsi utilisables tels quels dans le navigateur, NestJS et Angular.
Le périmètre est volontairement limité (types JSON) ; pas de transformations implicites.

## 3. Sécurité : standards, aucune cryptographie maison

scrypt (RFC 7914) pour les mots de passe, HMAC-SHA256 pour JWT HS256 (RFC 7519), comparaisons à temps constant,
tous fournis par `node:crypto`. Algorithme JWT unique et imposé. Pour des besoins avancés
(JWK, RS256/EdDSA, rotation de clés), la bibliothèque recommandée est `jose`.

## 4. Base de données : TypeORM + PostgreSQL (`@go-/database`, à venir)

Étudiés : TypeORM et Prisma ; un seul sera utilisé.
- **Retenu : TypeORM** — intégration native NestJS (`@nestjs/typeorm`), repositories et transactions explicites
  (`DataSource.transaction`), migrations versionnées en TypeScript, pas de binaire de moteur à déployer.
- Les entités ne sortent jamais du backend : les handlers renvoient des DTO validés par le contrat
  (voir `toUserDto` dans `apps/playground`).

## 5. Tests : `node:test`

Exécuteur intégré à Node.js : aucune dépendance, rapide, compatible CI. Les tests sont compilés avec le reste
du code (`src/__tests__`) et exclus des archives npm.

## 6. Langages

TypeScript / JavaScript, HTML5, CSS3, JSX / TSX, SQL (migrations), GLSL (shaders WebGL des applications 3D).
Aucune technologie Java/JVM : vérifié par `go- doctor`.
