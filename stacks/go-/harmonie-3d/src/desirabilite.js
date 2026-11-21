/**
 * @go-/harmonie-3d — score de désirabilité de chaque branche (dossier) d'un projet.
 *
 * Le score, de 0 à 100, dit si un dossier est agréable à parcourir tel qu'il est rangé. Il ne lit que la forme de
 * l'arborescence (nombre de sous-dossiers, de fichiers, profondeur), jamais le contenu des fichiers.
 *
 * Quatre notes entre 0 et 1, pondérées :
 *  - largeur    : 2 à 7 sous-dossiers directs est idéal ; un seul (dossier « couloir ») ou beaucoup plus coûtent ;
 *  - charge     : 1 à 12 fichiers directs est idéal ; au-delà, la note baisse à mesure que le dossier se remplit ;
 *  - équilibre  : des sous-dossiers de tailles proches valent mieux qu'un géant entouré de miettes ;
 *  - profondeur : jusqu'à 4 niveaux sous la racine, pleine note ; chaque niveau de plus coûte.
 * Un dossier vide vaut 0.
 */

/** Seuils et poids par défaut ; chacun peut être remplacé dans `options`. */
export const CRITERES = {
  largeurMin: 2,        // nombre idéal de sous-dossiers : de…
  largeurMax: 7,        // …à
  chargeMin: 1,         // nombre idéal de fichiers : de…
  chargeMax: 12,        // …à
  profondeurMax: 4,     // profondeur sans pénalité
  poids: { largeur: 0.3, charge: 0.3, equilibre: 0.25, profondeur: 0.15 },
};

const borne01 = (v) => Math.max(0, Math.min(1, v));

/**
 * Calcule le score de chaque dossier.
 *
 * @param {object} root dossier racine.
 * @param {object} [options] seuils et poids (voir CRITERES), plus :
 *   - kids(node)   : tous les enfants du nœud (défaut : `node.children`) ;
 *   - isFile(node) : vrai pour un fichier (défaut : `node.file`).
 * @returns {Map<object, object>} par dossier : `score` (0–100, le dossier seul), `branche` (0–100, moyenne du dossier
 *   et de tous ses sous-dossiers), `notes` (les quatre notes entre 0 et 1), `dossiers` et `fichiers` (enfants directs),
 *   `taille` (nombre total de descendants) et `profondeur`.
 */
export function desirabilite(root, options = {}) {
  const o = { ...CRITERES, ...options, poids: { ...CRITERES.poids, ...(options.poids || {}) } };
  const kids = o.kids || ((n) => n.children || []);
  const isFile = o.isFile || ((n) => !!n.file);
  const scores = new Map();

  const visiter = (node, depth) => {
    const all = kids(node) || [];
    const dirs = all.filter((k) => !isFile(k));
    const nf = all.length - dirs.length, nd = dirs.length;
    const subs = dirs.map((d) => visiter(d, depth + 1));
    const taille = nf + subs.reduce((s, r) => s + 1 + r.taille, 0);

    // Largeur : feuille avec fichiers = 1 ; couloir (un seul sous-dossier) = 0,5, ou 0,3 s'il n'a aucun fichier.
    let largeur;
    if (nd === 0) largeur = 1;
    else if (nd < o.largeurMin) largeur = nf ? 0.5 : 0.3;
    else if (nd <= o.largeurMax) largeur = 1;
    else largeur = borne01(1 - (nd - o.largeurMax) / (3 * o.largeurMax));

    // Charge : sans fichier, un dossier de regroupement (au moins 2 sous-dossiers) reste acceptable.
    let charge;
    if (nf === 0) charge = nd >= o.largeurMin ? 0.8 : 0.4;
    else if (nf <= o.chargeMax) charge = nf >= o.chargeMin ? 1 : 0.8;
    else charge = 1 / (1 + (nf - o.chargeMax) / o.chargeMax);

    // Équilibre : 1 ÷ (1 + coefficient de variation des tailles des sous-dossiers).
    let equilibre = 1;
    if (nd >= 2) {
      const tailles = subs.map((r) => 1 + r.taille);
      const moy = tailles.reduce((a, b) => a + b, 0) / nd;
      const ecart = Math.sqrt(tailles.reduce((a, t) => a + (t - moy) ** 2, 0) / nd);
      equilibre = 1 / (1 + ecart / moy);
    }

    const profondeur = borne01(1 - Math.max(0, depth - o.profondeurMax) / 5);
    const vide = nd === 0 && nf === 0;
    const p = o.poids;
    const total = p.largeur + p.charge + p.equilibre + p.profondeur;
    const score = vide ? 0 : Math.round((100 * (p.largeur * largeur + p.charge * charge + p.equilibre * equilibre + p.profondeur * profondeur)) / total);

    // Branche : moyenne du dossier et de tous ses sous-dossiers.
    const somme = score + subs.reduce((s, r) => s + r.somme, 0);
    const nombre = 1 + subs.reduce((s, r) => s + r.nombre, 0);
    const result = {
      score, branche: Math.round(somme / nombre),
      notes: { largeur, charge, equilibre, profondeur },
      dossiers: nd, fichiers: nf, taille, profondeur: depth, somme, nombre,
    };
    scores.set(node, result);
    return result;
  };
  visiter(root, 0);
  for (const r of scores.values()) { delete r.somme; delete r.nombre; }
  return scores;
}

/** Les `n` dossiers les moins désirables, du pire au meilleur (à score égal, le plus gros d'abord). */
export function moinsDesirables(scores, n = 10) {
  return [...scores.entries()]
    .sort((a, b) => a[1].score - b[1].score || b[1].taille - a[1].taille)
    .slice(0, n)
    .map(([node, r]) => ({ node, ...r }));
}
