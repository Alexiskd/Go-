# Stack N3RA

> **N³ + React + Angular** : une stack 100 % TypeScript, du serveur à l'interface.

**N3RA** (prononcé « néra ») réunit cinq technologies de l'écosystème Node.js :
les trois **N** (**N**ode.js, **N**estJS, **N**ext.js), plus **R**eact et **A**ngular.

## Définition

| Couche | Technologie | Rôle dans N3RA | Dépôt officiel | Starter |
|---|---|---|---|---|
| Runtime | **N**ode.js | Exécute tout le code serveur | `stacks/nodejs/node` | `stacks/nodejs/hackathon-starter` |
| Backend / API | **N**estJS | API REST/GraphQL structurée (modules, DI, guards) | `stacks/nestjs/nest` | `stacks/nestjs/typescript-starter` |
| Fullstack / SSR | **N**ext.js | Site public, SEO, rendu serveur, routes API légères | `stacks/nextjs/next.js` | `stacks/nextjs/next.js/examples` |
| UI | **R**eact | Composants d'interface (moteur de Next.js, SPA via Vite) | `stacks/react/react` | `stacks/react/vite` (`npm create vite@latest`) |
| App d'entreprise | **A**ngular | Back-office, dashboards et applis métier complexes | `stacks/angular/angular` | `npx @angular/cli new mon-app` |

En complément de N3RA, la bibliothèque 3D **Three.js** (rendu WebGL/WebGPU dans le navigateur) est importée dans `stacks/threejs/three.js` ; ses exemples sont dans `stacks/threejs/three.js/examples`.

## Architecture type

```
             ┌──────────────────────┐   ┌──────────────────────┐
 Clients ──► │ Next.js + React      │   │ Angular              │
             │ (site public, SSR)   │   │ (back-office, admin) │
             └──────────┬───────────┘   └──────────┬───────────┘
                        │      HTTP / GraphQL      │
                        └────────────┬─────────────┘
                              ┌──────▼──────┐
                              │   NestJS    │  API, auth, logique métier
                              └──────┬──────┘
                              ┌──────▼──────┐
                              │   Node.js   │  runtime
                              └─────────────┘
```

## Principes

- **Un seul langage** : TypeScript partout ; les types (DTO) peuvent être partagés entre l'API et les fronts.
- **Chaque front a un rôle clair** : Next.js/React pour ce qui est public et doit être référencé, Angular pour les outils internes.
- **NestJS est la seule source de vérité** : les fronts ne parlent qu'à l'API.

## Organisation du dépôt

Les dépôts officiels sont importés en submodules git dans `stacks/`, épinglés sur un commit précis.

```
stacks/
├── nodejs/   node · hackathon-starter
├── nestjs/   nest · typescript-starter
├── angular/  angular
├── react/    react · vite
├── nextjs/   next.js (examples/)
└── threejs/  three.js (examples/)
```

## Récupérer le code

```bash
git clone --recurse-submodules --shallow-submodules https://github.com/Alexiskd/Go-
# ou, une seule stack :
git submodule update --init --depth 1 stacks/nestjs/typescript-starter
```

Mettre à jour vers les derniers commits : `git submodule update --remote --depth 1`
