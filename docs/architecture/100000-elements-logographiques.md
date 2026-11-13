# Architecture logographique — 100 000 éléments

> Catalogue global de 100 000 fonctions et axes du moteur graphique statique SpacereaNode. Il ne s'agit pas de 100 000 caractères Unicode distincts : les 15 glyphes canoniques désignent les familles sémantiques ; chaque entrée possède un identifiant ASCII et un nom de fonction JavaScript.

## Hiérarchie de puissance

| Niveau | Nombre | Nature | Rôle |
|---|---:|---|---|
| L1 | 60 000 | Petites fonctions | Opérations atomiques : valider, convertir, échantillonner, projeter, mesurer, filtrer |
| L2 | 19 995 | Grandes fonctions | Enchaînements réutilisables de fonctions L1 |
| L3 | 15 000 | Petits axes | Capacités spécialisées composant un sous-moteur |
| L4 | 5 005 | Grands axes | Sous-moteurs graphiques et scientifiques complets |
| **Total** | **100 000** | | |

## Règles

- IDs stables LG-000001 à LG-100000.
- Noms ASCII en camelCase, compatibles JavaScript.
- Registre fermé aux 15 glyphes : ☉ ☾ ◎ ⌖ 地 点 ▦ ⇄ ∿ ◈ ⧉ ⇣ ⚙ ◉ ⏱.
- Cible : navigateur, ressources statiques, prétraitement hors ligne et exécution CPU/GPU facultative ; aucun backend obligatoire pour le cœur.
- L1 réalise une opération atomique ; L2 orchestre des L1 ; L3 regroupe des L1/L2 ; L4 coordonne plusieurs L3. Les dépendances doivent rester acycliques.
- Avant implémentation, chaque fonction reçoit un contrat d'entrée/sortie, unités, repères, invariants, erreurs, dépendances, tests et critères de performance.
- Toutes les entrées sont au statut « À spécifier / implémenter ». Une fonction n'est déclarée existante qu'avec code, test automatisé et contrat documenté.
- Les noms générés sont un inventaire initial de conception ; les doublons sémantiques doivent être revus avant exposition publique.

## Répartition par famille

| Famille | Glyphe | Entrées |
|---|---|---:|
| Corps solaires et systèmes planétaires | ☉ | 6667 |
| Corps lunaires et cartographie sélénographique | ☾ | 6667 |
| Géométrie sphérique et ellipsoïdale | ◎ | 6667 |
| Coordonnées, référentiels et navigation spatiale | ⌖ | 6667 |
| Terrain, relief et surfaces planétaires | 地 | 6667 |
| Nuages de points, LiDAR et photogrammétrie | 点 | 6667 |
| Tuiles, atlas, pyramides et diffusion statique | ▦ | 6667 |
| Transformations géométriques et cinématiques | ⇄ | 6667 |
| Ondes, signaux, champs et phénomènes périodiques | ∿ | 6667 |
| Shaders, matériaux et pipelines GPU | ◈ | 6667 |
| Cache statique, ressources et mémoire | ⧉ | 6666 |
| Compression, quantification et formats scientifiques | ⇣ | 6666 |
| Calcul scientifique et algorithmes numériques | ⚙ | 6666 |
| Rendu 2D/3D, caméras et visibilité | ◉ | 6666 |
| Performance, budgets et qualité du rendu | ⏱ | 6666 |

## Catalogues détaillés

1. [Corps solaires et systèmes planétaires — ☉](../logographic-catalog/01-solar-body.md)
2. [Corps lunaires et cartographie sélénographique — ☾](../logographic-catalog/02-lunar-body.md)
3. [Géométrie sphérique et ellipsoïdale — ◎](../logographic-catalog/03-spherical-geometry.md)
4. [Coordonnées, référentiels et navigation spatiale — ⌖](../logographic-catalog/04-coordinates.md)
5. [Terrain, relief et surfaces planétaires — 地](../logographic-catalog/05-terrain.md)
6. [Nuages de points, LiDAR et photogrammétrie — 点](../logographic-catalog/06-point-cloud.md)
7. [Tuiles, atlas, pyramides et diffusion statique — ▦](../logographic-catalog/07-tiles.md)
8. [Transformations géométriques et cinématiques — ⇄](../logographic-catalog/08-transforms.md)
9. [Ondes, signaux, champs et phénomènes périodiques — ∿](../logographic-catalog/09-waves.md)
10. [Shaders, matériaux et pipelines GPU — ◈](../logographic-catalog/10-shaders.md)
11. [Cache statique, ressources et mémoire — ⧉](../logographic-catalog/11-cache.md)
12. [Compression, quantification et formats scientifiques — ⇣](../logographic-catalog/12-compression.md)
13. [Calcul scientifique et algorithmes numériques — ⚙](../logographic-catalog/13-compute.md)
14. [Rendu 2D/3D, caméras et visibilité — ◉](../logographic-catalog/14-render.md)
15. [Performance, budgets et qualité du rendu — ⏱](../logographic-catalog/15-performance.md)

## Comptage du catalogue

- L1 : 60000
- L2 : 19995
- L3 : 15000
- L4 : 5005
- Total : 100000
