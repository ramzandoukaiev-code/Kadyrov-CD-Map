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
//
// Gestion des ressources embarquées (images des fiches) :
//   node scripts/build.mjs --resource-list
//   node scripts/build.mjs --resource-add     <id> <fichier>
//   node scripts/build.mjs --resource-replace <id> <fichier>
//   node scripts/build.mjs --resource-remove  <id>

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// Les commandes de ressources consomment leurs propres arguments : on ne les
// confond pas avec les chemins positionnels du build.
const argv = process.argv.slice(2);
const cmdIdx = argv.findIndex((a) => a.startsWith('--resource-'));
const resourceCmd = cmdIdx >= 0 ? argv[cmdIdx] : null;
const resourceArgs = cmdIdx >= 0 ? argv.slice(cmdIdx + 1) : [];
const positional = cmdIdx >= 0 ? argv.slice(0, cmdIdx) : argv;

const indexPath = resolve(positional[0] || resolve(repoRoot, 'index.html'));
const dataPath = resolve(positional[1] || resolve(repoRoot, 'data/kadyrov-data.json'));
const templatePath = resolve(positional[2] || resolve(repoRoot, 'src/template.html'));

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

// --- Métadonnées de partage (Open Graph / Twitter) ---------------------------
// Elles vivent dans le <head> de la COQUE, pas dans celui de src/template.html :
// le template n'est injecté qu'au runtime par JavaScript, or les robots des
// réseaux sociaux ne l'exécutent pas. Posées ici, elles sont dans le HTML
// réellement servi par GitHub Pages.
const SITE_URL = 'https://ramzandoukaiev-code.github.io/Kadyrov-CD-Map/';
const OG_TITLE = 'Kadyrov · Réseau d’influence & empreinte financière';
const OG_DESC = 'Cartographie OSINT des réseaux d’influence, avoirs et canaux financiers de Ramzan Kadyrov, de l’Europe au Moyen-Orient.';
const META_START = '<!-- kd:meta:start -->';
const META_END = '<!-- kd:meta:end -->';
const META_BLOCK = `  ${META_START}
  <title>${OG_TITLE}</title>
  <meta name="description" content="${OG_DESC}">
  <link rel="canonical" href="${SITE_URL}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Kadyrov Network Map">
  <meta property="og:locale" content="fr_FR">
  <meta property="og:title" content="${OG_TITLE}">
  <meta property="og:description" content="${OG_DESC}">
  <meta property="og:url" content="${SITE_URL}">
  <meta property="og:image" content="${SITE_URL}assets/og-image.png">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Carte des liens entre Grozny, l’Europe et le Golfe, avec le panneau d’analyse ouvert.">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${OG_TITLE}">
  <meta name="twitter:description" content="${OG_DESC}">
  <meta name="twitter:image" content="${SITE_URL}assets/og-image.png">
  <meta name="twitter:image:alt" content="Carte des liens entre Grozny, l’Europe et le Golfe, avec le panneau d’analyse ouvert.">
  ${META_END}`;

// Pose le bloc dans le <head> de la coque, ou le remplace s'il y est déjà.
function ensureMeta(html) {
  if (html.includes(META_START) && html.includes(META_END)) {
    const re = new RegExp(`[ \\t]*${META_START}[\\s\\S]*?${META_END}`);
    return html.replace(re, META_BLOCK);
  }
  // Première pose : on insère après le charset de la coque et on retire le
  // <title> générique du bundler, que META_BLOCK remplace.
  const sansTitre = html.replace(/[ \t]*<title>Bundled Page<\/title>\n/, '');
  const m = sansTitre.match(/<head>\s*\n[ \t]*<meta charset="utf-8">\n/);
  if (!m) throw new Error('impossible de situer le <head> de la coque pour y poser les métadonnées');
  const at = m.index + m[0].length;
  return sansTitre.slice(0, at) + META_BLOCK + '\n' + sansTitre.slice(at);
}

