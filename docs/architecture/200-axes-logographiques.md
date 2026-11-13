# 200 axes fonctionnels logographiques

> Spécification de cadrage pour SpacereaNode / dépôt GitHub `Alexiskd/Go-`. Ce document formalise 200 axes de conception. Il ne signifie pas que les 200 fonctions sont déjà codées.

## Règles de formalisation

- Le registre reste fermé aux 15 signes déjà établis : `☉ ☾ ◎ ⌖ 地 点 ▦ ⇄ ∿ ◈ ⧉ ⇣ ⚙ ◉ ⏱`.
- Un signe désigne un domaine sémantique, pas automatiquement chacune des fonctions listées.
- Les identifiants `AX-001` à `AX-200`, les noms de fichiers et les identifiants JavaScript restent ASCII.
- Un axe décrit une capacité vérifiable : entrées, sortie attendue, invariants, erreurs et tests devront être précisés avant implémentation.
- Les axes composés de plusieurs signes sont transversaux ; ils ne créent aucun nouveau signe.
- Les fonctions non présentes dans le code actuel sont des objectifs de spécification, jamais des capacités acquises.

## Statuts

- **Existant partiel** : une primitive apparentée existe, sans couvrir tout l'axe.
- **À spécifier / implémenter** : capacité proposée, non attestée dans le dépôt à la date de rédaction.
- **Transversal** : contrat ou infrastructure servant plusieurs domaines.

## Catalogue

### 01 · Corps solaires · ☉

Catalogue et représentation des corps du système solaire

- **AX-001 — Identité canonique du corps.** Statut : À spécifier / implémenter.
- **AX-002 — Hiérarchie étoile-planète-satellite.** Statut : À spécifier / implémenter.
- **AX-003 — Paramètres physiques versionnés.** Statut : À spécifier / implémenter.
- **AX-004 — Masse et paramètres gravitationnels.** Statut : À spécifier / implémenter.
- **AX-005 — Rayon moyen et rayons de référence.** Statut : À spécifier / implémenter.
- **AX-006 — Rotation et période sidérale.** Statut : À spécifier / implémenter.
- **AX-007 — Orientation de l'axe de rotation.** Statut : À spécifier / implémenter.
- **AX-008 — Système de référence du corps.** Statut : À spécifier / implémenter.
- **AX-009 — Métadonnées de découverte et de nomenclature.** Statut : À spécifier / implémenter.
- **AX-010 — Validation de cohérence des paramètres.** Statut : À spécifier / implémenter.

### 02 · Corps lunaires · ☾

Modélisation spécifique des lunes et de leurs relations

- **AX-011 — Identité canonique du satellite.** Statut : À spécifier / implémenter.
- **AX-012 — Corps parent et hiérarchie orbitale.** Statut : À spécifier / implémenter.
- **AX-013 — Forme et dimensions de référence.** Statut : À spécifier / implémenter.
- **AX-014 — Rotation synchrone ou non synchrone.** Statut : À spécifier / implémenter.
- **AX-015 — Libration physique et optique.** Statut : À spécifier / implémenter.
- **AX-016 — Repères sélénographiques.** Statut : À spécifier / implémenter.
- **AX-017 — Pôles et axes lunaires.** Statut : À spécifier / implémenter.
- **AX-018 — Relations d'éclairage avec le parent.** Statut : À spécifier / implémenter.
- **AX-019 — Métadonnées des missions d'observation.** Statut : À spécifier / implémenter.
- **AX-020 — Validation des modèles lunaires.** Statut : À spécifier / implémenter.

### 03 · Géométrie sphérique · ◎

Géométrie des surfaces et des corps approximés par une sphère

