#!/usr/bin/env node
// Régénère index.html (le fichier HTML unique, autonome, hors-ligne
// publié sur GitHub Pages) à partir de :
//   - data/kadyrov-data.json  (les données : entités, relations, compteurs)
//   - src/template.html       (le rendu : HTML + logique de la classe Component)
//
// index.html reste un bundle auto-extractible (balises __bundler/*) :
// on ne touche qu'au bloc __bundler/template (le HTML/JS de la page),
// le manifest, les ext_resources et le page_order (images, polices...)
// sont recopiés tels quels depuis le index.html existant.
//
// Usage : node scripts/build.mjs [index.html] [data/kadyrov-data.json] [src/template.html]

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const indexPath = resolve(process.argv[2] || resolve(repoRoot, 'index.html'));
const dataPath = resolve(process.argv[3] || resolve(repoRoot, 'data/kadyrov-data.json'));
const templatePath = resolve(process.argv[4] || resolve(repoRoot, 'src/template.html'));

const TEMPLATE_BLOCK_RE = /(<script type="__bundler\/template">\n)([\s\S]*?)(\n\s*<\/script>)/;

const GENERATED_BANNER_MARKER = 'FICHIER GÉNÉRÉ — NE PAS ÉDITER À LA MAIN';
const GENERATED_BANNER = `<!--
  ############################################################
  #  ${GENERATED_BANNER_MARKER}                #
  ############################################################

  Ce fichier est produit par \`node scripts/build.mjs\` à partir de :
    - src/template.html      (le rendu : HTML + logique)
    - data/kadyrov-data.json (les données : entités, relations, compteurs)

  Toute modification faite directement ici sera écrasée au prochain
  build. Pour changer quelque chose :
    1. éditer src/template.html (rendu) ou data/kadyrov-data.json (données)
    2. lancer : node scripts/build.mjs
    3. commiter la source ET ce fichier régénéré

  Voir la section « Modifier la carte » du README.
-->`;

function main() {
  const currentHtml = readFileSync(indexPath, 'utf8');
  const data = JSON.parse(readFileSync(dataPath, 'utf8'));
  const templateHtml = readFileSync(templatePath, 'utf8');

  const m = currentHtml.match(TEMPLATE_BLOCK_RE);
  if (!m) {
    throw new Error(
      `Bloc __bundler/template introuvable dans ${indexPath}. ` +
      'index.html doit déjà être au format bundlé (manifest/ext_resources/page_order/template).'
    );
  }

  const staticScript = `<script>window.__KADYROV_STATIC=${JSON.stringify(data)};</script>\n`;
  // Injecté juste après <body>, avant tout script qui lit __KADYROV_STATIC.
  const bodyIdx = templateHtml.indexOf('<body>');
  if (bodyIdx === -1) throw new Error('<body> introuvable dans ' + templatePath);
  const insertAt = bodyIdx + '<body>'.length;
  const finalPageHtml =
    templateHtml.slice(0, insertAt) + '\n' + staticScript + templateHtml.slice(insertAt);

  // Sanity check : le template ne doit plus contenir de littéraux de
  // données orphelins (signe d'une régression du refactor).
  const stillHardcoded = [
    'this.CAT = {', 'this.CERT = {', 'this.PLACES = [', 'this.LINKS = [',
    'this.SITES = [', 'this.CLUSTERS = {', 'this.CIVIL = {', 'this.BIOS = {',
    'this.TL = [', 'this.SOURCES = [', 'this.REGIONS = [',
  ].filter((needle) => finalPageHtml.includes(needle));
  if (stillHardcoded.length) {
    throw new Error('Littéraux encore hardcodés dans le template : ' + stillHardcoded.join(', '));
  }

  // Comme dans le bundle d'origine : toute occurrence de "</" doit être
  // échappée (/) pour qu'un "</script>" présent dans le HTML/JS de
  // la page n'interrompe pas prématurément le <script type="__bundler/
  // template"> qui l'enveloppe.
  const escapedJson = JSON.stringify(finalPageHtml).replace(/<\//g, '<\\u002F');
  const newTemplateBlock = m[1] + escapedJson + m[3];
  let newHtml = currentHtml.slice(0, m.index) + newTemplateBlock + currentHtml.slice(m.index + m[0].length);

  // Garde-fou : le bandeau « fichier généré » doit toujours être présent
  // en tête. Il vit hors du bloc template (donc il survit normalement au
  // build), mais on le réinsère s'il a disparu — par exemple si
  // quelqu'un a écrasé index.html à la main, ce que le bandeau est
  // précisément censé décourager.
  if (!newHtml.includes(GENERATED_BANNER_MARKER)) {
    newHtml = newHtml.replace(/^(<!DOCTYPE html>\n)/i, '$1' + GENERATED_BANNER + '\n');
    console.log('  (bandeau « fichier généré » réinséré)');
  }

  writeFileSync(indexPath, newHtml, 'utf8');
  console.log('Écrit :', indexPath, `(${newHtml.length} octets, +${(JSON.stringify(data).length / 1024).toFixed(0)} Ko de données injectées)`);
}

main();
