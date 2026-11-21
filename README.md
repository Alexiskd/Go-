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

## Stacks pour les images par seconde et la gestion des moteurs

Dépôts importés pour optimiser le rendu 3D de Gobai et la gestion de ses moteurs. Aucun n'est encore utilisé par GobaiWebService.

| Usage | Dépôt officiel | Apport | Emplacement |
|---|---|---|---|
| FPS | `gkjohnson/three-mesh-bvh` | Clics et survols sur les astres et tuiles sans parcourir toute la géométrie | `stacks/threejs/three-mesh-bvh` |
| FPS | `protectwise/troika` | `troika-three-text` : noms des astres et des rues dessinés par le GPU | `stacks/threejs/troika` |
| FPS | `RenaudRohlinger/stats-gl` | Mesure en direct des images par seconde, du temps CPU et GPU | `stacks/threejs/stats-gl` |
| FPS | `pmndrs/detect-gpu` | Qualité réglée d'après la puce de l'appareil | `stacks/gpu/detect-gpu` |
| FPS | `BabylonJS/Spector.js` | Inspection de chaque appel de dessin WebGL | `stacks/gpu/Spector.js` |
| FPS | `zeux/meshoptimizer` | Maillages allégés et simplifiés (relief, modèles 3D) | `stacks/assets/meshoptimizer` |
| FPS | `BinomialLLC/basis_universal` | Textures KTX2 compressées sur le GPU | `stacks/assets/basis_universal` |
| FPS | `donmccurdy/glTF-Transform` | Compression des fichiers `.glb` avant mise en ligne | `stacks/assets/glTF-Transform` |
| Moteurs | `NateTheGreatt/bitECS` | Astres, tuiles et nuages de points gérés en tableaux de données | `stacks/ecs/bitECS` |
| Moteurs | `hmans/miniplex` | ECS plus simple que bitECS | `stacks/ecs/miniplex` |
| Moteurs | `GoogleChromeLabs/comlink` | Calculs des moteurs déplacés dans des Workers | `stacks/engine/comlink` |
| Moteurs | `sindresorhus/p-queue` | File de chargement des tuiles avec priorités et limite de requêtes | `stacks/engine/p-queue` |
| Moteurs | `developit/mitt` | Bus d'événements entre les moteurs et l'interface | `stacks/engine/mitt` |
| Moteurs | `pmndrs/zustand` | État partagé entre le moteur et le HUD | `stacks/react/zustand` |

## Stack maison : @go-/harmonie-3d

`stacks/go-/harmonie-3d` n'est pas un submodule : c'est une stack écrite pour GO-. Elle calcule une disposition harmonieuse d'une arborescence en 3D (couronnes proportionnelles à la taille des sous-arbres, collerettes de fichiers, angle d'or), donne à chaque branche d'un projet un score de désirabilité de 0 à 100, et sert au plugin `go-tree-3d` pour afficher les projets. Sans dépendance ; tests : `cd stacks/go-/harmonie-3d && node --test`.

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
├── react/    react · vite · zustand
├── nextjs/   next.js (examples/)
├── threejs/  three.js (examples/) · three-mesh-bvh · troika · stats-gl
├── gpu/      detect-gpu · Spector.js
├── assets/   meshoptimizer · basis_universal · glTF-Transform
├── ecs/      bitECS · miniplex
├── engine/   comlink · p-queue · mitt
└── go-/      harmonie-3d (stack maison, pas un submodule)
```

## Récupérer le code

```bash
git clone --recurse-submodules --shallow-submodules https://github.com/Alexiskd/Go-
# ou, une seule stack :
git submodule update --init --depth 1 stacks/nestjs/typescript-starter
```

Mettre à jour vers les derniers commits : `git submodule update --remote --depth 1`
