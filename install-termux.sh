#!/bin/bash

# ╔═══════════════════════════════════════════════════════════════════════════════╗
# ║                    VaniaBot - Script de Instalación para Termux             ║
# ║                         Optimizado para Android/Termux                        ║
# ╚═══════════════════════════════════════════════════════════════════════════════╝
#
# Autor: Carlos G (@CARLOSGRCIAGRCIA)
# Versión: 4.17.0
# Compatibilidad: Termux (Android 7.0+)
#
# Este script instala VaniaBot en Termux con todas las dependencias necesarias.
# Incluye opciones de instalación mínima y completa.
#
# Uso:
#   bash install-termux.sh          # Instalación completa (recomendada)
#   bash install-termux.sh --minimal # Instalación mínima (sin características pesadas)
#   bash install-termux.sh --help   # Mostrar ayuda
#

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Variables
INSTALL_MODE="full"
TERMUX_SHARE="/data/data/com.termux/files/usr"
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$CURRENT_DIR/install-termux.log"

# ══════════════════════════════════════════════════════════════════════════════
# Funciones de utilidad
# ══════════════════════════════════════════════════════════════════════════════

log() {
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $1" >> "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[✓]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS] $1" >> "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[!]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARN] $1" >> "$LOG_FILE"
}

error() {
    echo -e "${RED}[✗]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $1" >> "$LOG_FILE"
}

header() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${CYAN}  $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

show_help() {
    cat << EOF
${BOLD}VaniaBot - Script de Instalación para Termux${NC}

${BOLD}Uso:${NC}
    bash install-termux.sh [OPCIONES]

${BOLD}Opciones:${NC}
    --full      Instalación completa (por defecto)
    --minimal   Instalación mínima (para dispositivos con recursos limitados)
    --skip-npm  No instalar dependencias npm (usar las existentes)
    --help      Mostrar esta ayuda

${BOLD}Descripción:${NC}
    Este script instala VaniaBot en Termux con todas las dependencias
    necesarias para funcionar correctamente en Android.

${BOLD}Requisitos:${NC}
    - Termux instalado (desde F-Droid o GitHub)
    - Android 7.0 o superior
    - Al menos 500MB de almacenamiento libre
    - Conexión a internet para descargar dependencias

${BOLD}Ejemplos:${NC}
    bash install-termux.sh              # Instalación completa
    bash install-termux.sh --minimal     # Para dispositivos limitados
    bash install-termux.sh --skip-npm   # Si ya tienes node_modules

EOF
}

# ══════════════════════════════════════════════════════════════════════════════
# Verificación inicial
# ══════════════════════════════════════════════════════════════════════════════

check_environment() {
    header "Verificando Entorno"
    
    # Verificar si estamos en Termux
    if [ ! -d "/data/data/com.termux" ]; then
        warn "No parece estar en Termux. El script continuará de todas formas."
    fi
    
    # Verificar Android
    if [ -f "/system/build.prop" ]; then
        log "Sistema detectado: Android"
    fi
    
    # Verificar permisos
    if [ -w "$CURRENT_DIR" ]; then
        success "Permisos de escritura OK"
    else
        error "No se puede escribir en el directorio actual"
        exit 1
    fi
    
    # Verificar espacio
    available=$(df -k "$CURRENT_DIR" | tail -1 | awk '{print $4}')
    if [ "$available" -lt 500000 ]; then
        warn "Poco espacio disponible: $(($available / 1024))MB"
        warn "Se recomienda al menos 500MB para una instalación completa"
    else
        success "Espacio disponible: $(($available / 1024))MB"
    fi
}

# ══════════════════════════════════════════════════════════════════════════════
# Instalación de dependencias del sistema
# ══════════════════════════════════════════════════════════════════════════════