// Les photos des fiches ne sont pas des fichiers servis à côté de la page :
// ce sont des ressources embarquées dans le bundle, déclarées dans
// __bundler/ext_resources et exposées au runtime via window.__resources.
// Un identifiant absent de ce manifeste ne lèverait aucune erreur — la photo
// disparaîtrait simplement, remplacée par les initiales. On fait donc
// échouer le build, pour que la rupture soit visible tout de suite.
function verifiePhotos(html, data) {
  const m = html.match(/<script type="__bundler\/ext_resources">\n([\s\S]*?)\n\s*<\/script>/);
  if (!m) throw new Error('Bloc __bundler/ext_resources introuvable : impossible de vérifier les photos.');
  let connus;
  try { connus = new Set(JSON.parse(m[1]).map((r) => r.id)); }
  catch (e) { throw new Error('__bundler/ext_resources illisible : ' + e.message); }

  const manquants = [];
  for (const [id, fiche] of Object.entries((data && data.civil) || {})) {
    const p = fiche && fiche.photo;
    if (!p) continue;                       // null ou absent : fiche sans photo, cas normal
    if (typeof p !== 'string') { manquants.push(`${id} : photo n'est pas une chaîne (${typeof p})`); continue; }
    if (p.includes('/') || p.includes('.')) {
      manquants.push(`${id} : "${p}" ressemble à un chemin de fichier — attendu : un identifiant de ext_resources`);
      continue;
    }
    if (!connus.has(p)) manquants.push(`${id} : "${p}" absent de ext_resources`);
  }
  if (manquants.length) {
    throw new Error(
      'Photos de fiches non résolubles — build interrompu :\n  ' + manquants.join('\n  ') +
      `\n\nIdentifiants disponibles : ${[...connus].join(', ')}`
    );
  }
}

// ---------------------------------------------------------------------------
// Ressources embarquées (images des fiches)
// ---------------------------------------------------------------------------
// Une ressource vit à deux endroits dans le bundle : une entrée {id, uuid}
// dans __bundler/ext_resources, et le blob correspondant dans
// __bundler/manifest. Les deux doivent être ajoutés et retirés ensemble —
// ne retirer que l'entrée ext_resources laisserait les octets de l'image
// dans le fichier publié, donc toujours distribués aux visiteurs.

const EXT_RE = /(<script type="__bundler\/ext_resources">\n)([\s\S]*?)(\n\s*<\/script>)/;
const MANIFEST_RE = /(<script type="__bundler\/manifest">\n)([\s\S]*?)(\n\s*<\/script>)/;

const MIMES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.avif': 'image/avif', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
};

function litBlocs(html) {
  const e = html.match(EXT_RE), m = html.match(MANIFEST_RE);
  if (!e) throw new Error('Bloc __bundler/ext_resources introuvable.');
  if (!m) throw new Error('Bloc __bundler/manifest introuvable.');
  return { ext: JSON.parse(e[2]), man: JSON.parse(m[2]) };
}
function ecritBlocs(html, ext, man) {
  return html
    .replace(EXT_RE, (_, a, __, c) => a + JSON.stringify(ext) + c)
    .replace(MANIFEST_RE, (_, a, __, c) => a + JSON.stringify(man) + c);
}
// Le même garde-fou que pour le build : une ressource encore désignée par une
// fiche ne peut pas disparaître sans que la photo passe à null d'abord.
function fichesUtilisant(id) {
  if (!existsSync(dataPath)) return [];
  const data = JSON.parse(readFileSync(dataPath, 'utf8'));
  return Object.entries((data && data.civil) || {})
    .filter(([, f]) => f && f.photo === id)
    .map(([k]) => k);
}

