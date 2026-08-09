# src/template.html

Source éditable de la page. C'est le contenu HTML/JS de `index.html`
une fois débundlé (le format `__bundler/*` de `index.html` sert
uniquement à la publication — voir `scripts/build.mjs`).

Toutes les données (entités, relations, compteurs) qui étaient
auparavant écrites en dur ici ont été remplacées par des lectures sur
`window.__KADYROV_STATIC.*`, injecté au build depuis
`data/kadyrov-data.json`. Voir `data/README.md` pour la correspondance
des clés.

`this.STR` (libellés d'interface bilingues : titres, boutons,
disclaimer) reste hardcodé dans ce fichier, par choix explicite — ce
sont des chaînes de présentation, pas des données du réseau.

Ce fichier n'a pas vocation à être ouvert directement dans un
navigateur (il référence `window.__KADYROV_STATIC` qui n'existe que
si `scripts/build.mjs` l'a injecté) ni à être compatible avec un
quelconque outil d'édition externe : seul le format de sortie
(`index.html`, autonome et hors-ligne) compte.

## Régénérer index.html à partir de ce fichier

```
node scripts/build.mjs
```
