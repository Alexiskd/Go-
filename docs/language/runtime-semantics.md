# SpacereaNode — sémantique logographique du runtime

## 1. Principe

Le vocabulaire logographique est l'interface conceptuelle du moteur. Chaque signe désigne une opération ou une famille de données précise. Les fonctions JavaScript internes conservent des noms ASCII afin de rester compatibles avec ECMAScript, npm, les outils de compilation, les systèmes de fichiers et les environnements qui ne traitent pas uniformément les identifiants Unicode.

La traduction est donc fonctionnelle : l'appelant manipule les signes comme clés d'API, tandis que le runtime relie chaque signe à une fonction déterministe. Il ne s'agit pas d'une traduction automatique des mots en caractères décoratifs.

## 2. Vocabulaire canonique fermé

| Signe | Identifiant interne | Domaine | Sens opérationnel |
|---|---|---|---|
| ☉ | SOLAR_BODY | astronomie | Corps solaire et objet astronomique associé |
| ☾ | LUNAR_BODY | astronomie | Corps lunaire et objet astronomique associé |
| ◎ | SPHERICAL_BODY | géométrie | Corps ou modèle géométrique sphérique |
| ⌖ | COORDINATE | géospatial | Position exprimée dans un système de coordonnées |
| 地 | TERRAIN | géospatial | Surface, terrain et élévation |
| 点 | POINT_CLOUD | LiDAR | Ensemble de points spatiaux |
| ▦ | TILE | spatial | Cellule d'un découpage spatial |
| ⇄ | TRANSFORM | calcul | Transformation entre repères ou espaces |
| ∿ | WAVE | science | Onde ou signal |
| ◈ | SHADER | rendu | Programme GPU de traitement visuel |
| ⧉ | CACHE | stockage | Réutilisation temporaire de données calculées ou chargées |
| ⇣ | COMPRESS | données | Réduction ou quantification de représentation |
| ⚙ | COMPUTE | calcul | Opération de calcul générale |
| ◉ | RENDER | rendu | Production d'une représentation visuelle |
| ⏱ | PERFORMANCE | mesure | Mesure de durée et de performance |

Aucun autre signe n'est implicite ou autorisé. Une nouvelle notion nécessite une décision explicite, une entrée au registre central, une définition sémantique, des tests et une mise à jour de cette table.

## 3. Contrat d'appel

Les signes sont des clés de chaîne. Ils ne sont pas des opérateurs JavaScript.

```js
import { geo } from "./packages/geo/src/index.js";
import { compute } from "./packages/compute/src/index.js";
import { lidar } from "./packages/lidar/src/index.js";
import { tiles } from "./packages/tiles/src/index.js";
import { staticAPI } from "./packages/static/src/index.js";

const valid = geo["⌖"]({ latitude: 48.85, longitude: 2.35 });
const transformed = compute["⇄"](matrix, point);
const bounds = lidar["点"](points);
const tile = tiles["▦"](coordinate, zoom);
const cache = staticAPI["⧉"]({ maxEntries: 128 });
```

La forme `api["signe"](...)` est le contrat public symbolique. Les noms ASCII exportés par les modules sont des interfaces de compatibilité et d'intégration, pas une seconde sémantique.

## 4. Correspondance entre signes et modules existants

### ⌖ / ◎ / ⇄ — géométrie géospatiale

Le module `geo` valide les coordonnées, normalise les longitudes et convertit les coordonnées en vecteurs cartésiens et inversement.

- `⌖` : validation d'une coordonnée.
- `⇄` : conversion d'une coordonnée vers une représentation cartésienne.
- `◎` : conversion cartésienne vers une coordonnée géographique.

La conversion sphérique utilise le rayon fourni ou sa valeur par défaut. Elle ne doit pas être présentée comme une géodésie ellipsoïdale de précision.

### ⚙ / ⇄ — calcul matriciel

Le module `compute` fournit la matrice identité, la multiplication de matrices 4×4 et la transformation d'un point.

- `⇄` : application d'une transformation à un point.
- `⚙` : multiplication matricielle.

### 点 / ⇣ — nuages de points

