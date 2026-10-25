#!/bin/sh
# Runs before nginx starts. Without the admin key the API refuses every request, and the
# dashboard shows how to fix it; say so in the logs too.
if [ -z "${ADMIN_API_KEY:-}" ]; then
    echo "WARNING: ADMIN_API_KEY is not set: the dashboard can't load any data. Set it to the key whose SHA-256 is ADMIN_KEY_HASH in HappyX.Api" >&2
fi
