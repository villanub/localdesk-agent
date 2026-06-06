#!/bin/sh
set -e

CONFIG_FILE="/app/data/.agent-config.json"

# Run setup.js automatically if agent config doesn't exist yet
if [ ! -f "$CONFIG_FILE" ]; then
  echo "🔧 No agent config found — running setup.js..."
  if [ -z "$NAPSTER_API_KEY" ]; then
    echo "❌ NAPSTER_API_KEY is not set. Copy .env.example to .env and add your key."
    exit 1
  fi
  node setup.js --config-path "$CONFIG_FILE"
  echo "✅ Agent setup complete."
else
  echo "✅ Agent config found, skipping setup."
fi

exec node server.js
