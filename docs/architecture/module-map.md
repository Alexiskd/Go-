# SpacereaNode — cartographie des modules

Cette cartographie reprend exclusivement le vocabulaire logographique déjà établi. Aucun nouveau glyphe n'est introduit.

| Signe | Module | Responsabilité |
|---|---|---|
| ☉ | planetary | Corps solaire et données astronomiques |
| ☾ | planetary | Corps lunaire et données astronomiques |
| ◎ | geo | Géométrie sphérique et conversions |
| ⌖ | geo | Validation et représentation des coordonnées |
| 地 | geo | Terrain et données de surface |
| 点 | lidar | Inspection des nuages de points |
| ▦ | tiles | Découpage spatial en tuiles |
| ⇄ | compute | Transformations géométriques |
| ∿ | science | Signaux et grandeurs physiques |
| ◈ | renderer | Programmes de rendu |
| ⧉ | static | Cache local et ressources statiques |
| ⇣ | lidar | Quantification et préparation à la compression |
| ⚙ | compute | Calcul matriciel |
| ◉ | renderer | Production des images |
| ⏱ | performance | Mesure et optimisation |

## Organisation

- `packages/core` fournit le runtime et le registre des signes.
- `packages/geo` fournit les coordonnées et conversions sphériques.
- `packages/compute` fournit les opérations matricielles.
- `packages/static` fournit un cache LRU borné.
- `packages/tiles` fournit le tuilage géographique de type Web Mercator.
- `packages/lidar` fournit l'inspection de points et une quantification entière.

## Contrat des API logographiques

Les signes sont des clés de chaîne JavaScript. Ils ne remplacent pas les fonctions nommées ASCII : ils fournissent une façade symbolique déterministe. Les unités, systèmes de coordonnées, CRS, précision et provenance doivent rester explicitement décrits par les données appelantes.

## Limites actuelles

Le module LiDAR travaille sur des tableaux de points déjà décodés. Il ne lit pas encore les fichiers LAS, LAZ ou COPC. La quantification produit des entiers Int32 et annonce une erreur maximale théorique de demi-pas ; elle ne constitue pas à elle seule un codec de compression. Le module geo utilise une sphère de rayon configurable, pas un ellipsoïde géodésique complet. Le tuilage emploie la projection Web Mercator.
