#!/usr/bin/env bash
# backup-sbi-kv.sh — Cloudflare KV backup for snowboardstammtisch-website
# KV Namespace: 2b345e290d7d46468c9c8a299cceb92d
# Account:      260f0b11d491b5cb746f356a76611e31

set -euo pipefail

# --- Config -------------------------------------------------------------------
ACCOUNT_ID="260f0b11d491b5cb746f356a76611e31"
NAMESPACE_ID="2b345e290d7d46468c9c8a299cceb92d"
BACKUP_ROOT="/mnt/onedrive/Workspace/backups/sbi-kv"
CF_BASE="https://api.cloudflare.com/client/v4"

# --- Load secrets -------------------------------------------------------------
SECRETS_FILE="/mnt/onedrive/Workspace/secrets/moltbot.env"
if [[ ! -f "$SECRETS_FILE" ]]; then
  echo "ERROR: Secrets file not found: $SECRETS_FILE" >&2
  exit 1
fi
# shellcheck source=/dev/null
source "$SECRETS_FILE"

if [[ -z "${CF_API_KEY:-}" ]]; then
  echo "ERROR: CF_API_KEY not set after sourcing secrets" >&2
  exit 1
fi

# --- Setup backup dir ---------------------------------------------------------
TODAY="$(date +%Y-%m-%d)"
BACKUP_DIR="${BACKUP_ROOT}/${TODAY}"
mkdir -p "$BACKUP_DIR"

echo "=== SBI KV Backup — ${TODAY} ==="
echo "Target: ${BACKUP_DIR}"

# --- Helpers ------------------------------------------------------------------
cf_get() {
  # $1 = URL, $2 = output file, $3 = binary flag (1 = binary)
  local url="$1"
  local outfile="$2"
  local binary="${3:-0}"

  if [[ "$binary" -eq 1 ]]; then
    curl -sf \
      -H "Authorization: Bearer ${CF_API_KEY}" \
      -H "Accept: */*" \
      --output "$outfile" \
      "$url"
  else
    curl -sf \
      -H "Authorization: Bearer ${CF_API_KEY}" \
      -H "Content-Type: application/json" \
      --output "$outfile" \
      "$url"
  fi
}

urlencode() {
  # URL-encode a string (handles colons, slashes, spaces)
  python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$1"
}

# --- Step 1: List all keys ----------------------------------------------------
echo ""
echo "[1/3] Listing keys in namespace..."

KEYS_RESPONSE=$(curl -sf \
  -H "Authorization: Bearer ${CF_API_KEY}" \
  -H "Content-Type: application/json" \
  "${CF_BASE}/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${NAMESPACE_ID}/keys?limit=1000")

# Validate response
SUCCESS=$(echo "$KEYS_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('success','false'))")
if [[ "$SUCCESS" != "True" && "$SUCCESS" != "true" ]]; then
  echo "ERROR: CF API returned failure:" >&2
  echo "$KEYS_RESPONSE" | python3 -m json.tool >&2
  exit 1
fi

# Extract key names and metadata
KEY_COUNT=$(echo "$KEYS_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('result',[])))")
echo "  Found ${KEY_COUNT} keys"

# Save raw key list for manifest building
echo "$KEYS_RESPONSE" > "${BACKUP_DIR}/.keys-raw.json"

# --- Step 2: Download each key ------------------------------------------------
echo ""
echo "[2/3] Downloading values..."

BACKED_UP=0
SKIPPED=0
FAILED=0
MANIFEST_ENTRIES="[]"

