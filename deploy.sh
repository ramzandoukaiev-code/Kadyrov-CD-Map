#!/usr/bin/env bash
#
# deploy.sh — Publie une nouvelle version de la carte Kadyrov sur GitHub Pages.
#
# Le site est un unique fichier `index.html` servi par GitHub Pages, mais
# ce fichier est GÉNÉRÉ : il est produit par `scripts/build.mjs` à partir de
#   - src/template.html      (le rendu)
#   - data/kadyrov-data.json (les données)
#
# Ce script régénère index.html depuis ces sources, archive la version
# précédente (avec un horodatage), puis commit et push l'ensemble
# (sources + fichier généré).
#
# Usage :
#   ./deploy.sh [message de commit]
#
# Exemples :
#   ./deploy.sh
#   ./deploy.sh "maj carto : ajout fiche X"
#
# Options (variables d'environnement) :
#   NO_ARCHIVE=1   Ne pas archiver l'index.html précédent
#   NO_PUSH=1      Commit local sans push
#   DRY_RUN=1      Affiche les actions sans rien modifier

set -euo pipefail

# --- Répertoire du dépôt (là où se trouve ce script) ------------------------
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

# --- Couleurs / helpers -----------------------------------------------------
if [ -t 1 ]; then
  BOLD=$'\033[1m'; RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RESET=$'\033[0m'
else
  BOLD=""; RED=""; GREEN=""; YELLOW=""; RESET=""
fi
info()  { printf '%s==>%s %s\n' "$GREEN" "$RESET" "$*"; }
warn()  { printf '%s!! %s%s\n' "$YELLOW" "$*" "$RESET"; }
die()   { printf '%serreur:%s %s\n' "$RED" "$RESET" "$*" >&2; exit 1; }
run()   { if [ "${DRY_RUN:-0}" = "1" ]; then printf '   [dry-run] %s\n' "$*"; else eval "$@"; fi; }

# --- Arguments --------------------------------------------------------------
COMMIT_MSG="${1:-}"

# Ancienne signature : ./deploy.sh <fichier.html> [message]. On refuse
# explicitement, sinon le message de commit deviendrait un chemin de fichier
# et l'utilisateur croirait avoir publié un HTML qui n'a jamais été lu.
case "$COMMIT_MSG" in
  *.html|*.htm)
    die "cette version de deploy.sh ne prend plus de fichier HTML en argument.

index.html est désormais GÉNÉRÉ depuis src/template.html + data/kadyrov-data.json.
Pour publier une modification :
  1. éditer src/template.html (rendu) ou data/kadyrov-data.json (données)
  2. ./deploy.sh \"message de commit\"

Pour publier malgré tout un HTML produit ailleurs, l'installer à la main
(cp fichier.html index.html) en sachant que src/ et data/ ne décriront
alors plus ce qui est en ligne."
    ;;
esac

# --- Validations de base ----------------------------------------------------
[ -d .git ] || die "ce script doit être lancé depuis le dépôt git (.git introuvable)."

command -v node >/dev/null 2>&1 || die "node est introuvable dans le PATH (requis par scripts/build.mjs)."

for f in scripts/build.mjs src/template.html data/kadyrov-data.json; do
  [ -f "$f" ] || die "fichier source manquant : $f"
done

# Le JSON doit être valide avant de lancer quoi que ce soit : un JSON cassé
# ferait échouer le build à mi-chemin, après l'archivage.
if [ "${DRY_RUN:-0}" != "1" ]; then
  node -e 'JSON.parse(require("fs").readFileSync("data/kadyrov-data.json","utf8"))' \
    || die "data/kadyrov-data.json n'est pas un JSON valide."
fi

# --- Sauvegarde de la version actuelle (avant régénération) -----------------
# On garde une copie temporaire pour pouvoir (a) comparer l'avant/après et
# (b) l'archiver seulement si le build a réellement changé quelque chose.
PREV_TMP=""
if [ -f index.html ]; then
  PREV_TMP="$(mktemp "${TMPDIR:-/tmp}/index-prev.XXXXXX.html")"
  cp index.html "$PREV_TMP"