function commandeRessource(cmd, args) {
  const html = readFileSync(indexPath, 'utf8');
  const { ext, man } = litBlocs(html);
  const trouve = (id) => ext.findIndex((r) => r.id === id);

  if (cmd === '--resource-list') {
    console.log(`${ext.length} ressource(s) dans ${indexPath} :`);
    for (const r of ext) {
      const e = man[r.uuid];
      const ko = e ? (e.data.length * 0.75 / 1024).toFixed(1) + ' Ko' : 'ABSENTE DU MANIFESTE';
      const utilisee = fichesUtilisant(r.id);
      console.log(`  ${r.id.slice(0, 44).padEnd(46)} ${String(e && e.mime || '—').padEnd(12)} ${ko.padStart(12)}` +
        (utilisee.length ? `  ← ${utilisee.join(', ')}` : ''));
    }
    return;
  }

  const id = args[0];
  if (!id) throw new Error(`${cmd} attend un identifiant de ressource.`);
  const i = trouve(id);

  if (cmd === '--resource-remove') {
    if (i < 0) throw new Error(`Ressource "${id}" absente de ext_resources — rien à retirer.`);
    const utilisee = fichesUtilisant(id);
    if (utilisee.length) {
      throw new Error(
        `Ressource "${id}" encore utilisée par : ${utilisee.join(', ')}.\n` +
        'Passer leur champ photo à null dans data/kadyrov-data.json avant de retirer la ressource.'
      );
    }
    const uuid = ext[i].uuid;
    // Une ressource peut être référencée par son uuid ailleurs que dans les
    // deux blocs (un <script src="uuid"> dans le template, par exemple).
    const horsBlocs = html.replace(EXT_RE, '').replace(MANIFEST_RE, '');
    if (horsBlocs.includes(uuid)) {
      throw new Error(`L'uuid de "${id}" (${uuid}) est référencé ailleurs dans le fichier — retrait refusé.`);
    }
    const poids = man[uuid] ? man[uuid].data.length * 0.75 / 1024 : 0;
    ext.splice(i, 1);
    delete man[uuid];
    writeFileSync(indexPath, ecritBlocs(html, ext, man), 'utf8');
    console.log(`Retiré : ${id} (${poids.toFixed(1)} Ko libérés, entrée manifeste et ext_resources supprimées)`);
    return;
  }

  const fichier = args[1];
  if (!fichier) throw new Error(`${cmd} attend un identifiant puis un chemin de fichier.`);
  const src = resolve(fichier);
  if (!existsSync(src)) throw new Error(`Fichier introuvable : ${src}`);
  const mime = MIMES[extname(src).toLowerCase()];
  if (!mime) throw new Error(`Extension non reconnue pour ${src} — attendu : ${Object.keys(MIMES).join(', ')}`);
  const octets = readFileSync(src);
  if (octets.length < 64) throw new Error(`Fichier suspicieusement petit (${octets.length} octets) : ${src}`);

  if (cmd === '--resource-add') {
    if (i >= 0) throw new Error(`Ressource "${id}" déjà présente — utiliser --resource-replace.`);
    const uuid = randomUUID();
    ext.push({ id, uuid });
    man[uuid] = { mime, compressed: false, data: octets.toString('base64') };
    writeFileSync(indexPath, ecritBlocs(html, ext, man), 'utf8');
    console.log(`Ajouté : ${id} (${mime}, ${(octets.length / 1024).toFixed(1)} Ko, uuid ${uuid})`);
    return;
  }
  if (cmd === '--resource-replace') {
    if (i < 0) throw new Error(`Ressource "${id}" absente — utiliser --resource-add.`);
    const uuid = ext[i].uuid;
    const avant = man[uuid] ? man[uuid].data.length * 0.75 / 1024 : 0;
    man[uuid] = { mime, compressed: false, data: octets.toString('base64') };
    writeFileSync(indexPath, ecritBlocs(html, ext, man), 'utf8');
    console.log(`Remplacé : ${id} (${mime}, ${avant.toFixed(1)} → ${(octets.length / 1024).toFixed(1)} Ko, uuid inchangé)`);
    return;
  }
  throw new Error(`Commande inconnue : ${cmd}`);
}

function main() {
  const currentHtml = readFileSync(indexPath, 'utf8');
  const data = JSON.parse(readFileSync(dataPath, 'utf8'));
  const templateHtml = readFileSync(templatePath, 'utf8');

  verifiePhotos(currentHtml, data);

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

  // Métadonnées de partage : posées à chaque build, donc toujours à jour.
  newHtml = ensureMeta(newHtml);

  writeFileSync(indexPath, newHtml, 'utf8');
  console.log('Écrit :', indexPath, `(${newHtml.length} octets, +${(JSON.stringify(data).length / 1024).toFixed(0)} Ko de données injectées)`);
}

if (resourceCmd) {
  // Après toute mutation, on revérifie la cohérence photos ↔ ext_resources :
  // une incohérence doit sortir ici, pas au prochain build.
  commandeRessource(resourceCmd, resourceArgs);
  if (resourceCmd !== '--resource-list' && existsSync(dataPath)) {
    verifiePhotos(readFileSync(indexPath, 'utf8'), JSON.parse(readFileSync(dataPath, 'utf8')));
    console.log('  (cohérence photos ↔ ext_resources vérifiée)');
  }
} else {
  main();
}
