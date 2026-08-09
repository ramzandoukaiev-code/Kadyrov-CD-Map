# data/kadyrov-data.json

Source unique des données de la carte (entités, relations, compteurs),
extraites de `index.html` sans rien ajouter ni enlever.

Fusionne les deux mécanismes qui coexistaient avant ce refactor :

- `window.__KADYROV_DATA` (déjà en JSON dans le bundle publié) → clés
  `sanctions`, `finance`, `scope`.
- les littéraux `this.XXX` / `const P` / `statGroups` écrits en dur dans
  le script de rendu → toutes les autres clés.

## Correspondance avec les anciens noms de variables

| Clé JSON       | Ancien nom dans le code | Remarque |
|----------------|--------------------------|----------|
| `cat`          | `this.CAT`               | 5 catégories thématiques des arcs |
| `cert`         | `this.CERT`               | 3 niveaux de certitude |
| `clusters`     | `this.CLUSTERS`           | 6 groupes du réseau (dont « agayev ») |
| `sourceRefs`   | `this.SRC`                | dictionnaire `srcKey → {name, url\|q}` |
| `places`       | `this.PLACES`             | villes de la carte Europe ↔ Moyen-Orient |
| `links`        | `this.LINKS`              | arcs ville ↔ affaire |
| `sites`        | `this.SITES`              | points précis sur la carte |
| `people`       | `const P` (avant `this.layoutPeople(P)`) | positions x/y du graphe radial recalculées au rendu, non stockées |
| `civil`        | `this.CIVIL`              | fiche état civil par personne |
| `bios`         | `this.BIOS`               | dossiers biographiques |
| `timeline`     | `this.TL`                 | chronologie |
| `sourceNames`  | `this.SOURCES`            | liste plate pour la légende « Sources » |
| `regions`      | `this.REGIONS`            | libellés géographiques flottants |
| `hotCountries` | `this.HOT`                | `Set` → tableau |
| `statGroups`   | `const statGroups` (dans le rendu) | contenu affiché uniquement (titre/valeur/libellé + couleur d'accent) ; styles calculés exclus. **Valeurs figées, non recalculées depuis les tableaux ci-dessus** — voir le rapport d'écart séparé. |

`this.STR` (libellés d'interface : titres de sections, boutons,
disclaimer) reste hors périmètre et hardcodé dans le code, par choix
explicite (ce ne sont pas des données d'entités/relations).

## Régénération

```
node scripts/extract-data.mjs index.html data/kadyrov-data.json
```
