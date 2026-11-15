# Performances

Banc de mesure : `npm run build && npm run bench` (`tools/scripts/bench.mjs`).
Mesures du 15 novembre 2026, Node.js 22, 2 cœurs, 32 connexions keep-alive, même machine.

| Mesure | Avant | Après | Gain |
|---|---|---|---|
| Validation d'une liste de 200 objets | 3 873 op/s | 10 958 op/s | ×2,8 |
| Validation invalide (200 erreurs) | 3 301 op/s | 7 592 op/s | ×2,3 |
| HTTP `GET /health` (41e route du contrat) | 18 525 req/s | 23 683 req/s | +28 % |
| HTTP liste de 200 objets (client acceptant br) | 1 430 req/s | 2 518 req/s | +76 % |
| Taille de cette réponse | 31 983 o | 1 057 o (brotli) | −97 % |

Les gains de débit HTTP varient d'une exécution à l'autre ; le taux de compression dépend des données
(très répétitives dans ce banc, plutôt −70 à −85 % sur des données réelles).

## Ce qui a été optimisé

- **Schémas** : chemins d'erreur construits seulement en cas d'erreur (aucune allocation sur une validation réussie),
  champs des objets précalculés, valeurs par défaut primitives non clonées.
- **Serveur HTTP** : routes fixes trouvées en accès direct (plus de parcours de toutes les expressions régulières),
  compression brotli (qualité 4) ou gzip au-delà de 1 Ko, ETag faible et `304 Not Modified`, `Cache-Control`
  déclaré par endpoint, keep-alive de 65 s (supérieur aux 60 s des répartiteurs de charge, évite des 502).
- **Logger** : les loggers enfants (un par requête) partagent sortie, niveau et liste de masquage.
- **Client** : les GET identiques simultanés partagent une requête réseau.

## Bonnes pratiques pour les applications

- Déclarer `cacheControl` sur les endpoints publics peu changeants (listes, référentiels).
- Paginer les listes (`PaginationQuery`) plutôt que de renvoyer des milliers d'éléments.
- Désactiver `compression` uniquement si un proxy devant l'application compresse déjà.
- `LOG_LEVEL=info` (ou `warn`) en production : les journaux `debug` ne sont alors pas construits.