- **AX-021 — Définition du rayon de référence.** Statut : À spécifier / implémenter.
- **AX-022 — Conversion latitude-longitude-vecteur.** Statut : Existant partiel.
- **AX-023 — Distance angulaire sur grand cercle.** Statut : À spécifier / implémenter.
- **AX-024 — Calcul d'azimut et de site.** Statut : À spécifier / implémenter.
- **AX-025 — Interpolation sur sphère.** Statut : À spécifier / implémenter.
- **AX-026 — Projection et déprojection sphériques.** Statut : À spécifier / implémenter.
- **AX-027 — Calcul de cap et de relèvement.** Statut : À spécifier / implémenter.
- **AX-028 — Intersection de rayons et sphères.** Statut : À spécifier / implémenter.
- **AX-029 — Mesure d'aire de polygone sphérique.** Statut : À spécifier / implémenter.
- **AX-030 — Propagation des incertitudes angulaires.** Statut : À spécifier / implémenter.

### 04 · Coordonnées et repères · ⌖

Systèmes de coordonnées, référentiels et conversions

- **AX-031 — Validation de latitude et longitude.** Statut : Existant partiel.
- **AX-032 — Normalisation des longitudes.** Statut : Existant partiel.
- **AX-033 — Conversion degrés-radians.** Statut : À spécifier / implémenter.
- **AX-034 — Transformation entre repères locaux.** Statut : À spécifier / implémenter.
- **AX-035 — Transformation repère corps-inertiel.** Statut : À spécifier / implémenter.
- **AX-036 — Gestion des époques de référence.** Statut : À spécifier / implémenter.
- **AX-037 — Définition des unités et conventions d'axes.** Statut : À spécifier / implémenter.
- **AX-038 — Conversion géodésique-cartésienne.** Statut : À spécifier / implémenter.
- **AX-039 — Validation des domaines et valeurs non finies.** Statut : À spécifier / implémenter.
- **AX-040 — Traçabilité du référentiel utilisé.** Statut : À spécifier / implémenter.

### 05 · Terrain et relief · 地

Surfaces, modèles numériques de terrain et topographie

- **AX-041 — Chargement de modèles numériques de terrain.** Statut : À spécifier / implémenter.
- **AX-042 — Échantillonnage d'altitude.** Statut : À spécifier / implémenter.
- **AX-043 — Calcul de pente.** Statut : À spécifier / implémenter.
- **AX-044 — Calcul d'exposition.** Statut : À spécifier / implémenter.
- **AX-045 — Calcul de normales de surface.** Statut : À spécifier / implémenter.
- **AX-046 — Détection de ruptures de pente.** Statut : À spécifier / implémenter.
- **AX-047 — Génération de maillages de terrain.** Statut : À spécifier / implémenter.
- **AX-048 — Niveaux de détail topographiques.** Statut : À spécifier / implémenter.
- **AX-049 — Masques de validité et données manquantes.** Statut : À spécifier / implémenter.
- **AX-050 — Métadonnées de résolution et d'incertitude.** Statut : À spécifier / implémenter.

### 06 · Nuages de points · 点

Traitement spatial de points et données LiDAR

- **AX-051 — Validation du schéma XYZ.** Statut : À spécifier / implémenter.
- **AX-052 — Inspection des bornes spatiales.** Statut : Existant partiel.
- **AX-053 — Comptage et statistiques de points.** Statut : À spécifier / implémenter.
- **AX-054 — Filtrage par emprise spatiale.** Statut : À spécifier / implémenter.
- **AX-055 — Filtrage par classe et attribut.** Statut : À spécifier / implémenter.
- **AX-056 — Voxelisation et agrégation spatiale.** Statut : À spécifier / implémenter.
- **AX-057 — Quantification entière avec échelle et offset.** Statut : Existant partiel.
- **AX-058 — Indexation spatiale des points.** Statut : À spécifier / implémenter.
- **AX-059 — Décimation contrôlée par erreur.** Statut : À spécifier / implémenter.
- **AX-060 — Préparation des lots pour rendu progressif.** Statut : À spécifier / implémenter.

### 07 · Tuilage spatial · ▦

Découpage, adressage et diffusion de données spatiales

