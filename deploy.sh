#!/bin/bash
set -e

VERSION="${1:-v6.12.2}"

echo ">>> [1/6] Creando red..."
docker network create vania-network 2>/dev/null || echo "Red ya existe"

echo ">>> [2/6] Creando volúmenes..."
for vol in vaniabot_session vaniabot_subbots vaniabot_database vaniabot_temp vania-redis-data; do
  docker volume create $vol 2>/dev/null || echo "Volumen $vol ya existe"
done

echo ">>> [3/6] Deteniendo contenedores anteriores..."
docker rm -f vaniabot vania-redis 2>/dev/null || true

echo ">>> [4/6] Levantando Redis..."
docker run -d \
  --name vania-redis \
  --network vania-network \
  --restart unless-stopped \
  -v vania-redis-data:/data \
  redis:7-alpine \
  redis-server --appendonly yes

echo ">>> [5/6] Verificando Redis..."
max_attempts=30
attempt=0
until docker exec vania-redis redis-cli ping 2>/dev/null | grep -q PONG; do
  attempt=$((attempt + 1))
  if [ $attempt -ge $max_attempts ]; then
    echo "❌ Redis no respondió después de $max_attempts segundos"
    exit 1
  fi
  echo "Esperando Redis... ($attempt/$max_attempts)"
  sleep 1
done
echo "Redis OK ✓"

echo ">>> [6/6] Levantando VaniaBot ($VERSION)..."
docker run -d \
  --name vaniabot \
  --network vania-network \
  --restart unless-stopped \
  --env-file .env \
  -e NODE_ENV=production \
  -e TZ=America/Mexico_City \
  -e AUTH_MODE=${AUTH_MODE:-qr} \
  -e DOCKER_MODE=true \
  -e USE_REDIS=true \
  -e REDIS_HOST=vania-redis \
  -e REDIS_PORT=6379 \
  -e SESSION_PATH=/app/vaniasession \
  -v vaniabot_session:/app/vaniasession \
  -v vaniabot_subbots:/app/data/subbot-sessions \
  -v vaniabot_database:/app/data \
  -v vaniabot_temp:/app/data/temp \
  --memory=1g \
  --cpus=1.5 \
  --stop-signal=SIGTERM \
  --stop-timeout=15 \
  ghcr.io/carlosgrciagrcia/vaniabot:$VERSION

echo ""
echo "✓ Desplegado con $VERSION. Logs: docker logs -f vaniabot"