install_system_deps() {
    header "Instalando Dependencias del Sistema"
    
    log "Actualizando repositorios..."
    pkg update -y >> "$LOG_FILE" 2>&1 || true
    
    log "Instalando dependencias base..."
    pkg install -y \
        git \
        nodejs \
        python \
        ffmpeg \
        libwebp \
        imagemagick \
        bc \
        jq \
        curl \
        wget \
        tar \
        zip \
        unzip \
        2>&1 | tee -a "$LOG_FILE"
    
    success "Dependencias base instaladas"
    
    # Instalar yt-dlp
    log "Instalando yt-dlp..."
    pip install --upgrade yt-dlp >> "$LOG_FILE" 2>&1 || {
        warn "Error instalando yt-dlp, intentando con pip3..."
        pip3 install --upgrade yt-dlp >> "$LOG_FILE" 2>&1 || true
    }
    success "yt-dlp instalado"
    
    # Para instalación completa, instalar dependencias adicionales
    if [ "$INSTALL_MODE" = "full" ]; then
        log "Instalando dependencias adicionales para instalación completa..."
        
        # ImageMagick policy fix para evitar errores de seguridad
        if [ -f "$TERMUX_SHARE/ImageMagick-*/config/policy.xml" ]; then
            POLICY_FILE=$(find "$TERMUX_SHARE" -name "policy.xml" -path "*ImageMagick*" 2>/dev/null | head -1)
            if [ -n "$POLICY_FILE" ] && [ -f "$POLICY_FILE" ]; then
                sed -i 's/<policy domain="coder" rights="none" pattern="PDF" \/>/<policy domain="coder" rights="read|write" pattern="PDF" \/>/g' "$POLICY_FILE" 2>/dev/null || true
            fi
        fi
        
        # Instalar canvas si es posible
        log "Intentando instalar dependencias de canvas..."
        pkg install -y \
            libjpeg-turbo \
            libpng \
            zlib \
            2>&1 | tee -a "$LOG_FILE" || true
        
        success "Dependencias adicionales instaladas"
    else
        warn "Modo mínimo: omitiendo dependencias opcionales"
    fi
    
    # Verificar instalaciones
    log "Verificando instalaciones..."
    
    if command -v node &> /dev/null; then
        success "Node.js: $(node --version)"
    else
        error "Node.js no se instaló correctamente"
    fi
    
    if command -v npm &> /dev/null; then
        success "NPM: $(npm --version)"
    else
        error "NPM no se instaló correctamente"
    fi
    
    if command -v ffmpeg &> /dev/null; then
        success "FFmpeg: $(ffmpeg -version 2>&1 | head -n 1)"
    else
        warn "FFmpeg no se instaló - algunas funciones de video no funcionarán"
    fi
    
    if command -v python &> /dev/null; then
        success "Python: $(python --version)"
    else
        warn "Python no se instaló - yt-dlp puede no funcionar"
    fi
}

# ══════════════════════════════════════════════════════════════════════════════
# Instalación de Node.js dependencies
# ══════════════════════════════════════════════════════════════════════════════

install_nodejs_deps() {
    header "Instalando Dependencias de Node.js"
    
    cd "$CURRENT_DIR"
    
    # Verificar si package.json existe
    if [ ! -f "package.json" ]; then
        error "package.json no encontrado. Asegúrate de estar en el directorio de VaniaBot"
        exit 1
    fi
    
    # Limpiar node_modules si existe para reinstalación limpia
    if [ -d "node_modules" ]; then
        warn "Limpiando node_modules anterior..."
        rm -rf node_modules package-lock.json
    fi
    
    # Instalar dependencias
    log "Instalando dependencias npm (esto puede tardar varios minutos)..."
    echo "Comando: npm install --prefer-offline"
    
    if [ "$INSTALL_MODE" = "minimal" ]; then
        # Instalación mínima sin dependencias pesadas opcionales
        log "Modo mínimo: omitiendo dependencias pesadas..."
        npm install --ignore-scripts --no-optional 2>&1 | tee -a "$LOG_FILE"
    else
        npm install 2>&1 | tee -a "$LOG_FILE"
    fi
    
    if [ $? -eq 0 ]; then
        success "Dependencias npm instaladas"
    else
        error "Error instalando dependencias npm"
        warn "Intentando instalación mínima..."
        npm install --ignore-scripts 2>&1 | tee -a "$LOG_FILE"
    fi
    
    # Rebuild native modules si es necesario
    if [ -f "node_modules/.bin/npm" ]; then
        log "Verificando módulos nativos..."
        npm rebuild 2>&1 | tee -a "$LOG_FILE" || true
    fi
}

# ══════════════════════════════════════════════════════════════════════════════
# Configuración
# ══════════════════════════════════════════════════════════════════════════════

setup_config() {
    header "Configurando VaniaBot"
    
    cd "$CURRENT_DIR"
    
    # Crear archivo .env si no existe
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            log "Copiando .env.example a .env..."
            cp .env.example .env
            success ".env creado desde .env.example"
        else
            log "Creando archivo .env básico..."
            cat > .env << 'EOF'
BOT_NAME=VaniaBot
BOT_PREFIX=.
OWNERS=
GROQ_API_KEY=
NODE_ENV=development
EOF
            success ".env básico creado"
        fi
        
        warn "⚠️ IMPORTANTE: Edita el archivo .env y configura:"
        echo "   - OWNERS: Tu número de WhatsApp con código de país (ej: 5215512345678)"
        echo "   - GROQ_API_KEY: Obtener en https://console.groq.com/keys"
        echo ""
        echo "   nano .env"
        echo ""
    else
        success ".env ya existe"
    fi
    
    # Crear directorios necesarios
    log "Creando directorios..."
    mkdir -p data/temp
    mkdir -p vaniasession
    mkdir -p logs
    mkdir -p data/backups
    success "Directorios creados"
    
    # Configurar timezone
    if [ -f "/data/data/com.termux/files/usr/etc/motd" ]; then
        log "Configurando timezone..."
        export TZ="America/Mexico_City"
    fi
}

