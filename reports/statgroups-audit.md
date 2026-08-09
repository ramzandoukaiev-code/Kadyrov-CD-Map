# Audit `statGroups` — « Le réseau en chiffres »

Comparaison des 7 valeurs affichées dans le panneau « Le réseau en
chiffres » (`data.statGroups`, ex-`const statGroups` hardcodé) avec un
décompte réel calculé à partir des tableaux du jeu de données
(`data/kadyrov-data.json`), état au 09/08/2026.

**Portée de ce rapport : constat, pas correctif.** `statGroups` reste
figé tel quel dans `data/kadyrov-data.json` (voir le refactor de
extraction) ; les écarts ci-dessous sont documentés pour une session
dédiée, comme convenu.

**Méthode** : chaque décompte est recalculé par un script Node one-off
sur `data/kadyrov-data.json` (filtre + comptage), reproductible en
relisant les requêtes indiquées sous chaque valeur. Aucune de ces
requêtes n'est câblée dans l'application — c'est un calcul d'audit
ponctuel, hors code.

---

## Groupe 1 — Empreinte financière

### « ≈ 50 M$ · de biens immobiliers documentés dans le Golfe »

**Statut : dérivable, cohérent.**

Somme des montants explicitement chiffrés dans `links` où `cat==='imm'`
et `city` ∈ villes du Golfe (dubai, abudhabi, riyadh, mecca, doha) :

| Lien | Montant |
|---|---|
| Villa Palm Jumeirah (Sh. Edilgiriev) | 14,4 M$ |
| 4 villas + Airbus A319 (Sh. Edilgiriev) | >20 M$ |
| 5 appartements + villa (R. Baisarov) | >10 M$ |
| 4 appartements (K.-M. Taymaskhanov) | >6 M$ |
| **Total** | **50,4 M$** |

Exclus du total (à raison) : le lancement de Firdaws à Dubaï (pas un
montant immobilier) et le rachat de Vision Investment/Roberto Cavalli
par H. Sajwani (~160 M€ — acquisition de marque, pas un bien
immobilier ; autre devise).

50,4 M$ ≈ 50 M$ affiché. Cohérent.

### « 20+ · appartements et villas identifiés à Dubaï »

**Statut : écart.**

Décompte des unités individuelles mentionnées dans les mêmes 4 liens
« imm » à Dubaï (hors Firdaws et Vision Investment, qui ne sont pas des
unités résidentielles) :

- Villa Palm Jumeirah : 1
- 4 villas (Edilgiriev) : 4
- 5 appartements + 1 villa (Baisarov) : 6
- 4 appartements (Taymaskhanov) : 4

**Total : 15 unités**, contre « 20+ » affiché. Écart de 5 unités
(-25 %). Hypothèse : le chiffre affiché date d'une version antérieure
du jeu de données (un bien retiré depuis ?), ou agrège une source
externe non reprise telle quelle dans `links`. À vérifier en session
dédiée plutôt qu'à corriger ici.

### « 72 · appartements « Cavalli » (Bellagio Grozny) … »

**Statut : non dérivable — absent du jeu de données structuré.**

Aucun champ de `links`, `sites` ou `finance.entities` ne porte de
décompte d'appartements pour le projet Bellagio/ONIRO à Cantù/Grozny.
Le seul enregistrement lié (`links` → `city:'cantu'`) documente le
concept d'intérieur ONIRO/Cavalli Home et la question de conformité UE
833/2014, sans nombre d'unités. La valeur « 72 » est donc une
estimation sourcée en dehors de ce jeu de données (pas un décompte
d'un tableau existant) — elle ne peut pas être vérifiée avec les
données actuelles. À documenter comme champ structuré si la source est
retrouvée.

---

## Groupe 2 — Exposition aux sanctions

### « 13 · entités du réseau sous sanctions internationales »

**Statut : écart significatif.**

Décompte réel des entités du réseau effectivement sous sanctions :

- Personnes (`people[].sanc.length > 0`) : **15**
  (`ramzan, aimani, medni, aishat, delim, alaud, daudov, vismuradov,
  kataev, seemar, sabsabi, dugaz, martynov, zakriev, bekkhan-agayev`)
- Entités juridiques (`finance.entities[].sanctioned === true`) : **5**
  (`fond_akhmat, firdaws, megastroy, aca_mma, fc_akhmat`)
- **Total : 20** (15 + 5), contre « 13 » affiché.

Écart de 7 (+54 %). Hypothèse la plus probable : « 13 » a été calculé
avant l'ajout du calque `finance` (17 entités, 26 relations) et/ou
avant l'ajout de personnes sanctionnées plus récemment (le README
mentionne un audit du 17 juillet 2026, potentiellement postérieur au
calcul initial de ce compteur). Compteur manifestement désynchronisé.