- **AX-061 — Adressage XYZ de tuiles.** Statut : Existant partiel.
- **AX-062 — Calcul des bornes géographiques d'une tuile.** Statut : Existant partiel.
- **AX-063 — Conversion niveau de zoom-colonne-ligne.** Statut : À spécifier / implémenter.
- **AX-064 — Découpage d'une emprise en tuiles.** Statut : À spécifier / implémenter.
- **AX-065 — Gestion des limites et débordements.** Statut : À spécifier / implémenter.
- **AX-066 — Schéma de métadonnées de tuile.** Statut : À spécifier / implémenter.
- **AX-067 — Ordonnancement des tuiles visibles.** Statut : À spécifier / implémenter.
- **AX-068 — Préchargement des tuiles voisines.** Statut : À spécifier / implémenter.
- **AX-069 — Gestion des niveaux de détail.** Statut : À spécifier / implémenter.
- **AX-070 — Validation de cohérence des pyramides.** Statut : À spécifier / implémenter.

### 08 · Transformations · ⇄

Transformations géométriques et changements de repères

- **AX-071 — Matrice identité.** Statut : Existant partiel.
- **AX-072 — Multiplication de matrices homogènes.** Statut : Existant partiel.
- **AX-073 — Transformation de points 3D.** Statut : Existant partiel.
- **AX-074 — Transformation de directions et vecteurs.** Statut : À spécifier / implémenter.
- **AX-075 — Composition de transformations.** Statut : À spécifier / implémenter.
- **AX-076 — Inversion contrôlée de matrice.** Statut : À spécifier / implémenter.
- **AX-077 — Translation et rotation.** Statut : À spécifier / implémenter.
- **AX-078 — Mise à l'échelle et cisaillement.** Statut : À spécifier / implémenter.
- **AX-079 — Décomposition translation-rotation-échelle.** Statut : À spécifier / implémenter.
- **AX-080 — Validation des singularités et erreurs numériques.** Statut : À spécifier / implémenter.

### 09 · Ondes et signaux · ∿

Représentation et analyse de signaux physiques

- **AX-081 — Représentation temporelle d'un signal.** Statut : À spécifier / implémenter.
- **AX-082 — Échantillonnage et fréquence.** Statut : À spécifier / implémenter.
- **AX-083 — Interpolation temporelle.** Statut : À spécifier / implémenter.
- **AX-084 — Transformée de Fourier discrète.** Statut : À spécifier / implémenter.
- **AX-085 — Analyse spectrale.** Statut : À spécifier / implémenter.
- **AX-086 — Filtrage passe-bas et passe-haut.** Statut : À spécifier / implémenter.
- **AX-087 — Détection de pics et événements.** Statut : À spécifier / implémenter.
- **AX-088 — Mesure d'amplitude et phase.** Statut : À spécifier / implémenter.
- **AX-089 — Propagation d'une onde dans un milieu défini.** Statut : À spécifier / implémenter.
- **AX-090 — Journalisation des unités et hypothèses physiques.** Statut : À spécifier / implémenter.

### 10 · Programmes shaders · ◈

Contrats de shaders et préparation des ressources GPU

- **AX-091 — Contrat d'entrée vertex.** Statut : À spécifier / implémenter.
- **AX-092 — Contrat de sortie fragment.** Statut : À spécifier / implémenter.
- **AX-093 — Gestion des uniforms typés.** Statut : À spécifier / implémenter.
- **AX-094 — Gestion des attributs et buffers.** Statut : À spécifier / implémenter.
- **AX-095 — Bibliothèque de fonctions shader réutilisables.** Statut : À spécifier / implémenter.
- **AX-096 — Validation de compatibilité WebGL-WebGPU.** Statut : À spécifier / implémenter.
- **AX-097 — Précompilation et cache de programmes.** Statut : À spécifier / implémenter.
- **AX-098 — Gestion des variantes de shader.** Statut : À spécifier / implémenter.
- **AX-099 — Diagnostic des erreurs de compilation.** Statut : À spécifier / implémenter.
- **AX-100 — Repli lorsque l'accélération GPU est indisponible.** Statut : À spécifier / implémenter.

### 11 · Cache et ressources · ⧉

Mise en cache déterministe et cycle de vie des ressources

