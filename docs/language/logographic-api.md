# API logographique — axiomes établis

Ce document n'ajoute aucun signe. Il formalise l'utilisation des signes déjà présents dans le registre central.

| Signe | Identifiant canonique | Domaine |
|---|---|---|
| ☉ | SOLAR_BODY | Astronomie |
| ☾ | LUNAR_BODY | Astronomie |
| ◎ | SPHERICAL_BODY | Géométrie |
| ⌖ | COORDINATE | Géospatial |
| 地 | TERRAIN | Géospatial |
| 点 | POINT_CLOUD | LiDAR |
| ▦ | TILE | Tuilage |
| ⇄ | TRANSFORM | Calcul |
| ∿ | WAVE | Science |
| ◈ | SHADER | Rendu |
| ⧉ | CACHE | Stockage |
| ⇣ | COMPRESS | Compression |
| ⚙ | COMPUTE | Calcul |
| ◉ | RENDER | Rendu |
| ⏱ | PERFORMANCE | Performance |

## Exemples

```js
import { geo } from "@spacereanode/geo";
import { compute } from "@spacereanode/compute";
import { staticAPI } from "@spacereanode/static";
import { tiles } from "@spacereanode/tiles";
import { lidar } from "@spacereanode/lidar";

const coordinate = geo["⌖"]({ latitude: 48.85, longitude: 2.35 });
const tile = tiles["▦"](coordinate, 10);
const cache = staticAPI["⧉"]({ maxEntries: 128 });
const summary = lidar["点"]([{ x: 1, y: 2, z: 3 }]);
const matrix = compute["⇄"];
cache.set("tile", tile);
```

Les fonctions canoniques ASCII sont également exportées par chaque paquet pour faciliter le typage, les outils d'analyse statique, les environnements sans police adaptée et les chaînes de compilation.

## Règles

- N'utiliser que les signes de la table ci-dessus.
- Ne jamais attribuer un nouveau sens à un signe dans un module isolé.
- Toute extension du vocabulaire doit être ajoutée au registre central avant son utilisation.
- Les signes servent de clés d'API ; ils ne sont pas des opérateurs JavaScript natifs.
- Les noms ASCII restent les identifiants techniques stables.
