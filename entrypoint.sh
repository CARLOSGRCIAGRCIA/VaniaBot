# entrypoint.sh
#!/bin/sh
set -e

if [ -d "/app/vaniasession" ] && [ ! -w "/app/vaniasession" ]; then
  echo "⚠️  Corrigiendo permisos de vaniasession..."
fi

exec "$@"