- **AX-101 — Cache LRU à capacité bornée.** Statut : Existant partiel.
- **AX-102 — Clés de cache canoniques.** Statut : À spécifier / implémenter.
- **AX-103 — Politique d'expiration temporelle.** Statut : À spécifier / implémenter.
- **AX-104 — Invalidation par version de ressource.** Statut : À spécifier / implémenter.
- **AX-105 — Déduplication des requêtes identiques.** Statut : À spécifier / implémenter.
- **AX-106 — Cache mémoire et quotas.** Statut : À spécifier / implémenter.
- **AX-107 — Cache persistant optionnel.** Statut : À spécifier / implémenter.
- **AX-108 — Mesure des taux de succès et d'échec.** Statut : À spécifier / implémenter.
- **AX-109 — Éviction selon coût de reconstruction.** Statut : À spécifier / implémenter.
- **AX-110 — Libération explicite des ressources.** Statut : À spécifier / implémenter.

### 12 · Compression et encodage · ⇣

Réduction de volume, quantification et sérialisation

- **AX-111 — Quantification XYZ avec précision déclarée.** Statut : À spécifier / implémenter.
- **AX-112 — Choix d'échelle et d'offset.** Statut : À spécifier / implémenter.
- **AX-113 — Encodage delta de séquences.** Statut : À spécifier / implémenter.
- **AX-114 — Compression de blocs indépendants.** Statut : À spécifier / implémenter.
- **AX-115 — Sérialisation binaire versionnée.** Statut : À spécifier / implémenter.
- **AX-116 — Contrôle d'intégrité des blocs.** Statut : À spécifier / implémenter.
- **AX-117 — Décompression en flux.** Statut : À spécifier / implémenter.
- **AX-118 — Mesure du ratio de compression.** Statut : À spécifier / implémenter.
- **AX-119 — Budget d'erreur après quantification.** Statut : À spécifier / implémenter.
- **AX-120 — Détection des formats et versions pris en charge.** Statut : À spécifier / implémenter.

### 13 · Calcul scientifique · ⚙

Primitives numériques et calculs déterministes

- **AX-121 — Opérations vectorielles 3D.** Statut : À spécifier / implémenter.
- **AX-122 — Produit scalaire et produit vectoriel.** Statut : À spécifier / implémenter.
- **AX-123 — Normes et normalisation vectorielle.** Statut : À spécifier / implémenter.
- **AX-124 — Matrices 3×3 et 4×4.** Statut : À spécifier / implémenter.
- **AX-125 — Résolution de systèmes linéaires.** Statut : À spécifier / implémenter.
- **AX-126 — Interpolation scalaire et vectorielle.** Statut : À spécifier / implémenter.
- **AX-127 — Calculs en précision simple ou double.** Statut : À spécifier / implémenter.
- **AX-128 — Propagation des erreurs numériques.** Statut : À spécifier / implémenter.
- **AX-129 — Gestion des valeurs NaN et infinies.** Statut : À spécifier / implémenter.
- **AX-130 — Tests de reproductibilité numérique.** Statut : À spécifier / implémenter.

### 14 · Rendu visuel · ◉

Pipeline de rendu, visibilité et présentation

- **AX-131 — Initialisation du contexte de rendu.** Statut : À spécifier / implémenter.
- **AX-132 — Gestion de la caméra et du frustum.** Statut : À spécifier / implémenter.
- **AX-133 — Tri des objets par visibilité.** Statut : À spécifier / implémenter.
- **AX-134 — Élimination des objets hors champ.** Statut : À spécifier / implémenter.
- **AX-135 — Gestion des matériaux et textures.** Statut : À spécifier / implémenter.
- **AX-136 — Rendu multi-passe.** Statut : À spécifier / implémenter.
- **AX-137 — Gestion de la transparence.** Statut : À spécifier / implémenter.
- **AX-138 — Résolution et densité de pixels.** Statut : À spécifier / implémenter.
- **AX-139 — Rendu progressif et dégradation contrôlée.** Statut : À spécifier / implémenter.
- **AX-140 — Libération et restauration du contexte graphique.** Statut : À spécifier / implémenter.

