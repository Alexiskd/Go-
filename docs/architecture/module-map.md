# SpacereaNode — cartographie des modules

Cette cartographie reprend exclusivement le vocabulaire logographique déjà établi. Aucun nouveau glyphe n'est introduit.

| Signe | Module | Responsabilité |
|---|---|---|
| ☉ | planetary | Corps solaire et données astronomiques |
| ☾ | planetary | Corps lunaire et données astronomiques |
| ◎ | geo | Géométrie sphérique et conversions |
| ⌖ | geo | Coordonnées géographiques |
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

## Modules de données

- `packages/han` : parseurs de propriétés Unihan et de décompositions CJKVI IDS.
- `packages/han/sources.json` : sources, branches, rôles, formats et conditions de licence.

Le paquet Han expose des fonctions de parsing nommées et ne réaffecte aucun signe existant à un concept qui n'est pas défini par le registre.

## Contrat

Les signes sont des clés de chaîne JavaScript, pas des opérateurs natifs. Les identifiants machine restent ASCII. Les données Unicode sources doivent être conservées sans normalisation silencieuse ; la provenance et la licence accompagnent chaque import.
