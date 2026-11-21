import test from 'node:test';
import assert from 'node:assert/strict';
import { harmoniser, emprise, REGLAGES } from '../src/harmonie.js';

const dir = (name, children = []) => ({ name, children });
const file = (name) => ({ name, file: true });
const files = (n) => Array.from({ length: n }, (_, i) => file(`f${i}`));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

test('racine à l’origine, parents avant enfants, même résultat à chaque appel', () => {
  const tree = dir('r', [dir('a', files(3)), dir('b'), file('x')]);
  const p1 = harmoniser(tree), p2 = harmoniser(tree);
  assert.deepEqual(p1.get(tree), [0, 0, 0]);
  assert.equal([...p1.keys()][0], tree);
  assert.deepEqual([...p1.values()], [...p2.values()]);
  assert.equal(p1.size, 7);
});

test('chaque étage est au-dessus du précédent et raccourcit avec la profondeur', () => {
  const c = dir('c'), b = dir('b', [c]), a = dir('a', [b]), r = dir('r', [a]);
  const p = harmoniser(r);
  const h1 = p.get(a)[1] - p.get(r)[1], h2 = p.get(b)[1] - p.get(a)[1], h3 = p.get(c)[1] - p.get(b)[1];
  assert.ok(h1 > h2 && h2 > h3 && h3 > 0);
  assert.equal(h1, REGLAGES.layer);
});

test('un sous-dossier unique monte tout droit : une chaîne devient une tige', () => {
  const c = dir('c'), b = dir('b', [c]), r = dir('r', [b]);
  const p = harmoniser(r);
  assert.equal(dist(p.get(r), p.get(b)), 0);
  assert.equal(dist(p.get(b), p.get(c)), 0);
});

test('les couronnes de deux sous-dossiers voisins ne se rentrent pas dedans', () => {
  for (const sizes of [[2, 2], [5, 3, 8], [12, 1, 1, 6, 3], [4, 4, 4, 4, 4, 4, 4, 4]]) {
    const kids = sizes.map((n, i) => dir(`d${i}`, Array.from({ length: n }, (_, j) => dir(`s${j}`))));
    const r = dir('r', kids);
    const p = harmoniser(r);
    const rayon = (d) => dist(p.get(d), p.get(d.children[0]));
    kids.forEach((d, i) => {
      const next = kids[(i + 1) % kids.length];
      const libre = dist(p.get(d), p.get(next));
      assert.ok(libre >= 0.75 * REGLAGES.overlap * (rayon(d) + rayon(next)), `${sizes} : ${libre}`);
    });
  }
});

test('un gros sous-arbre reçoit plus d’angle qu’un petit', () => {
  const gros = dir('gros', Array.from({ length: 20 }, (_, j) => dir(`s${j}`)));
  const p1 = dir('p1'), p2 = dir('p2'), p3 = dir('p3');
  const r = dir('r', [gros, p1, p2, p3]);
  const p = harmoniser(r);
  assert.ok(dist(p.get(gros), p.get(p1)) > 2 * dist(p.get(p1), p.get(p2)));
});

test('les fichiers forment une collerette plus basse et plus serrée que la couronne des sous-dossiers', () => {
  const a = dir('a'), b = dir('b'), c = dir('c'), fs = files(10);
  const r = dir('r', [a, b, c, ...fs]);
  const p = harmoniser(r);
  for (const f of fs) {
    assert.ok(p.get(f)[1] < p.get(a)[1] && p.get(f)[1] > 0);
    assert.ok(dist(p.get(r), p.get(f)) < dist(p.get(r), p.get(a)));
  }
});

test('dossier replié : `kids` décide de ce qui est visible, et l’emprise suit', () => {
  const r = dir('r', [dir('a', [dir('x'), dir('y'), dir('z')]), dir('b', files(40))]);
  const ouvert = harmoniser(r);
  const replie = harmoniser(r, { kids: (n) => (n === r ? n.children : []) });
  assert.equal(replie.size, 3);
  assert.ok(emprise(replie) < emprise(ouvert));
});

test('rayon borné : 500 sous-dossiers ne dépassent pas maxRadius', () => {
  const r = dir('r', Array.from({ length: 500 }, (_, j) => dir(`s${j}`)));
  assert.ok(emprise(harmoniser(r)) <= REGLAGES.maxRadius + 1e-9);
});
