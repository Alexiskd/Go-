# SpacereaNode — cartographie fonctionnelle logographique

Cette cartographie distingue les fonctions déjà présentes des domaines seulement définis dans le vocabulaire. Un signe décrit un concept ; il ne garantit pas à lui seul qu'un moteur complet existe.

## Fonctions implémentées

| Signe | Module | Opération exposée | État |
|---|---|---|---|
| ⌖ | `geo` | Validation de coordonnées | Implémenté |
| ⇄ | `geo` | Coordonnée vers vecteur cartésien | Implémenté |
| ◎ | `geo` | Vecteur cartésien vers coordonnée | Implémenté |
| ⚙ | `compute` | Multiplication de matrices 4×4 | Implémenté |
| ⇄ | `compute` | Transformation d'un point | Implémenté |
| 点 | `lidar` | Inspection d'un nuage de points décodé | Implémenté |
| ⇣ | `lidar` | Quantification Int32 | Implémenté |
| ▦ | `tiles` | Coordonnée vers tuile Web Mercator | Implémenté |
| ⌖ | `tiles` | Tuile vers bornes géographiques | Implémenté |
| ⧉ | `static` | Création d'un cache LRU borné | Implémenté |
| — | `react` | Provider et hooks d'accès au runtime | Implémenté |
| — | `han` | Parseurs Unihan et CJKVI IDS | Implémenté |

## Domaines définis, moteurs complets non attestés

| Signe | Domaine | Fonction attendue | État |
|---|---|---|---|
| ☉ | Astronomie | Corps solaire et données orbitales | À implémenter |
| ☾ | Astronomie | Corps lunaire et données orbitales | À implémenter |
| 地 | Géospatial | Terrain, maillage et élévation | À implémenter |
| ∿ | Science | Simulation et traitement d'ondes | À implémenter |
| ◈ | GPU | Bibliothèque de shaders | À implémenter |
| ◉ | Rendu | Pipeline de rendu complet | À implémenter |
| ⏱ | Performance | Instrumentation et profilage | À implémenter |

## API symbolique

Les signes sont des clés de chaîne et sont appelés entre crochets :

```js
geo["⌖"](...)
compute["⇄"](...)
lidar["点"](...)
tiles["▦"](...)
staticAPI["⧉"](...)
```

Les identifiants internes restent ASCII pour l'interopérabilité. Les signes ne doivent jamais être utilisés comme noms de fichiers, noms de paquets ou substituts de syntaxe JavaScript.

## Modules de données

Le module `han` conserve des identifiants explicites pour l'analyse des formats Unicode et IDS. Aucun signe actuel ne signifie « analyse de corpus » ; le module ne doit donc pas détourner un glyphe pour cette fonction.

## Contrat de précision

- Les conversions géographiques actuelles reposent sur une sphère configurable, pas sur un ellipsoïde géodésique complet.
- Le tuilage actuel utilise Web Mercator.
- Le module LiDAR attend des points déjà décodés ; il ne parse pas encore LAS, LAZ ou COPC.
- La quantification Int32 n'est pas un codec de compression de fichier.
- Les modules marqués « À implémenter » ne doivent pas être présentés comme disponibles.
