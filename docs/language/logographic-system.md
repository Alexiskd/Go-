# SpacereaNode — système logographique et multigraphique

## Objectif

SpacereaNode propose une couche symbolique lisible par les humains au-dessus d'une API JavaScript stable. Les symboles désignent des concepts techniques : corps céleste, coordonnées, terrain, nuage de points, tuile, transformation, shader, compression, cache, calcul et rendu.

La couche est multigraphique : elle peut documenter plusieurs systèmes d'écriture historiques et contemporains. Elle ne prétend pas que ces écritures sont interchangeables ni qu'un symbole possède la même signification dans toutes les cultures.

## Pourquoi une API à clés symboliques

ECMAScript autorise les identifiants Unicode dans certaines catégories, mais tous les pictogrammes, symboles mathématiques et hiéroglyphes ne sont pas des identifiants valides. Pour garantir la compatibilité, SpacereaNode utilise des clés de chaîne :

```js
import { createLogographicAPI } from "@spacereanode/core/logographs";

const api = createLogographicAPI({
  POINT_CLOUD: data => loadPointCloud(data),
  SHADER: source => compileShader(source),
  COMPRESS: buffer => compressBuffer(buffer)
});

api["点"](dataset);
api["◈"](shaderSource);
api["⇣"](binaryData);
```

Une clé ASCII canonique reste disponible pour les outils, les logs, les tests, les IDE et les pipelines de compilation.

## Premier vocabulaire

| Symbole | Identifiant stable | Concept |
|---|---|---|
| ☉ | SOLAR_BODY | Corps solaire |
| ☾ | LUNAR_BODY | Corps lunaire |
| ◎ | SPHERICAL_BODY | Corps sphérique |
| ⌖ | COORDINATE | Coordonnée |
| 地 | TERRAIN | Terrain |
| 点 | POINT_CLOUD | Nuage de points |
| ▦ | TILE | Tuile |
| ⇄ | TRANSFORM | Transformation |
| ∿ | WAVE | Signal / onde |
| ◈ | SHADER | Shader |
| ⧉ | CACHE | Cache |
| ⇣ | COMPRESS | Compression |
| ⚙ | COMPUTE | Calcul |
| ◉ | RENDER | Rendu |
| ⏱ | PERFORMANCE | Performance |

## Écritures et langues historiques

La documentation peut inclure, avec translittération et traduction :
- hiéroglyphes égyptiens ;
- cunéiforme sumérien et akkadien ;
- caractères chinois classiques ;
- écritures logographiques et systèmes de notation historiques pertinents ;
- signes mathématiques, astronomiques et géométriques.

Chaque entrée doit préciser le système d'écriture, le code Unicode, le sens attesté, la translittération et la source de référence. Ne pas attribuer arbitrairement un sens ancien à un signe simplement parce que sa forme ressemble à une fonction moderne.

## Unicode et compatibilité

- Tous les fichiers texte sont encodés en UTF-8.
- Conserver la graphie source exacte.
- Ne pas translittérer ni normaliser silencieusement les chaînes utilisateur.
- Si une comparaison normalisée est nécessaire, choisir explicitement NFC ou NFKC selon le cas et conserver la valeur originale.
- Prévoir les polices de secours et les séquences de variation emoji.
- Les caractères non pris en charge par une police doivent rester accessibles via leur code point et leur translittération.
- Les identifiants machine canoniques restent ASCII afin d'assurer la portabilité.

## Règle de conception

Le symbole est une interface expressive, pas une instruction cachée. Toute opération doit disposer d'un identifiant stable, d'une documentation, d'un type d'entrée/sortie, d'une gestion d'erreur et de tests. Les symboles ne doivent jamais remplacer la traçabilité scientifique ou les unités explicites.