fi
cleanup() { [ -n "$PREV_TMP" ] && rm -f "$PREV_TMP" || true; }
trap cleanup EXIT

# --- Régénération ------------------------------------------------------------
info "régénération de index.html depuis src/ + data/"
run "node scripts/build.mjs"

if [ "${DRY_RUN:-0}" = "1" ]; then
  info "DRY_RUN=1 — arrêt avant vérification, archivage, commit et push."
  exit 0
fi

# --- Vérifications du fichier généré ----------------------------------------
[ -f index.html ] || die "le build n'a produit aucun index.html."

OUT_SIZE=$(wc -c < index.html | tr -d ' ')
[ "$OUT_SIZE" -gt 1000 ] || die "index.html généré suspicieusement petit (${OUT_SIZE} octets)."

head -c 512 index.html | grep -qi '<!DOCTYPE html\|<html' \
  || die "index.html généré ne ressemble pas à un document HTML."

grep -q 'FICHIER GÉNÉRÉ' index.html \
  || die "le bandeau « fichier généré » est absent de index.html — build anormal."

# --- Rien à publier ? --------------------------------------------------------
# On compare le fichier régénéré à la version précédente ET on vérifie les
# sources : une modification de src/ ou data/ qui ne changerait pas la sortie
# reste à committer.
if [ -n "$PREV_TMP" ] && cmp -s index.html "$PREV_TMP" && git diff --quiet -- data src scripts; then
  warn "index.html régénéré est identique et aucune source n'a changé — rien à déployer."
  exit 0
fi

# --- Archivage de la version précédente -------------------------------------
ARCHIVE=""
if [ -n "$PREV_TMP" ] && ! cmp -s index.html "$PREV_TMP" && [ "${NO_ARCHIVE:-0}" != "1" ]; then
  STAMP="$(date +%Y%m%d)"
  ARCHIVE="index-archive-${STAMP}.html"
  # Si une archive du jour existe déjà, on suffixe avec l'heure.
  if [ -e "$ARCHIVE" ]; then
    ARCHIVE="index-archive-${STAMP}-$(date +%H%M%S).html"
  fi
  info "archivage de la version précédente → ${ARCHIVE}"
  cp "$PREV_TMP" "$ARCHIVE"
fi

info "index.html régénéré (${OUT_SIZE} octets)"

# --- Commit -----------------------------------------------------------------
if [ -z "$COMMIT_MSG" ]; then
  COMMIT_MSG="maj carto ($(date +%Y-%m-%d))"
fi

info "commit : ${COMMIT_MSG}"
# On commite les sources en même temps que le fichier généré : les trois
# doivent rester cohérents dans l'historique.
run "git add index.html data src scripts ${ARCHIVE:+'$ARCHIVE'}"

if git diff --cached --quiet; then
  warn "aucune modification indexée — rien à committer."
  exit 0
fi
run "git commit -m '$COMMIT_MSG'"

# --- Push -------------------------------------------------------------------
if [ "${NO_PUSH:-0}" = "1" ]; then
  info "NO_PUSH=1 — commit local uniquement, push ignoré."
  exit 0
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
info "push vers origin/${BRANCH}"

# Push avec retries (backoff exponentiel) en cas d'erreur réseau.
attempt=1; delay=2; max=4
until run "git push -u origin '$BRANCH'"; do
  if [ "$attempt" -ge "$max" ]; then
    die "échec du push après ${max} tentatives."
  fi
  warn "push échoué (tentative ${attempt}/${max}) — nouvelle tentative dans ${delay}s…"
  sleep "$delay"
  attempt=$((attempt + 1)); delay=$((delay * 2))
done

info "${BOLD}Déploiement terminé.${RESET}"
info "Carte en ligne : https://ramzandoukaiev-code.github.io/Kadyrov-CD-Map/"