### 15 · Performance · ⏱

Mesure, budgets et optimisation du temps d'exécution

- **AX-141 — Mesure de durée par étape.** Statut : À spécifier / implémenter.
- **AX-142 — Comptage des appels et opérations.** Statut : À spécifier / implémenter.
- **AX-143 — Mesure des temps CPU.** Statut : À spécifier / implémenter.
- **AX-144 — Mesure des temps GPU disponibles.** Statut : À spécifier / implémenter.
- **AX-145 — Suivi de la cadence d'image.** Statut : À spécifier / implémenter.
- **AX-146 — Budgets de mémoire par module.** Statut : À spécifier / implémenter.
- **AX-147 — Détection des régressions de performance.** Statut : À spécifier / implémenter.
- **AX-148 — Profilage des transferts et décodages.** Statut : À spécifier / implémenter.
- **AX-149 — Échantillonnage des métriques sans surcharge.** Statut : À spécifier / implémenter.
- **AX-150 — Rapports comparables entre environnements.** Statut : À spécifier / implémenter.

### 16 · Éphémérides et mécanique orbitale · ☉ / ◎

Calculs orbitaux à spécifier au-dessus des primitives de corps et de géométrie

- **AX-151 — Éléments képlériens osculateurs.** Statut : À spécifier / implémenter.
- **AX-152 — Résolution de l'équation de Kepler.** Statut : À spécifier / implémenter.
- **AX-153 — Propagation képlérienne à deux corps.** Statut : À spécifier / implémenter.
- **AX-154 — Éphémérides polynomiales tabulées.** Statut : À spécifier / implémenter.
- **AX-155 — Interpolation d'états position-vitesse.** Statut : À spécifier / implémenter.
- **AX-156 — Conversion entre anomalies orbitale et vraie.** Statut : À spécifier / implémenter.
- **AX-157 — Repères orbitaux perifocaux.** Statut : À spécifier / implémenter.
- **AX-158 — Perturbations gravitationnelles configurables.** Statut : À spécifier / implémenter.
- **AX-159 — Comparaison de modèles et résidus.** Statut : À spécifier / implémenter.
- **AX-160 — Provenance, époque et incertitude des états.** Statut : À spécifier / implémenter.

### 17 · Temps et calendriers · ⏱ / ⌖

Temps physiques, échelles temporelles et alignement des données

- **AX-161 — Représentation d'époque uniforme.** Statut : À spécifier / implémenter.
- **AX-162 — Conversion UTC et TAI avec table de secondes intercalaires.** Statut : À spécifier / implémenter.
- **AX-163 — Conversion TT et TDB selon modèle déclaré.** Statut : À spécifier / implémenter.
- **AX-164 — Temps julien et date julienne modifiée.** Statut : À spécifier / implémenter.
- **AX-165 — Gestion des époques de données.** Statut : À spécifier / implémenter.
- **AX-166 — Interpolation d'états à une époque cible.** Statut : À spécifier / implémenter.
- **AX-167 — Synchronisation des couches temporelles.** Statut : À spécifier / implémenter.
- **AX-168 — Détection des discontinuités temporelles.** Statut : À spécifier / implémenter.
- **AX-169 — Traçabilité de la table ou du modèle temporel.** Statut : À spécifier / implémenter.
- **AX-170 — Validation des conversions temporelles.** Statut : À spécifier / implémenter.

### 18 · Sources et provenance scientifique · ⌖ / ⧉

Traçabilité des jeux de données et reproductibilité

- **AX-171 — Identifiant stable de source.** Statut : À spécifier / implémenter.
- **AX-172 — URL et version de source.** Statut : À spécifier / implémenter.
- **AX-173 — Date d'acquisition et date de publication.** Statut : À spécifier / implémenter.
- **AX-174 — Licence et conditions de réutilisation.** Statut : À spécifier / implémenter.
- **AX-175 — Référentiel spatial déclaré.** Statut : À spécifier / implémenter.
- **AX-176 — Unités et conventions documentées.** Statut : À spécifier / implémenter.
- **AX-177 — Historique des transformations appliquées.** Statut : À spécifier / implémenter.
- **AX-178 — Empreinte de contenu et intégrité.** Statut : À spécifier / implémenter.
- **AX-179 — Niveau de qualité et incertitude.** Statut : À spécifier / implémenter.
- **AX-180 — Reproduction d'un résultat à partir de ses entrées.** Statut : À spécifier / implémenter.

