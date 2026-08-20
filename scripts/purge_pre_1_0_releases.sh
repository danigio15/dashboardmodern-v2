#!/usr/bin/env bash
# Pulizia delle release e dei tag vecchi su GitHub.
#
# Serve a ridurre la pagina Releases a quello che vuoi mostrare davvero: per
# impostazione predefinita resta solo `v1.0.0`, ma `--keep` è ripetibile, quindi
# la pulizia si può fare a tappe (prima le beta, poi le rc, e così via).
#
# Lo script è in DRY-RUN per impostazione predefinita: senza `--apply` non tocca
# nulla, stampa soltanto cosa farebbe.
#
#   # anteprima della pulizia completa (resta solo v1.0.0)
#   ./scripts/purge_pre_1_0_releases.sh
#
#   # prima tappa: via v0.15.25 e tutte le beta, restano le rc
#   ./scripts/purge_pre_1_0_releases.sh \
#     --keep v1.0.0-rc.1 --keep v1.0.0-rc.2 --keep v1.0.0-rc.3 --apply
#
#   # tappa finale, dopo aver pubblicato la 1.0.0
#   ./scripts/purge_pre_1_0_releases.sh --apply
#
# Con --yes non chiede conferma: lo usa il workflow "Pulizia release".
#
# L'operazione è IRREVERSIBILE sul remoto. Prima di cancellare, le note di ogni
# release vengono salvate in docs/archive/releases-pre-1.0.json: la cronologia
# dei contenuti resta comunque nei commit e in docs/CHANGELOG_PRE_1.0.md.

set -euo pipefail

REPO="${REPO:-danigio15/dashboardmodern-v2}"
KEEP=()
APPLY=0
ALLOW_NO_STABLE=0
ASSUME_YES=0
ARCHIVE="docs/archive/releases-pre-1.0.json"

while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1 ;;
    --keep) KEEP+=("${2:?--keep richiede un tag}"); shift ;;
    --repo) REPO="${2:?--repo richiede owner/nome}"; shift ;;
    --archive) ARCHIVE="${2:?--archive richiede un percorso}"; shift ;;
    --allow-no-stable) ALLOW_NO_STABLE=1 ;;
    --yes) ASSUME_YES=1 ;;
    -h|--help) sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Opzione sconosciuta: $1" >&2; exit 2 ;;
  esac
  shift
done

# Senza --keep si conserva solo la 1.0.0: è la pulizia finale.
[ "${#KEEP[@]}" -gt 0 ] || KEEP=("v1.0.0")

command -v gh >/dev/null 2>&1 || { echo "Serve la CLI 'gh' autenticata (gh auth login)." >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "'gh' non è autenticato: esegui 'gh auth login'." >&2; exit 1; }

is_kept() {
  local tag="$1" k
  for k in "${KEEP[@]}"; do [ "$tag" = "$k" ] && return 0; done
  return 1
}

# Tutto ciò che appartiene alla numerazione pre-1.0 e non è stato messo al
# riparo con --keep. Un tag futuro (1.0.1, 1.1.0…) non corrisponde ai pattern.
is_purgeable() {
  is_kept "$1" && return 1
  case "$1" in
    v0.*|0.*) return 0 ;;
    v1.0.0-beta.*|1.0.0-beta.*) return 0 ;;
    v1.0.0-rc.*|1.0.0-rc.*) return 0 ;;
    v1.0.0|1.0.0) return 1 ;;
    *) return 1 ;;
  esac
}

echo "Repository : $REPO"
echo "Conservo   : ${KEEP[*]}"
if [ "$APPLY" -eq 1 ]; then echo "Modalità   : ESECUZIONE (irreversibile)"; else echo "Modalità   : anteprima (nessuna modifica)"; fi
echo

mapfile -t RELEASE_ROWS < <(gh release list --repo "$REPO" --limit 500 --json tagName,isPrerelease --jq '.[] | "\(.tagName)\t\(.isPrerelease)"')
mapfile -t TAGS < <(git ls-remote --tags "https://github.com/$REPO.git" | sed 's#.*refs/tags/##' | grep -v '\^{}$' | sort -V)

targets_releases=()
survivors_stable=0
for row in "${RELEASE_ROWS[@]:-}"; do
  [ -n "$row" ] || continue
  tag="${row%%$'\t'*}"
  pre="${row##*$'\t'}"
  if is_purgeable "$tag"; then
    targets_releases+=("$tag")
  elif [ "$pre" = "false" ]; then
    survivors_stable=$((survivors_stable + 1))
  fi
done

targets_tags=()
for tag in "${TAGS[@]:-}"; do
  [ -n "$tag" ] && is_purgeable "$tag" && targets_tags+=("$tag")
done

echo "Release da eliminare: ${#targets_releases[@]}"
printf '  %s\n' "${targets_releases[@]:-(nessuna)}"
echo
echo "Tag da eliminare: ${#targets_tags[@]}"
printf '  %s\n' "${targets_tags[@]:-(nessuno)}"
echo

# Una repository senza nessuna release stabile è una repository che HACS non sa
# proporre a chi non ha attivato "Show beta versions": le pre-release, da sole,
# non bastano. È il motivo per cui v0.15.25 non va tolta finché la 1.0.0 non è
# pubblicata.
if [ "$survivors_stable" -eq 0 ]; then
  echo "⚠️  Dopo questa pulizia NON resterebbe nessuna release stabile:"
  echo "    chi installa da HACS senza 'Show beta versions' non vedrebbe più"
  echo "    nessuna versione. Pubblica prima la 1.0.0, oppure ripeti con"
  echo "    --allow-no-stable se sai cosa stai facendo."
  echo
  [ "$ALLOW_NO_STABLE" -eq 1 ] || exit 1
fi

if [ "$APPLY" -eq 0 ]; then
  echo "Anteprima terminata. Rilancia con --apply per eseguire."
  exit 0
fi

if [ "${#targets_releases[@]}" -eq 0 ] && [ "${#targets_tags[@]}" -eq 0 ]; then
  echo "Niente da fare."
  exit 0
fi

# --yes serve al workflow GitHub Actions, che non ha un terminale a cui chiedere.
if [ "$ASSUME_YES" -eq 0 ]; then
  read -r -p "Digita ELIMINA per procedere: " confirm
  [ "$confirm" = "ELIMINA" ] || { echo "Annullato."; exit 1; }
fi

# Archivio delle note prima della cancellazione.
mkdir -p "$(dirname "$ARCHIVE")"
{
  echo "["
  first=1
  for tag in "${targets_releases[@]}"; do
    [ "$first" -eq 1 ] || echo ","
    first=0
    gh release view "$tag" --repo "$REPO" --json tagName,name,publishedAt,isPrerelease,body
  done
  echo "]"
} > "$ARCHIVE"
echo "Note archiviate in $ARCHIVE"
echo

for tag in "${targets_releases[@]}"; do
  echo "· release $tag"
  gh release delete "$tag" --repo "$REPO" --yes --cleanup-tag || echo "  (già rimossa)"
done

# `--cleanup-tag` copre i tag che avevano una release; questi sono quelli rimasti
# (tag spinti senza release, o release cancellate in precedenza a mano).
for tag in "${targets_tags[@]}"; do
  if git ls-remote --exit-code --tags "https://github.com/$REPO.git" "refs/tags/$tag" >/dev/null 2>&1; then
    echo "· tag $tag"
    gh api -X DELETE "repos/$REPO/git/refs/tags/$tag" >/dev/null || echo "  (già rimosso)"
  fi
done

echo
echo "Fatto. Ripulisci anche i tag locali:  git fetch --prune --prune-tags origin"
