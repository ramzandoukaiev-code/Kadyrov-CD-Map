#!/usr/bin/env bash
#
# deploy.sh — Publie une nouvelle version de la carte Kadyrov (fichier HTML
# autonome) sur GitHub Pages.
#
# Le site est un unique fichier `index.html` servi par GitHub Pages. Ce script
# archive la version en ligne actuelle (avec un horodatage), installe le
# nouveau fichier standalone à sa place, puis commit et push.
#
# Usage :
#   ./deploy.sh <nouveau-fichier.html> [message de commit]
#
# Exemples :
#   ./deploy.sh Carte_Reseaux_Kadyrov_standalone.html
#   ./deploy.sh ~/Downloads/carte.html "maj carto : ajout fiche X"
#
# Options (variables d'environnement) :
#   NO_ARCHIVE=1   Ne pas archiver l'index.html actuel
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
SRC="${1:-}"
COMMIT_MSG="${2:-}"

[ -n "$SRC" ] || die "aucun fichier source fourni.

Usage : ./deploy.sh <nouveau-fichier.html> [message de commit]"

[ -f "$SRC" ] || die "fichier introuvable : $SRC"

# --- Validations de base ----------------------------------------------------
[ -d .git ] || die "ce script doit être lancé depuis le dépôt git (.git introuvable)."

# Vérifie que le fichier ressemble bien à une page HTML autonome.
if ! head -c 512 "$SRC" | grep -qi '<!DOCTYPE html\|<html'; then
  die "le fichier source ne ressemble pas à un document HTML : $SRC"
fi

SRC_SIZE=$(wc -c < "$SRC" | tr -d ' ')
[ "$SRC_SIZE" -gt 1000 ] || die "fichier source suspicieusement petit (${SRC_SIZE} octets)."

# --- Fichier identique ? ----------------------------------------------------
if [ -f index.html ] && cmp -s "$SRC" index.html; then
  warn "le fichier source est identique à index.html — rien à déployer."
  exit 0
fi

# --- Archivage de la version actuelle ---------------------------------------
if [ -f index.html ] && [ "${NO_ARCHIVE:-0}" != "1" ]; then
  STAMP="$(date +%Y%m%d)"
  ARCHIVE="index-archive-${STAMP}.html"
  # Si une archive du jour existe déjà, on suffixe avec l'heure.
  if [ -e "$ARCHIVE" ]; then
    ARCHIVE="index-archive-${STAMP}-$(date +%H%M%S).html"
  fi
  info "archivage de l'index.html actuel → ${ARCHIVE}"
  run "cp index.html '$ARCHIVE'"
else
  ARCHIVE=""
fi

# --- Installation du nouveau fichier ----------------------------------------
info "installation du nouveau fichier → index.html (${SRC_SIZE} octets)"
run "cp '$SRC' index.html"

# --- Commit -----------------------------------------------------------------
if [ -z "$COMMIT_MSG" ]; then
  COMMIT_MSG="maj carto ($(date +%Y-%m-%d))"
fi

info "commit : ${COMMIT_MSG}"
run "git add index.html ${ARCHIVE:+'$ARCHIVE'}"

if [ "${DRY_RUN:-0}" != "1" ]; then
  if git diff --cached --quiet; then
    warn "aucune modification indexée — rien à committer."
    exit 0
  fi
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