while IFS= read -r key_json; do
  KEY_NAME=$(echo "$key_json" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['name'])")
  KEY_EXPIRATION=$(echo "$key_json" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('expiration',''))" 2>/dev/null || echo "")
  KEY_META=$(echo "$key_json" | python3 -c "import json,sys; d=json.load(sys.stdin); print(json.dumps(d.get('metadata',{})))" 2>/dev/null || echo "{}")

  # Determine file extension: photo:* keys are binary JPEGs
  if [[ "$KEY_NAME" == photo:* ]]; then
    FILE_TYPE="jpg"
    IS_BINARY=1
  else
    FILE_TYPE="json"
    IS_BINARY=0
  fi

  # Sanitize key name for filesystem: replace : and / with _
  SAFE_NAME=$(echo "$KEY_NAME" | sed 's/[:/]/_/g')
  OUT_FILE="${BACKUP_DIR}/${SAFE_NAME}.${FILE_TYPE}"

  # Idempotency: skip if file exists and size > 0
  if [[ -f "$OUT_FILE" && -s "$OUT_FILE" ]]; then
    # Get existing file size
    EXISTING_SIZE=$(stat -c%s "$OUT_FILE" 2>/dev/null || echo 0)
    if [[ "$EXISTING_SIZE" -gt 0 ]]; then
      echo "  SKIP  ${KEY_NAME} (${EXISTING_SIZE} bytes already on disk)"
      SKIPPED=$((SKIPPED + 1))

      # Still add to manifest
      ENTRY=$(python3 -c "
import json, os
print(json.dumps({
  'key': '${KEY_NAME}',
  'file': os.path.basename('${OUT_FILE}'),
  'type': '${FILE_TYPE}',
  'size': ${EXISTING_SIZE},
  'status': 'skipped',
  'metadata': ${KEY_META}
}))
")
      MANIFEST_ENTRIES=$(echo "$MANIFEST_ENTRIES" | python3 -c "
import json,sys
entries = json.load(sys.stdin)
entries.append(json.loads('$(echo "$ENTRY" | sed "s/'/'\\\\''/g")'))
print(json.dumps(entries))
")
      continue
    fi
  fi

  # URL-encode the key name for the API call
  ENCODED_KEY=$(urlencode "$KEY_NAME")
  VALUE_URL="${CF_BASE}/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${NAMESPACE_ID}/values/${ENCODED_KEY}"

  # Download
  TEMP_FILE="${OUT_FILE}.tmp"
  if cf_get "$VALUE_URL" "$TEMP_FILE" "$IS_BINARY"; then
    # Validate non-empty
    if [[ ! -s "$TEMP_FILE" ]]; then
      echo "  WARN  ${KEY_NAME} — empty response, skipping"
      rm -f "$TEMP_FILE"
      FAILED=$((FAILED + 1))
      continue
    fi

    # For JSON files, pretty-print if valid JSON
    if [[ "$IS_BINARY" -eq 0 ]]; then
      if python3 -m json.tool "$TEMP_FILE" > "${TEMP_FILE}.pretty" 2>/dev/null; then
        mv "${TEMP_FILE}.pretty" "$OUT_FILE"
        rm -f "$TEMP_FILE"
      else
        # Not valid JSON (plain text value) — keep as-is
        mv "$TEMP_FILE" "$OUT_FILE"
      fi
    else
      mv "$TEMP_FILE" "$OUT_FILE"
    fi

    FILE_SIZE=$(stat -c%s "$OUT_FILE")
    echo "  OK    ${KEY_NAME} -> $(basename "$OUT_FILE") (${FILE_SIZE} bytes)"
    BACKED_UP=$((BACKED_UP + 1))

    ENTRY=$(python3 -c "
import json, os
print(json.dumps({
  'key': '${KEY_NAME}',
  'file': os.path.basename('${OUT_FILE}'),
  'type': '${FILE_TYPE}',
  'size': ${FILE_SIZE},
  'status': 'backed_up',
  'metadata': ${KEY_META}
}))
")
    MANIFEST_ENTRIES=$(echo "$MANIFEST_ENTRIES" | python3 -c "
import json,sys
entries = json.load(sys.stdin)
entries.append(json.loads('$(echo "$ENTRY" | sed "s/'/'\\\\''/g")'))
print(json.dumps(entries))
")
  else
    echo "  FAIL  ${KEY_NAME} — curl error $?"
    rm -f "$TEMP_FILE" "${TEMP_FILE}.pretty"
    FAILED=$((FAILED + 1))
  fi

done < <(echo "$KEYS_RESPONSE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for item in data.get('result', []):
    print(json.dumps(item))
")

# --- Step 3: Write manifest ---------------------------------------------------
echo ""
echo "[3/3] Writing manifest.json..."

python3 -c "
import json, sys
from datetime import datetime

entries = json.loads(sys.argv[1])
manifest = {
    'backup_date': '${TODAY}',
    'timestamp': datetime.now(datetime.UTC).isoformat().replace('+00:00', 'Z'),
    'account_id': '${ACCOUNT_ID}',
    'namespace_id': '${NAMESPACE_ID}',
    'total_keys': ${KEY_COUNT},
    'backed_up': ${BACKED_UP},
    'skipped': ${SKIPPED},
    'failed': ${FAILED},
    'keys': entries
}
print(json.dumps(manifest, indent=2))
" "$MANIFEST_ENTRIES" > "${BACKUP_DIR}/manifest.json"

# Clean up raw key dump
rm -f "${BACKUP_DIR}/.keys-raw.json"

# --- Summary ------------------------------------------------------------------
echo ""
echo "=== Summary ============================================"
echo "  Backup dir : ${BACKUP_DIR}"
echo "  Total keys : ${KEY_COUNT}"
echo "  Backed up  : ${BACKED_UP}"
echo "  Skipped    : ${SKIPPED} (already on disk)"
echo "  Failed     : ${FAILED}"
echo "  Manifest   : ${BACKUP_DIR}/manifest.json"
echo "========================================================"

if [[ "$FAILED" -gt 0 ]]; then
  echo "WARNING: ${FAILED} key(s) failed to download." >&2
  exit 2
fi

exit 0
