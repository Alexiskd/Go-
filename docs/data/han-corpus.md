# Corpus Han — Unihan et IDS

Ce module ajoute deux sources complémentaires au référentiel de données de SpacereaNode. Les signes employés pour l'API restent limités aux axiomes du registre central.

## Unihan

Source de revue : `unicode-org/unihan-database`.

Ce dépôt Unicode contient des fichiers de propriétés provisoires en cours de revue, notamment les lectures, définitions et variantes. Son format de revue comporte trois champs séparés par tabulations ; le premier champ associe le code point et, pour faciliter la revue, le caractère lui-même.

Cette source de revue ne doit pas être confondue avec la distribution complète et publiée d'Unihan. Pour les données officielles de version, utiliser l'archive publiée par Unicode et la spécification UAX #38. Les noms de propriétés commencent historiquement par `k`. Les fichiers et leur organisation peuvent évoluer entre versions ; le traitement ne doit pas supposer qu'une propriété reste dans un fichier donné.

## CJKVI IDS

Source : `cjkvi/cjkvi-ids`.

Le dépôt fournit des séquences de description idéographique pour les idéogrammes CJK. Les enregistrements comprennent le code point, le caractère et une ou plusieurs décompositions. Les décompositions doivent être conservées telles quelles : elles peuvent comporter plusieurs variantes, annotations de forme, caractères de substitution ou références de caractères privés.

Ne pas interpréter chaque composant d'une IDS comme un caractère Han ordinaire. Les opérateurs IDS sont des caractères Unicode dédiés ; les parseurs les identifient par leur plage de code points, sans les transformer ni les normaliser.

## Modèle d'intégration

- Conserver le code point comme entier Unicode.
- Conserver le caractère source exact.
- Conserver le nom de propriété Unihan et sa valeur brute.
- Conserver toutes les décompositions IDS d'un enregistrement.
- Garder l'identité du dépôt, de la branche, du fichier et de la version importée.
- Ne pas fusionner les données de revue Unihan avec une version officielle sans provenance.
- Ne pas déduire une décomposition manquante.
- Préserver les valeurs non décodées, annotations et références PUA.

## Licences et redistribution

Les sources ont des régimes différents. Le dépôt Unicode est régi par les conditions d'utilisation Unicode et son fichier de licence. Le dépôt CJKVI indique que la plupart de ses données sont sous GPLv2, que `ids.txt` suit les conditions du projet CHISE, et que `ids-ext-cdef.txt` fait l'objet d'une exception distincte.

SpacereaNode ne copie donc pas ces corpus dans son dépôt applicatif à ce stade. Les manifestes référencent les sources et leurs conditions. Toute mise en cache, redistribution ou intégration de données doit conserver les notices et respecter la licence de chaque fichier.

## Implémentation

`packages/han/src/parsers.js` fournit des parseurs de lignes pour les formats de revue Unihan et CJKVI IDS. Il ne télécharge pas les sources, ne synchronise pas automatiquement les versions et ne valide pas l'intégralité de la grammaire IDS. Les données brutes et les métadonnées de provenance doivent être conservées par la future chaîne d'ingestion.
