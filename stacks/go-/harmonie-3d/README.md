# @go-/harmonie-3d

Disposition harmonieuse d'une arborescence (dossiers et fichiers) en 3D. C'est le calcul utilisé par le plugin
`go-tree-3d` pour afficher les projets. Aucune dépendance : une seule fonction pure, testable avec `node --test`.

## Ce que fait la disposition

- Chaque dossier porte ses sous-dossiers sur une couronne, un étage au-dessus de lui.
- Un sous-dossier reçoit une part d'angle proportionnelle à la largeur de sa propre couronne : les gros sous-arbres ont
  plus de place, et deux couronnes voisines ne se rentrent pas dedans.
- Les fichiers d'un dossier forment une collerette plus basse et plus serrée, à l'intérieur de la couronne.
- Un sous-dossier unique monte tout droit : une chaîne `a/b/c` devient une tige.
- Les étages raccourcissent avec la profondeur, et chaque étage est tourné de l'angle d'or par rapport au précédent.

## Utilisation

```js
import { harmoniser, emprise } from '@go-/harmonie-3d';

const positions = harmoniser(racine, {
  kids: (n) => (estOuvert(n) ? n.children : []), // enfants visibles ; [] pour un dossier replié
  isFile: (n) => n.file,
});
positions.get(racine);   // [0, 0, 0]
emprise(positions);      // rayon occupé autour de la racine, pour poser plusieurs arbres côte à côte
```

Les réglages (hauteur d'étage, marges, rayons minimal et maximal…) sont listés dans `REGLAGES` et se remplacent
un par un dans `options`.

## Tests

```bash
cd stacks/go-/harmonie-3d && node --test
```
