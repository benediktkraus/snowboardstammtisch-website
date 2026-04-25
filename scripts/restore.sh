#!/usr/bin/env bash
# restore-sbi-kv.sh — Restore Cloudflare KV from backup
# Usage: restore-sbi-kv.sh [backup-dir]
# Example: restore-sbi-kv.sh /mnt/onedrive/Workspace/backups/sbi-kv/2026-04-25

set -euo pipefail

ACCOUNT_ID="260f0b11d491b5cb746f356a76611e31"
NAMESPACE_ID="2b345e290d7d46468c9c8a299cceb92d"
CF_BASE="https://api.cloudflare.com/client/v4"

# --- Args ---------------------------------------------------------------------
BACKUP_DIR="${1:-}"
if [[ -z "$BACKUP_DIR" ]]; then
  # Default to latest backup
  BACKUP_ROOT="/mnt/onedrive/Workspace/backups/sbi-kv"
  BACKUP_DIR=$(ls -d "${BACKUP_ROOT}"/*/  2>/dev/null | sort -r | head -1 | sed 's:/$::')
  if [[ -z "$BACKUP_DIR" ]]; then
    echo "ERROR: No backup found in ${BACKUP_ROOT}" >&2
    exit 1
  fi
  echo "Using latest backup: ${BACKUP_DIR}"
fi

if [[ ! -f "${BACKUP_DIR}/manifest.json" ]]; then
  echo "ERROR: No manifest.json in ${BACKUP_DIR}" >&2
  exit 1
fi

# --- Load secrets -------------------------------------------------------------
source /mnt/onedrive/Workspace/secrets/moltbot.env
if [[ -z "${CF_API_KEY:-}" ]]; then
  echo "ERROR: CF_API_KEY not set" >&2
  exit 1
fi

# --- Parse manifest -----------------------------------------------------------
KEY_COUNT=$(python3 -c "import json; d=json.load(open('${BACKUP_DIR}/manifest.json')); print(len(d['keys']))")
echo ""
echo "=== SBI KV Restore ==="
echo "Source:  ${BACKUP_DIR}"
echo "Keys:   ${KEY_COUNT}"
echo ""

# --- Confirm ------------------------------------------------------------------
read -p "Restore ${KEY_COUNT} keys to KV namespace ${NAMESPACE_ID}? (yes/no): " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo "Aborted."
  exit 0
fi

# --- Restore ------------------------------------------------------------------
RESTORED=0
FAILED=0

urlencode() {
  python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$1"
}

while IFS= read -r entry; do
  KEY_NAME=$(echo "$entry" | python3 -c "import json,sys; print(json.load(sys.stdin)['key'])")
  FILENAME=$(echo "$entry" | python3 -c "import json,sys; print(json.load(sys.stdin)['file'])")
  FILE_TYPE=$(echo "$entry" | python3 -c "import json,sys; print(json.load(sys.stdin)['type'])")
  FILEPATH="${BACKUP_DIR}/${FILENAME}"

  if [[ ! -f "$FILEPATH" ]]; then
    echo "  SKIP  ${KEY_NAME} — file not found: ${FILENAME}"
    FAILED=$((FAILED + 1))
    continue
  fi

  ENCODED_KEY=$(urlencode "$KEY_NAME")
  URL="${CF_BASE}/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${NAMESPACE_ID}/values/${ENCODED_KEY}"

  if [[ "$FILE_TYPE" == "jpg" ]]; then
    # Binary upload
    HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" \
      -X PUT \
      -H "Authorization: Bearer ${CF_API_KEY}" \
      -H "Content-Type: application/octet-stream" \
      --data-binary "@${FILEPATH}" \
      "$URL")
  else
    # Text/JSON upload
    HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" \
      -X PUT \
      -H "Authorization: Bearer ${CF_API_KEY}" \
      -H "Content-Type: text/plain" \
      --data-binary "@${FILEPATH}" \
      "$URL")
  fi

  if [[ "$HTTP_CODE" == "200" ]]; then
    echo "  OK    ${KEY_NAME}"
    RESTORED=$((RESTORED + 1))
  else
    echo "  FAIL  ${KEY_NAME} — HTTP ${HTTP_CODE}"
    FAILED=$((FAILED + 1))
  fi

done < <(python3 -c "
import json, sys
manifest = json.load(open('${BACKUP_DIR}/manifest.json'))
for entry in manifest['keys']:
    print(json.dumps(entry))
")

echo ""
echo "=== Summary ==="
echo "  Restored: ${RESTORED}"
echo "  Failed:   ${FAILED}"

if [[ "$FAILED" -gt 0 ]]; then
  exit 2
fi
exit 0
