import test from 'node:test';
import assert from 'node:assert/strict';
import { desirabilite, moinsDesirables, harmoniser } from '../src/index.js';

const dir = (name, children = []) => ({ name, children });
const files = (n) => Array.from({ length: n }, (_, i) => ({ name: `f${i}`, file: true }));
const feuille = (name, n = 5) => dir(name, files(n));

test('un dossier bien rangé vaut 100', () => {
  const r = dir('r', [feuille('a'), feuille('b'), feuille('c'), ...files(4)]);
  const s = desirabilite(r);
  assert.equal(s.get(r).score, 100);
  assert.equal(s.get(r).branche, 100);
  assert.deepEqual(s.get(r).notes, { largeur: 1, charge: 1, equilibre: 1, profondeur: 1 });
  assert.equal(s.size, 4);
});

test('un dossier vide vaut 0', () => {
  const vide = dir('vide'), r = dir('r', [vide, feuille('a')]);
  assert.equal(desirabilite(r).get(vide).score, 0);
});

test('trop de fichiers : la note de charge baisse à mesure que le dossier se remplit', () => {
  const s = (n) => { const d = feuille('d', n); return desirabilite(d).get(d); };
  assert.equal(s(12).notes.charge, 1);
  assert.equal(s(24).notes.charge, 0.5);
  assert.ok(s(182).notes.charge < 0.1);
  assert.ok(s(12).score > s(24).score && s(24).score > s(182).score);
});

test('un dossier couloir (un seul sous-dossier, aucun fichier) est pénalisé', () => {
  const b = feuille('b'), a = dir('a', [b]), r = dir('r', [a, feuille('c')]);
  const s = desirabilite(r);
  assert.equal(s.get(a).notes.largeur, 0.3);
  assert.ok(s.get(a).score < s.get(b).score);
});

test('trop de sous-dossiers : la largeur baisse au-delà de 7', () => {
  const large = (n) => { const r = dir('r', Array.from({ length: n }, (_, i) => feuille(`d${i}`))); return desirabilite(r).get(r).notes.largeur; };
  assert.equal(large(7), 1);
  assert.ok(large(14) < 1 && large(14) > large(24));
  assert.equal(large(40), 0);
});

test('des sous-dossiers de tailles proches valent mieux qu’un géant et des miettes', () => {
  const egal = dir('r', [feuille('a', 6), feuille('b', 6), feuille('c', 6)]);
  const inegal = dir('r', [feuille('a', 60), feuille('b', 1), feuille('c', 1)]);
  assert.equal(desirabilite(egal).get(egal).notes.equilibre, 1);
  assert.ok(desirabilite(inegal).get(inegal).notes.equilibre < 0.5);
});

test('la profondeur coûte au-delà de 4 niveaux', () => {
  let bas = feuille('n7'); const chaine = [bas];
  for (let i = 6; i >= 0; i--) { bas = dir(`n${i}`, [bas, ...files(2)]); chaine.unshift(bas); }
  const s = desirabilite(bas);
  assert.equal(s.get(chaine[4]).notes.profondeur, 1);
  assert.equal(s.get(chaine[5]).notes.profondeur, 0.8);
  assert.equal(s.get(chaine[7]).notes.profondeur, 0.4);
});

test('branche = moyenne du dossier et de ses sous-dossiers ; classement du pire au meilleur', () => {
  const lourd = feuille('lourd', 200), ok = feuille('ok'), r = dir('r', [lourd, ok, ...files(3)]);
  const s = desirabilite(r);
  const moyenne = Math.round((s.get(r).score + s.get(lourd).score + s.get(ok).score) / 3);
  assert.equal(s.get(r).branche, moyenne);
  assert.equal(moinsDesirables(s, 1)[0].node, lourd);
  assert.equal(moinsDesirables(s).length, 3);
});

test('les poids et seuils se remplacent, et le score ne dépend pas de la disposition', () => {
  const d = feuille('d', 30);
  assert.equal(desirabilite(d, { chargeMax: 30 }).get(d).score, 100);
  assert.ok(desirabilite(d, { poids: { charge: 1, largeur: 0, equilibre: 0, profondeur: 0 } }).get(d).score < 50);
  assert.equal(harmoniser(d).size, 31);
});
