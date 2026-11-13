# SpacereaNode

**Moteur JavaScript statique en priorité pour le calcul scientifique 3D, le rendu planétaire, les données géospatiales et le LiDAR.**

SpacereaNode est un runtime navigateur indépendant. React ou JavaScript natif peuvent construire l'interface ; SpacereaNode fournit les primitives de données, d'espace, de calcul et de rendu.

## Principes fondamentaux

- Livraison statique en priorité et ressources immuables.
- Calcul dans le navigateur ; workers et accélération GPU comme couches d'exécution.
- Prétraitement hors ligne des conversions, indexations et compressions coûteuses.
- Rendu progressif par élimination, niveaux de détail et diffusion priorisée.
- Traçabilité scientifique des sources, licences, systèmes de coordonnées, unités, époques et incertitudes.
- Modules indépendants des frameworks avec solutions de repli.

## Langage logographique

Le vocabulaire fermé du moteur est l'interface conceptuelle de ses opérations. Chaque signe correspond à une fonction précise. Les API publiques utilisent les signes comme clés de chaîne JavaScript : `api["点"](...)`. Les noms de fichiers, fonctions internes, variables et paquets npm restent ASCII pour garantir la compatibilité des outils.

| Signe | Identifiant interne | Fonction |
|---|---|---|
| ☉ | SOLAR_BODY | Corps solaire |
| ☾ | LUNAR_BODY | Corps lunaire |
| ◎ | SPHERICAL_BODY | Géométrie sphérique |
| ⌖ | COORDINATE | Coordonnées |
| 地 | TERRAIN | Terrain |
| 点 | POINT_CLOUD | Nuage de points |
| ▦ | TILE | Tuile spatiale |
| ⇄ | TRANSFORM | Transformation |
| ∿ | WAVE | Onde ou signal |
| ◈ | SHADER | Programme shader |
| ⧉ | CACHE | Cache |
| ⇣ | COMPRESS | Compression ou quantification |
| ⚙ | COMPUTE | Calcul |
| ◉ | RENDER | Rendu |
| ⏱ | PERFORMANCE | Mesure de performance |

Aucun nouveau signe ne peut être utilisé avant son ajout explicite au registre central et sa définition sémantique. Les alias de langue facilitent la recherche, mais ne modifient pas le sens canonique.

La spécification du langage et de la sémantique du runtime se trouve dans [docs/language/runtime-semantics.md](docs/language/runtime-semantics.md).

Le programme de formalisation des **200 axes fonctionnels** est décrit dans [docs/architecture/200-axes-logographiques.md](docs/architecture/200-axes-logographiques.md).

## Organisation du dépôt

```text
packages/
  core/       runtime et registre logographique
  geo/        validation et conversions de coordonnées
  compute/    matrices 4×4 et transformations de points
  static/     cache LRU borné
  tiles/      adresses et bornes de tuiles Web Mercator
  lidar/      inspection de nuages de points et quantification Int32
  han/        parseurs de métadonnées Unihan et IDS CJKVI
  react/      contexte React et hooks d'accès au runtime
docs/
  architecture/
  data/
  language/
  roadmap/
```

## État fonctionnel actuel

Les modules réellement présents fournissent les opérations suivantes :

- **⌖ / ◎ / ⇄ — géométrie** : validation de coordonnées, normalisation de longitude et conversions sphériques/cartésiennes.
- **⚙ / ⇄ — calcul** : matrice identité, multiplication matricielle 4×4 et transformation de points.
- **点 / ⇣ — LiDAR** : inspection des bornes d'un tableau de points décodés et quantification Int32.
- **▦ / ⌖ — tuiles** : adresse et bornes de tuiles Web Mercator.
- **⧉ — cache** : cache LRU à capacité bornée.
- **React** : provider de runtime et hooks d'intégration.
- **Han** : parseurs de propriétés Unihan et de décompositions IDS CJKVI, avec sources et révisions documentées.

Les signes ☉, ☾, 地, ∿, ◈, ◉ et ⏱ sont définis dans le vocabulaire, mais ne constituent pas à eux seuls la preuve que des moteurs complets d'éphémérides, de terrain, de simulation d'ondes, de shaders, de rendu ou de profilage sont déjà disponibles.

### Limites scientifiques et formats

Le module LiDAR accepte actuellement des tableaux de points déjà décodés. Il ne lit pas directement les fichiers LAS, LAZ ou COPC. La quantification est une primitive préparatoire, pas un codec complet. Les conversions géographiques actuelles utilisent une sphère configurable et ne constituent pas une géodésie ellipsoïdale complète. Le tuilage utilise Web Mercator.

## Développement

Node.js 20.19 ou supérieur.

```bash
npm test
```

Les scripts Vite sont déclarés dans le workspace ; une application de démonstration avec son point d'entrée devra être ajoutée avant de considérer `dev`, `build` et `preview` comme des commandes d'application prêtes à l'emploi.

## Licence

MIT, sous réserve des licences distinctes des jeux de données, codecs et dépendances tierces.
