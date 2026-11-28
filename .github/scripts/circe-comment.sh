#!/usr/bin/env bash
set -euo pipefail
: "${CIRCE_REPOSITORY:?}" "${CIRCE_PR_NUMBER:?comment requires a pull_request event}"
marker='<!-- circe-release-recommendation -->'
body_file=$(mktemp "${RUNNER_TEMP:?}/circe-comment.XXXXXX")
trap 'rm -f "$body_file"' EXIT
{
  printf '%s\n## circe release recommendation\n\n' "$marker"
  if [[ "$CIRCE_RECOMMENDED" == true ]]; then
    printf '**Release recommended.**\n\n'
  else
    printf '**No release recommended.**\n\n'
  fi
  printf '%s' "$CIRCE_CHANGES" | jq -r --arg repo "$CIRCE_REPOSITORY" '.[] | "- `\(.type)`: [\(.sha[0:7])](https://github.com/\($repo)/commit/\(.sha))"'
  printf '\nBased on Dependabot commit scopes; this does not evaluate features, fixes, or security impact.\n'
} > "$body_file"
payload=$(jq -Rs '{body: .}' < "$body_file")
comment_id=$(gh api --paginate "repos/$CIRCE_REPOSITORY/issues/$CIRCE_PR_NUMBER/comments" \
  --jq '.[] | select(.user.login == "github-actions[bot]") | select(.body | startswith("<!-- circe-release-recommendation -->")) | .id' | head -n 1)
if [[ -n "$comment_id" ]]; then
  printf '%s' "$payload" | gh api --method PATCH "repos/$CIRCE_REPOSITORY/issues/comments/$comment_id" --input - --silent
else
  printf '%s' "$payload" | gh api --method POST "repos/$CIRCE_REPOSITORY/issues/$CIRCE_PR_NUMBER/comments" --input - --silent
fi
