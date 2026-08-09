#!/usr/bin/env node
// Extrait toutes les données actuellement hardcodées dans index.html
// (le fichier bundlé publié) vers un objet JS unique, sans rien ajouter
// ni enlever. Deux sources sont fusionnées :
//   - window.__KADYROV_DATA (déjà en JSON dans le bundle) : sanctions/finance/scope
//   - les littéraux this.XXX / const P / const statGroups écrits en dur
//     dans le script principal (débundlé depuis __bundler/template)
//
// Usage: node extract-data.mjs <chemin-vers-index.html> <chemin-sortie-json>

import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const [, , srcArg, outArg] = process.argv;
if (!srcArg || !outArg) {
  console.error('Usage: node extract-data.mjs <index.html> <sortie.json>');
  process.exit(1);
}
const srcPath = resolve(srcArg);
const outPath = resolve(outArg);

// ---------------------------------------------------------------------
// 1) window.__KADYROV_DATA (sanctions / finance / scope) via un navigateur
//    headless, pour laisser le bundler lui-même faire la décompression.
// ---------------------------------------------------------------------
async function extractKadyrovData(fileUrl) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await page.goto(fileUrl, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__KADYROV_DATA !== undefined, { timeout: 30000 });
    await page.waitForTimeout(1000);
    if (pageErrors.length) {
      throw new Error('Erreurs JS pendant le chargement : ' + pageErrors.join(' | '));
    }
    return await page.evaluate(() => window.__KADYROV_DATA);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------
// 2) Littéraux hardcodés dans le script principal du template débundlé.
// ---------------------------------------------------------------------
function getBundledTemplateHtml(html) {
  const m = html.match(/<script type="__bundler\/template">\n([\s\S]*?)\n\s*<\/script>/);
  if (!m) throw new Error('Bloc __bundler/template introuvable — ce fichier n\'est pas au format bundlé attendu.');
  return JSON.parse(m[1]);
}

// Extrait le texte source d'un littéral objet/tableau/Set en comptant
// les accolades/crochets/parenthèses et en ignorant le contenu des
// chaînes ('...' "..." `...`) pour ne pas se faire piéger par des
// caractères d'ouverture/fermeture à l'intérieur d'une chaîne.
function extractLiteralSource(src, marker) {
  const idx = src.indexOf(marker);
  if (idx === -1) throw new Error('marqueur introuvable : ' + marker);
  let i = idx + marker.length;
  while (/\s/.test(src[i])) i++;
  const openChar = src[i];
  const pairs = { '{': '}', '[': ']', '(': ')' };
  const closeChar = pairs[openChar];
  if (!closeChar) throw new Error(`caractère inattendu après "${marker}": "${openChar}"`);
  let depth = 0;
  let inStr = null;
  const start = i;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (ch === '\\') { i++; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { inStr = ch; continue; }
    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }
  if (depth !== 0) throw new Error('accolades/crochets non équilibrés pour ' + marker);
  return src.slice(start, i);
}

function evalLiteral(literalSrc) {
  // eslint-disable-next-line no-new-func
  return new Function('Math', 'return (' + literalSrc + ')')(Math);
}

function extractHardcodedLiterals(templateHtml) {
  const scriptMatch = templateHtml.match(/class Component extends DCLogic[\s\S]*/);
  if (!scriptMatch) throw new Error('Classe Component introuvable dans le template débundlé.');
  const src = scriptMatch[0];

  const cat = evalLiteral(extractLiteralSource(src, 'this.CAT ='));
  const cert = evalLiteral(extractLiteralSource(src, 'this.CERT ='));
  const sourceRefs = evalLiteral(extractLiteralSource(src, 'this.SRC ='));
  const places = evalLiteral(extractLiteralSource(src, 'this.PLACES ='));
  const links = evalLiteral(extractLiteralSource(src, 'this.LINKS ='));
  const sites = evalLiteral(extractLiteralSource(src, 'this.SITES ='));
  const clusters = evalLiteral(extractLiteralSource(src, 'this.CLUSTERS ='));
  const people = evalLiteral(extractLiteralSource(src, 'const P ='));
  const civil = evalLiteral(extractLiteralSource(src, 'this.CIVIL ='));
  const bios = evalLiteral(extractLiteralSource(src, 'this.BIOS ='));
  const timeline = evalLiteral(extractLiteralSource(src, 'this.TL ='));
  const sourceNames = evalLiteral(extractLiteralSource(src, 'this.SOURCES ='));
  const hotCountries = evalLiteral(extractLiteralSource(src, 'this.HOT = new Set('));
  const regions = evalLiteral(extractLiteralSource(src, 'this.REGIONS ='));

  return {
    cat, cert, sourceRefs, places, links, sites, clusters, people, civil, bios,
    timeline, sourceNames, hotCountries, regions,
  };
}