Le module `lidar` inspecte un tableau de points déjà décodés et calcule ses bornes. Il fournit aussi une quantification entière Int32.

- `点` : inspection du nuage et de ses bornes.
- `⇣` : quantification préparatoire.

La quantification n'est pas un encodeur LAS/LAZ/COPC et ne doit pas être décrite comme une compression de fichier complète. Le décodage des formats LiDAR n'est pas inclus dans cette fonction.

### ▦ / ⌖ — tuilage spatial

Le module `tiles` calcule l'adresse d'une tuile Web Mercator depuis une coordonnée et un niveau de zoom, et calcule les bornes d'une tuile.

- `▦` : coordonnée vers adresse de tuile.
- `⌖` : adresse de tuile vers bornes géographiques.

Le système actuel est Web Mercator ; il ne représente pas tous les systèmes de tuilage.

### ⧉ — cache statique

Le module `static` expose un cache LRU borné.

- `⧉` : création d'une instance de cache.

La politique LRU et la limite de capacité appartiennent à l'implémentation du cache, et non au signe lui-même.

### React — intégration de l'interface

Le package `react` fournit le contexte du runtime et des hooks d'accès. React reste une dépendance d'interface : il n'est pas renommé en signe, car aucun signe du registre ne signifie « framework UI ».

Les fonctions `SpacereaProvider`, `useSpacerea`, `useSpacereaModule`, `useLogographicAPI` et `useLogographs` restent des identifiants d'intégration ASCII. Les opérations scientifiques qu'elles exposent utilisent les clés logographiques correspondantes.

### Han — métadonnées et décomposition Unicode

Le package `han` lit des formats de données Unicode et IDS. Il conserve des noms de fonctions explicites car aucun signe du registre ne signifie « analyse de corpus Unicode » ou « décomposition de caractères ». Les données et leurs sources ne sont pas réinterprétées comme des opérations géospatiales.

## 5. Registre et résolution

Le registre central est l'autorité sémantique. Il associe à chaque signe un identifiant stable, un domaine, un libellé et des alias. `resolveLogograph(value)` permet de résoudre un signe ou un alias vers son entrée. `createLogographicAPI(handlers)` crée une façade immuable qui expose uniquement les handlers correspondant aux identifiants reconnus.

Un alias linguistique facilite la recherche et la documentation ; il ne crée pas un nouveau signe et ne change pas la signification canonique.

## 6. Règles de traduction du dépôt

1. Toute opération publique appartenant à un domaine déjà couvert doit être accessible par le signe correspondant.
2. Les modules internes peuvent garder des noms ASCII pour les fichiers, fonctions, variables et outils.
3. Les clés publiques sont des chaînes explicites : `api["点"]`, jamais des identifiants Unicode non vérifiés.
4. Aucun signe n'est attribué à une opération par simple proximité visuelle.
5. Les primitives sans signe adéquat restent nommées en ASCII et sont documentées comme telles.
6. Les dépendances tierces ne sont pas modifiées ; SpacereaNode fournit une façade lorsque le registre contient un signe sémantiquement exact.
7. Les tests vérifient la correspondance entre signe, fonction, résultat et erreurs.
8. Les formats de configuration obligatoires, les noms npm et les chemins de fichiers restent compatibles avec leurs spécifications.

## 7. Fonctionnalités non encore couvertes par le runtime

Le registre contient des concepts planifiés qui ne sont pas encore des moteurs complets. En particulier, ☉, ☾, 地, ∿, ◈, ◉ et ⏱ ne signifient pas que les modules d'éphémérides, de terrain, de simulation d'ondes, de shaders, de rendu ou de profilage sont déjà implémentés. Une entrée au vocabulaire définit un sens, pas une promesse de fonctionnalité.

## 8. Critère d'achèvement

La traduction fonctionnelle est complète lorsqu'une opération publique existante possède soit :

- une façade logographique sémantiquement exacte et testée ;
- soit une justification documentée expliquant pourquoi aucun signe existant ne peut la représenter.

Les fonctionnalités planifiées doivent être distinguées des fonctions réellement exportées et testées.
