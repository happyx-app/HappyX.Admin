#!/bin/sh
# Runs before nginx starts: without the admin key every page would fail with 401.
if [ -z "${ADMIN_API_KEY:-}" ]; then
    echo "ADMIN_API_KEY is required: the key whose SHA-256 is ADMIN_KEY_HASH in HappyX.Api" >&2
    exit 1
fi
