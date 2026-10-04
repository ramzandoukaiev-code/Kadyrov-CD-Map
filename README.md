# Kadyrov · Réseau d'influence

Cartographie OSINT interactive des réseaux d'influence, avoirs, canaux financiers et structures de détention de Ramzan Kadyrov, de l'Europe au Moyen-Orient.

**Carte en ligne :** https://ramzandoukaiev-code.github.io/Kadyrov-CD-Map/

## À propos

Visualisation bilingue (FR / EN) reliant deux vues complémentaires :

- **Carte Europe ↔ Moyen-Orient** : chaque arc relie un lieu à une affaire (immobilier, finance, diplomatie, philanthropie, répression, diaspora). La couleur de l'arc encode la nature du lien, le style du trait encode la certitude.
- **Réseau d'entités** : graphe radial des proches, exécutants, partenaires d'affaires, intermédiaires et structures de détention, avec leurs régimes de sanctions.

Cliquer une personne surligne les lieux associés sur la carte (et inversement). Navigation libre (glisser / molette), zoom sur les adresses clés, filtres par nature, certitude et statut de sanctions.

## Gradation des sources

| Niveau | Signification |
|--------|---------------|
| **Établi (5)** | Pièce officielle, registre ou décision de justice |
| **Documenté (4)** | Enquête recoupée, sans pièce judiciaire |
| **Rapporté (3)** | Source unique ou présomption |

Chaque affaire renvoie à sa source publique : enquêtes journalistiques (IStories, OCCRP, Le Monde, Bellingcat, RFE/RL, Novaya Gazeta, Ukrainska Pravda, OC Media, CORRECTIV, Jamestown, Der Spiegel), registres officiels (OFAC, listes consolidées UE et UK, registres d'entreprises russes et luxembourgeois) et décisions de justice (tribunaux de Berlin et de Vienne). Les liens marqués « à confirmer » pointent vers la source identifiée, dont l'entrée précise reste à vérifier sur le registre de l'autorité concernée. Les sources d'État (TASS, médias officiels tchétchènes) sont signalées comme telles et recoupées.

## Portée des sanctions

Le statut de chaque personne et de chaque entité est vérifié dans onze régimes : États-Unis, Union européenne, Royaume-Uni, Canada, Suisse, Japon, Pologne, Australie, Nouvelle-Zélande, France et Monaco. L'absence de désignation est traitée comme une donnée vérifiée à part entière, au même titre qu'une désignation, et non comme un silence.

## Avertissement

Document d'analyse à visée pédagogique, fondé exclusivement sur des enquêtes journalistiques publiques, des registres officiels et des décisions de justice. Les liens « rapportés » sont des présomptions, non des faits établis, et sont présentés comme tels.

## Technique

Fichier HTML unique et autonome : aucune dépendance réseau, fonctionne hors-ligne. Le fond de carte (Natural Earth) est intégré au fichier.

## Modifier la carte

**`index.html` est un fichier GÉNÉRÉ. Ne jamais l'éditer à la main** — toute modification directe est écrasée au prochain build.

La source est séparée en deux :

| Fichier | Contenu |
|---------|---------|
| `src/template.html` | le **rendu** : structure HTML, styles, logique d'affichage, libellés d'interface (`this.STR`) |
| `data/kadyrov-data.json` | les **données** : entités, personnes, lieux, liens, relations, sanctions, biographies, chronologie, compteurs |

Toute modification passe par le script de build :

```bash
# 1. éditer src/template.html (rendu) et/ou data/kadyrov-data.json (données)
# 2. régénérer le fichier publié
node scripts/build.mjs
# 3. commiter la source ET index.html régénéré
```

Le build injecte les données sous `window.__KADYROV_STATIC` dans le template, puis réencode le tout dans le bloc `__bundler/template` d'`index.html`. Les ressources binaires intégrées (fond de carte, photos, polices) ne sont pas touchées : le fichier publié reste un HTML unique, autonome et fonctionnel hors-ligne.

Détail des clés de données et correspondance avec les anciens noms de variables : `data/README.md`.

### Photos des fiches

Les photos ne sont pas des fichiers servis à côté de la page : ce sont des **ressources embarquées** dans `index.html`, déclarées dans le bloc `__bundler/ext_resources` et exposées au runtime sous `window.__resources`. Le champ `photo` d'une fiche (`data/kadyrov-data.json`, clé `civil`) porte donc un **identifiant de ressource**, jamais un chemin de fichier :

```json
"ramzan": { "photo": "kadyrovImg", "photoCredit": { "label": "", "url": "", "licence": "" } }
```

`photo: null` affiche les initiales à la place. Le build refuse de produire un fichier si un identifiant est absent de `ext_resources` ou ressemble à un chemin — c'est ce contrôle qui empêche une photo de disparaître en silence.

**Attention :** mettre `photo` à `null` retire l'affichage, pas la distribution. Les octets de l'image restent dans le fichier publié tant que la ressource n'est pas retirée du bundle.

`scripts/build.mjs` gère les ressources :

```bash
node scripts/build.mjs --resource-list                      # inventaire, poids, fiches utilisatrices
node scripts/build.mjs --resource-add     <id> <fichier>    # ajoute (refuse si l'id existe)
node scripts/build.mjs --resource-replace <id> <fichier>    # remplace le contenu, uuid conservé
node scripts/build.mjs --resource-remove  <id>              # retire du manifeste ET des ext_resources
```

Formats acceptés : `.jpg`, `.jpeg`, `.png`, `.avif`, `.webp`, `.gif`, `.svg`.

Le retrait est refusé tant qu'une fiche référence encore l'identifiant : passer son `photo` à `null` d'abord. Il est également refusé si l'uuid de la ressource est cité ailleurs dans le fichier. Après chaque opération, la cohérence entre les photos et `ext_resources` est revérifiée.

Une sauvegarde des images d'origine se trouve dans `data/import/photos/`, dossier ignoré par Git et donc jamais publié.

### Publier avec `deploy.sh`

`deploy.sh` enchaîne le build et la publication :

```bash
./deploy.sh "maj carto : ajout fiche X"
```

Il régénère `index.html` depuis `src/` + `data/`, vérifie le fichier produit, archive la version précédente sous `index-archive-AAAAMMJJ.html` (seulement si la sortie a changé), commite les sources avec le fichier généré, puis pousse.

| Variable | Effet |
|----------|-------|
| `DRY_RUN=1` | affiche les actions sans rien modifier |
| `NO_ARCHIVE=1` | ne pas archiver la version précédente |
| `NO_PUSH=1` | commit local, sans push |

Le script ne prend plus de fichier HTML en argument : cette ancienne signature (`./deploy.sh carte.html`) est refusée avec un message d'explication, car elle court-circuitait le build et désynchronisait `src/`/`data/` de ce qui était en ligne.

---
*Dernière mise à jour : 29 juillet 2026.*