### « 4 · régimes concernés : États-Unis, UE, R.-U., Canada »

**Statut : écart significatif.**

Juridictions distinctes réellement présentes dans
`sanctions.entries[].sanctions[].jur` :

```
AU, CA, CH, EU, FR, JP, MC, NZ, PL, UK, US   →  11 régimes
```

Le libellé n'en nomme que 4 (US/EU/UK/CA), très en-deçà des 11
juridictions avec au moins une désignation confirmée dans le jeu de
données actuel (le fichier `sanctions.$doc.jurisdictions` en recense
même 11 possibles, dont Suisse, Pologne, Japon, France, Australie,
Nouvelle-Zélande, Monaco — toutes représentées dans au moins une
entrée). Là aussi, valeur vraisemblablement figée depuis une version
antérieure du calque sanctions.

---

## Groupe 3 — Portée géographique

### « 14 · pays et juridictions reliés au réseau »

**Statut : dérivable, exact.**

Correspond exactement à `hotCountries.length` (l'ancien `this.HOT`) :
14 pays (Russie, ÉAU, Arabie saoudite, Syrie, Allemagne, France,
Autriche, Turquie, Israël, Jordanie, Qatar, Tchéquie, Italie,
Palestine). Correspondance parfaite.

### « 6 · villes visées par un assassinat ou une tentative »

**Statut : dérivable avec un filtre qualitatif déjà présent dans les
données — cohérent.**

Décompte mécanique des villes distinctes portant un lien
`cat==='rep'` : **7** (dubai, doha, berlin, vienna, hanover, lille,
istanbul).

Mais l'entrée `doha` est explicitely annotée dans son propre libellé :
*« Assassinat de Z. Iandarbiev (contexte, antérieur à Kadyrov) »* — un
événement présenté comme antérieur et hors périmètre de Kadyrov, pas
comme un fait attribué à son régime. En excluant ce cas contextuel
(cohérent avec la logique éditoriale déjà écrite dans la donnée
elle-même, pas une invention de ce rapport), il reste **6 villes**,
ce qui correspond exactement à la valeur affichée. Cohérent.

---

## Synthèse

| Valeur | Affiché | Décompte réel | Statut |
|---|---|---|---|
| Immobilier Golfe | ≈ 50 M$ | 50,4 M$ | ✅ cohérent |
| Unités Dubaï | 20+ | 15 | ⚠️ écart (-5) |
| Appart. Cavalli | 72 | — (absent des données) | ❓ non dérivable |
| Entités sanctionnées | 13 | 20 | ⚠️ écart (+7) |
| Régimes de sanctions | 4 (nommés) | 11 (réels) | ⚠️ écart (+7) |
| Pays/juridictions | 14 | 14 | ✅ exact |
| Villes de répression | 6 | 7 brut / 6 avec filtre éditorial déjà présent | ✅ cohérent |

3 valeurs sur 7 sont exactes ou cohérentes avec un filtre déjà
documenté dans les données ; 3 présentent un écart avec le décompte
réel des tableaux actuels (probablement des compteurs non
resynchronisés au fil des mises à jour du jeu de données) ; 1 valeur
n'est vérifiable avec aucun champ actuel du jeu de données. Aucune
correction n'a été appliquée dans cette session — `statGroups` reste
figé tel qu'affiché aujourd'hui, conformément à la consigne.