### 19 · Exécution et parallélisme · ⚙ / ⏱

Orchestration du calcul sans imposer un framework d'interface

- **AX-181 — Découpage d'un travail en tâches.** Statut : Transversal.
- **AX-182 — Exécution via Web Workers.** Statut : Transversal.
- **AX-183 — Transfert de buffers sans copie lorsque possible.** Statut : Transversal.
- **AX-184 — Annulation et interruption coopérative.** Statut : Transversal.
- **AX-185 — Priorités et files de tâches.** Statut : Transversal.
- **AX-186 — Limitation de concurrence.** Statut : Transversal.
- **AX-187 — Gestion des erreurs de tâche.** Statut : Transversal.
- **AX-188 — Fallback synchrone contrôlé.** Statut : Transversal.
- **AX-189 — Mesure des coûts de communication.** Statut : Transversal.
- **AX-190 — Déterminisme entre exécution séquentielle et parallèle.** Statut : Transversal.

### 20 · Contrats, tests et interopérabilité · ⚙ / ⧉

Qualité des interfaces et compatibilité des modules

- **AX-191 — Schémas d'entrée et de sortie versionnés.** Statut : Transversal.
- **AX-192 — Validation des arguments à la frontière des modules.** Statut : Transversal.
- **AX-193 — Contrats d'erreur stables.** Statut : Transversal.
- **AX-194 — Tests unitaires par fonction publique.** Statut : Transversal.
- **AX-195 — Tests de propriétés et invariants géométriques.** Statut : Transversal.
- **AX-196 — Jeux de référence scientifiques.** Statut : Transversal.
- **AX-197 — Tests de compatibilité entre versions.** Statut : Transversal.
- **AX-198 — Interopérabilité JavaScript natif et React via adaptateur.** Statut : Transversal.
- **AX-199 — Documentation des capacités réellement implémentées.** Statut : Transversal.
- **AX-200 — Détection des fonctionnalités annoncées mais absentes.** Statut : Transversal.

## Exigences communes de réalisation

1. Chaque fonction doit publier un contrat d'entrée/sortie explicite et versionné.
2. Les unités, référentiels, époques, conventions d'axes et incertitudes doivent être déclarés lorsqu'ils s'appliquent.
3. Les calculs doivent définir les tolérances numériques, les cas limites et le comportement sur données invalides.
4. Les opérations coûteuses doivent être mesurables et pouvoir être exécutées hors du thread principal lorsque cela est pertinent.
5. Les formats propriétaires ou complexes ne doivent pas être annoncés comme pris en charge sans codec et tests de conformité.
6. Les fonctions logographiques publiques doivent être accessibles par les clés symboliques existantes, sans renommer les identifiants internes ASCII.
7. Toute nouvelle fonction doit être accompagnée de tests positifs, négatifs et de cas limites.
8. Les sources scientifiques doivent conserver leur provenance, leur version, leur licence et leurs limites connues.

## Ordre de réalisation recommandé

**Phase A — fiabilisation des primitives existantes :** AX-004 à AX-008, AX-031 à AX-040, AX-071 à AX-080, AX-081 à AX-090, AX-111 à AX-120, AX-131 à AX-140 et AX-181 à AX-200.

**Phase B — données et géométrie avancées :** terrain, signaux, temps, sources, indexation, compression et exécution parallèle.

**Phase C — simulation et visualisation :** corps planétaires, éphémérides, shaders et pipeline de rendu.

Cet ordre est une proposition de dépendances, pas une promesse de calendrier. Les axes devront être découpés en tickets techniques après audit des modules et des sources de données.