# ══════════════════════════════════════════════════════════════════════════════
# Verificación final
# ══════════════════════════════════════════════════════════════════════════════

verify_installation() {
    header "Verificando Instalación"
    
    local errors=0
    
    log "Verificando archivos necesarios..."
    
    for file in package.json tsconfig.json vania.ts src/index.ts; do
        if [ -f "$file" ]; then
            success "$file existe"
        else
            error "$file no encontrado"
            ((errors++))
        fi
    done
    
    log "Verificando TypeScript..."
    if npx tsc --version >> "$LOG_FILE" 2>&1; then
        success "TypeScript: $(npx tsc --version)"
    else
        warn "TypeScript no está disponible directamente"
    fi
    
    log "Verificando estructura del proyecto..."
    if [ -d "src/commands" ] && [ -d "src/services" ]; then
        success "Estructura del proyecto OK"
    else
        error "Estructura del proyecto incompleta"
        ((errors++))
    fi
    
    return $errors
}

# ══════════════════════════════════════════════════════════════════════════════
# Mostrar instrucciones finales
# ══════════════════════════════════════════════════════════════════════════════

show_instructions() {
    header "Instalación Completada"
    
    cat << EOF
${GREEN}╔════════════════════════════════════════════════════════════════════════╗
║                   ¡VaniaBot instalado exitosamente!                      ║
╚════════════════════════════════════════════════════════════════════════╝${NC}

${BOLD}📋 Próximos pasos:${NC}

1. ${YELLOW}Configura el archivo .env${NC}
   nano .env
   
   Variables requeridas:
   • OWNERS - Tu número con código de país (ej: 5215512345678)
   • GROQ_API_KEY - Obtener en https://console.groq.com/keys

2. ${YELLOW}Iniciar el bot${NC}
   
   # Modo QR (primera vez):
   npm start
   
   # Modo código de pareo (más estable):
   USE_PAIRING_CODE=true npm run code
   
   # Modo desarrollo:
   npm run dev

3. ${YELLOW}Escanea el código QR con WhatsApp${NC}

${BOLD}📌 Comandos útiles:${NC}
   • Ver logs: pm2 logs vaniabot
   • Reiniciar: pm2 restart vaniabot
   • Estado: pm2 status

${BOLD}🔧 Mantener el bot funcionando 24/7:${NC}
   
   # Activar wake lock (evita que Termux se duerma):
   termux-wake-lock
   
   # Usar PM2:
   npm install -g pm2
   pm2 start vania.ts --interpreter tsx --name vaniabot
   pm2 save
   pm2 startup

${BOLD}⚠️ Notas importantes:${NC}
   • El bot requiere ser admin del grupo para funcionar correctamente
   • Asegúrate de que FFmpeg esté instalado para funciones de video
   • Guarda tu sesión periódicamente haciendo backup de vaniasession/

${BOLD}🐛 Solución de problemas:${NC}
   • Error de permisos: termux-setup-storage
   • Ver logs: cat install-termux.log
   • Reinstalar deps: rm -rf node_modules && npm install

EOF
}

# ══════════════════════════════════════════════════════════════════════════════
# Función principal
# ══════════════════════════════════════════════════════════════════════════════

main() {
    # Parsear argumentos
    while [[ $# -gt 0 ]]; do
        case $1 in
            --full)
                INSTALL_MODE="full"
                shift
                ;;
            --minimal)
                INSTALL_MODE="minimal"
                warn "Modo mínimo activado - algunas funciones pueden no estar disponibles"
                shift
                ;;
            --skip-npm)
                SKIP_NPM=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                error "Opción desconocida: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Iniciar log
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] === Iniciando instalación de VaniaBot ===" > "$LOG_FILE"
    
    header "VaniaBot - Instalación para Termux"
    
    echo -e "${BOLD}Modo de instalación:${NC} ${CYAN}$INSTALL_MODE${NC}"
    echo ""
    
    # Ejecutar pasos
    check_environment
    install_system_deps
    
    if [ "$SKIP_NPM" != "true" ]; then
        install_nodejs_deps
    else
        warn "Saltando instalación de npm..."
    fi
    
    setup_config
    
    if verify_installation; then
        show_instructions
        success "Instalación completada"
    else
        error "La instalación tuvo algunos problemas"
        warn "Revisa el archivo $LOG_FILE para más detalles"
        exit 1
    fi
}

# Ejecutar
main "$@"
