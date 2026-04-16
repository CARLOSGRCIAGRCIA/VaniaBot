#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
WHITE='\033[0;37m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

VERSION="${1:-v6.12.2}"
IMAGE="ghcr.io/carlosgrciagrcia/vaniabot:$VERSION"

ok()   { echo -e "  ${GREEN}✔${NC}  $1"; }
info() { echo -e "  ${DIM}↳  $1${NC}"; }
fail() { echo -e "\n  ${RED}✘  $1${NC}\n"; exit 1; }

typewrite() {
  local text="$1"
  local delay="${2:-0.02}"
  for ((c=0; c<${#text}; c++)); do
    printf "%s" "${text:$c:1}"
    sleep $delay
  done
}

step() {
  local num="$1"
  local label="$2"
  local total=8

  local colors=("$CYAN" "$BLUE" "$MAGENTA" "$YELLOW" "$GREEN" "$CYAN" "$BLUE" "$MAGENTA")
  local color="${colors[$((num-1))]}"

  local filled=$(( (num * 20) / total ))
  local empty=$(( 20 - filled ))
  local bar=""
  for ((i=0; i<filled; i++));  do bar+="█"; done
  for ((i=0; i<empty; i++));   do bar+="░"; done

  echo ""
  printf "  ${color}${BOLD}"
  typewrite "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" 0.003
  printf "${NC}\n"
  printf "  ${color}${BOLD}◈  [$num/$total]${NC}  ${BOLD}"
  typewrite "$label" 0.025
  printf "${NC}\n"
  echo -e "  ${DIM}Progreso${NC}  ${color}${bar}${NC}  ${DIM}$((num * 100 / total))%${NC}"
  printf "  ${color}${BOLD}"
  typewrite "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" 0.003
  printf "${NC}\n\n"
  sleep 0.1
}

animate_banner() {
  clear
  local lines=(
    "  ██╗   ██╗ █████╗ ███╗   ██╗██╗ █████╗ "
    "  ██║   ██║██╔══██╗████╗  ██║██║██╔══██╗"
    "  ██║   ██║███████║██╔██╗ ██║██║███████║"
    "  ╚██╗ ██╔╝██╔══██║██║╚██╗██║██║██╔══██║"
    "   ╚████╔╝ ██║  ██║██║ ╚████║██║██║  ██║"
    "    ╚═══╝  ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝"
  )
  local colors=("$CYAN" "$CYAN" "$BLUE" "$BLUE" "$MAGENTA" "$MAGENTA")

  echo ""
  for i in "${!lines[@]}"; do
    printf "${colors[$i]}${BOLD}"
    typewrite "${lines[$i]}" 0.004
    printf "${NC}\n"
    sleep 0.04
  done

  sleep 0.1
  echo ""
  printf "  ${DIM}"
  typewrite "· Deploy script · imagen prebuildeada ·" 0.01
  printf "${NC}\n"
  sleep 0.05
  echo -e "  ${BOLD}Versión :${NC} ${CYAN}$VERSION${NC}"
  echo -e "  ${BOLD}Imagen  :${NC} ${DIM}$IMAGE${NC}"
  echo ""
  printf "  ${CYAN}"
  typewrite "════════════════════════════════════════" 0.005
  printf "${NC}\n\n"
  sleep 0.2
}

animate_banner

step 1 "Creando red Docker"
docker network create vania-network 2>/dev/null \
  && ok "Red ${CYAN}vania-network${NC} creada" \
  || info "Red ya existe, continuando"

step 2 "Creando volúmenes"
for vol in vaniabot_session vaniabot_database vaniabot_temp vania-redis-data vaniabot_assets; do
  docker volume create $vol 2>/dev/null \
    && ok "Volumen ${CYAN}$vol${NC}" \
    || info "$vol ya existe"
  sleep 0.05
done

step 3 "Limpiando contenedores anteriores"
docker rm -f vaniabot vania-redis 2>/dev/null \
  && ok "Contenedores eliminados" \
  || info "No había contenedores previos"

step 4 "Inicializando assets desde la imagen"
info "Copiando assets a volumen permanente..."
docker run --rm \
  -v vaniabot_assets:/assets \
  $IMAGE \
  sh -c "if [ -d /app/data/assets ] && [ \"\$(ls -A /app/data/assets 2>/dev/null)\" ]; then cp -r /app/data/assets/* /assets/ 2>/dev/null || true; fi"
ok "Assets copiados a ${CYAN}vaniabot_assets${NC}"

info "Verificando assets importantes..."
docker run --rm \
  -v vaniabot_assets:/assets \
  busybox \
  sh -c "ls -la /assets/ 2>/dev/null || echo 'No assets found'"
ok "Assets listos"

step 5 "Levantando Redis"
docker run -d \
  --name vania-redis \
  --network vania-network \
  --restart unless-stopped \
  -v vania-redis-data:/data \
  redis:7-alpine \
  redis-server --appendonly yes > /dev/null
ok "Contenedor ${CYAN}vania-redis${NC} iniciado"

step 6 "Verificando Redis"
max_attempts=30
attempt=0
spinner=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
until docker exec vania-redis redis-cli ping 2>/dev/null | grep -q PONG; do
  attempt=$((attempt + 1))
  [ $attempt -ge $max_attempts ] && fail "Redis no respondió después de ${max_attempts}s"
  spin_idx=$(( (attempt - 1) % ${#spinner[@]} ))
  printf "  ${CYAN}${spinner[$spin_idx]}${NC}  ${DIM}Esperando respuesta... (%d/%d)\r${NC}" $attempt $max_attempts
  sleep 1
done
printf "%-55s\r" " "
ok "Redis responde ${GREEN}PONG${NC}"

step 7 "Preparando estructura de datos"
info "Creando directorios en volumen de datos..."
docker run --rm \
  -v vaniabot_database:/app/data \
  busybox \
  sh -c "mkdir -p /app/data/subbot-sessions /app/data/temp /app/data/assets && chmod -R 777 /app/data"
ok "Directorios creados en ${CYAN}vaniabot_database${NC}"

step 8 "Levantando VaniaBot"
info "Imagen : ${CYAN}$IMAGE${NC}"
info "Red    : ${CYAN}vania-network${NC}"
info "Memoria: ${CYAN}1g${NC}  CPUs: ${CYAN}1.5${NC}"
echo ""

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
  -e ASSETS_DIR=/app/data/assets \
  -v vaniabot_session:/app/vaniasession \
  -v vaniabot_database:/app/data \
  -v vaniabot_temp:/app/data/temp \
  -v vaniabot_assets:/app/data/assets \
  -p 3000:3000 \
  --memory=1g \
  --cpus=1.5 \
  --stop-signal=SIGTERM \
  --stop-timeout=15 \
  $IMAGE > /dev/null

ok "Contenedor ${CYAN}vaniabot${NC} iniciado"

echo ""
printf "  ${CYAN}"
typewrite "════════════════════════════════════════" 0.005
printf "${NC}\n\n"

printf "  ${GREEN}${BOLD}"
typewrite "✔  Deploy completo" 0.03
printf "${NC}  ${DIM}·${NC}  ${CYAN}${BOLD}$VERSION${NC}\n\n"

sleep 0.05
echo -e "  ${DIM}┌─────────────────────────────────────────┐${NC}"
sleep 0.05
echo -e "  ${DIM}│${NC}  ${BOLD}Logs  ${NC}  ${DIM}→${NC}  docker logs -f vaniabot         ${DIM}│${NC}"
sleep 0.05
echo -e "  ${DIM}│${NC}  ${BOLD}Parar ${NC}  ${DIM}→${NC}  docker stop vaniabot            ${DIM}│${NC}"
sleep 0.05
echo -e "  ${DIM}│${NC}  ${BOLD}Status${NC}  ${DIM}→${NC}  docker ps                       ${DIM}│${NC}"
sleep 0.05
echo -e "  ${DIM}│${NC}  ${BOLD}Assets${NC}  ${DIM}→${NC}  docker run --rm -it vaniabot_assets:/assets busybox ls -la /assets${DIM}│${NC}"
sleep 0.05
echo -e "  ${DIM}└─────────────────────────────────────────┘${NC}"
echo ""