// statGroups ("Le réseau en chiffres") mélange données et styles de
// présentation (accent couleur, styles calculés). On transcrit ici
// uniquement le contenu affiché (titre, valeur, libellé), tel quel,
// tel que vérifié ligne à ligne dans le source du 09/08/2026 — voir
// le rapport séparé pour la comparaison avec les décomptes réels.
const STAT_GROUPS = [
  {
    accent: '#ffb347',
    title: { fr: 'Empreinte financière', en: 'Financial footprint' },
    items: [
      { value: '≈ 50 M$', label: { fr: 'de biens immobiliers documentés dans le Golfe', en: 'of documented Gulf real estate' } },
      { value: '20+', label: { fr: 'appartements et villas identifiés à Dubaï', en: 'flats and villas identified in Dubai' } },
      { value: '72', label: { fr: 'appartements « Cavalli » (Bellagio Grozny) portés par une SPV au capital de 15 000 ₽', en: '“Cavalli” flats (Bellagio Grozny) carried by a ₽15,000-capital SPV' } },
    ],
  },
  {
    accent: '#e74c3c',
    title: { fr: 'Exposition aux sanctions', en: 'Sanctions exposure' },
    items: [
      { value: '13', label: { fr: 'entités du réseau sous sanctions internationales', en: 'network entities under international sanctions' } },
      { value: '4', label: { fr: 'régimes concernés : États-Unis, UE, R.-U., Canada', en: 'regimes involved: US, EU, UK, Canada' } },
    ],
  },
  {
    accent: '#53c2da',
    title: { fr: 'Portée géographique', en: 'Geographic reach' },
    items: [
      { value: '14', label: { fr: 'pays et juridictions reliés au réseau', en: 'countries and jurisdictions linked to the network' } },
      { value: '6', label: { fr: 'villes visées par un assassinat ou une tentative', en: 'cities targeted by a killing or attempt' } },
    ],
  },
];

async function main() {
  const html = readFileSync(srcPath, 'utf8');
  const templateHtml = getBundledTemplateHtml(html);
  const hardcoded = extractHardcodedLiterals(templateHtml);
  const kadyrovData = await extractKadyrovData('file://' + srcPath);

  const merged = {
    cat: hardcoded.cat,
    cert: hardcoded.cert,
    clusters: hardcoded.clusters,
    sourceRefs: hardcoded.sourceRefs,
    places: hardcoded.places,
    links: hardcoded.links,
    sites: hardcoded.sites,
    people: hardcoded.people,
    civil: hardcoded.civil,
    bios: hardcoded.bios,
    timeline: hardcoded.timeline,
    sourceNames: hardcoded.sourceNames,
    regions: hardcoded.regions,
    hotCountries: hardcoded.hotCountries,
    statGroups: STAT_GROUPS,
    sanctions: kadyrovData.sanctions,
    finance: kadyrovData.finance,
    scope: kadyrovData.scope,
  };

  writeFileSync(outPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log('Écrit :', outPath);
  for (const [k, v] of Object.entries(merged)) {
    const count = Array.isArray(v) ? v.length : (v && typeof v === 'object' ? Object.keys(v).length : '');
    console.log(`  ${k}: ${count}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
