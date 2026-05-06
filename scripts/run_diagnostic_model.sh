#!/usr/bin/env bash
set -euo pipefail

MODEL="${1:-gpt-5}"
PROMPT="${2:-Please analyze the recent CI failure and suggest fixes. Provide a short actionable patch if possible.}"
OUTFILE="/tmp/model_response.json"

if [ -z "${ACTIONS_MONITOR_PAT:-}" ]; then
  echo "ERROR: ACTIONS_MONITOR_PAT environment variable is not set. Please add it as a repository secret (name: ACTIONS_MONITOR_PAT) and pass it to the workflow step." >&2
  exit 2
fi

echo "Calling model=$MODEL"

# Basic OpenAI-compatible chat completion call. Adjust URL/provider if needed.
curl -sS -X POST "https://api.openai.com/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ACTIONS_MONITOR_PAT}" \
  -d @- > "$OUTFILE" <<JSON
{
  "model": "${MODEL}",
  "messages": [{"role":"system","content":"You are a helpful CI diagnostic assistant."},{"role":"user","content": ${PROMPT@Q}}],
  "max_tokens": 800
}
JSON

if [ ! -s "$OUTFILE" ]; then
  echo "No response from model API" >&2
  exit 3
fi

# Print response and extract usage if available
cat "$OUTFILE"

if command -v jq >/dev/null 2>&1; then
  USAGE=$(jq '.usage // {}' "$OUTFILE") || true
  echo "--- model usage ---"
  echo "$USAGE"
fi

exit 0
