<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=2,3,4,12,24&height=200&section=header&text=VaniaBot&fontSize=70&fontAlignY=35&desc=Tu%20Asistente%20Inteligente%20de%20WhatsApp&descAlignY=55&animation=twinkling" width="100%"/>
</div>

<p align="center">
  <img src="https://img.shields.io/github/stars/CARLOSGRCIAGRCIA/vaniabot?style=for-the-badge&logo=github&color=FFD700" alt="GitHub stars">
  <img src="https://img.shields.io/github/forks/CARLOSGRCIAGRCIA/vaniabot?style=for-the-badge&logo=github&color=58A6FF" alt="GitHub forks">
  <img src="https://img.shields.io/github/issues/CARLOSGRCIAGRCIA/vaniabot?style=for-the-badge&logo=github&color=FF6B9D" alt="GitHub issues">
  <img src="https://img.shields.io/github/license/CARLOSGRCIAGRCIA/vaniabot?style=for-the-badge&color=2DD4BF" alt="License">
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="WhatsApp">
</p>

<p align="center">
  <img src="https://github-readme-stats.vercel.app/api?username=CARLOSGRCIAGRCIA&show_icons=true&theme=radical&hide_border=true&count_private=true" height="150" alt="stats graph"/>
</p>

---

## Tabla de Contenidos

- [Análisis del Proyecto](#-análisis-del-proyecto)
- [Características](#-características)
- [Dependencias del Sistema](#️-dependencias-del-sistema)
- [Instalación](#-instalación)
  - [VPS / Servidor Dedicado (Linux)](#vps--servidor-dedicado-linux)
  - [Computadora Personal](#computadora-personal-windowsmacoslinux)
  - [Docker](#docker)
  - [Termux (Android)](#termux-android)
- [Configuración](#-configuración)
- [Comandos](#-comandos)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [FAQ / Solución de Problemas](#-faq--solución-de-problemas)
- [Licencia](#-licencia)

---

## Análisis del Proyecto

### Información General

| Atributo              | Valor          |
| :-------------------- | :------------- |
| **Nombre**            | VaniaBot       |
| **Versión**           | 4.3.0          |
| **Licencia**          | MIT            |
| **Idioma principal**  | TypeScript     |
| **Runtime**           | Node.js 18+    |
| **Librería WhatsApp** | Baileys v6.7.9 |

### Arquitectura

VaniaBot es un bot de WhatsApp **multifuncional** construido con TypeScript y Baileys, utilizando una arquitectura modular:

- **Cliente Core**: Manejo de conexión WhatsApp y eventos.
- **CommandRegistry**: Sistema de registro y ejecución de comandos.
- **MessageProcessor**: Pipeline de procesamiento de mensajes con middlewares.
- **Servicios especializados**: IA, Base de datos, Descargas, Moderación, Juegos, Economía.

### Módulos del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                         VaniaBot Core                           │
├─────────────┬─────────────┬─────────────┬───────────────────────┤
│   AI/Chat   │ Moderación  │  Economía   │       Juegos          │
│  - Groq     │  - Ban/Kick │  - Daily    │  - Coinflip           │
│  - LLaMA 3  │  - Mute     │  - Weekly   │  - Slots              │
│  - Whisper  │  - Warn     │  - Work     │  - Quiz               │
│             │  - AntiSpam │  - Shop     │  - Listas             │
├─────────────┼─────────────┼─────────────┼───────────────────────┤
│   Media     │  Utilities  │   Owner     │       SubBots         │
│  - Stickers │  - Translate│  - Broadcast│  - Multi-device       │
│  - YouTube  │  - Currency │  - Backup   │  - Parallel           │
│  - TikTok   │  - QR Code  │  - Stats    │    instances          │
└─────────────┴─────────────┴─────────────┴───────────────────────┘
```

### Tecnologías Usadas

| Categoría     | Tecnología                  |
| :------------ | :-------------------------- |
| Runtime       | Node.js 18+                 |
| Lenguaje      | TypeScript                  |
| WhatsApp      | Baileys v6                  |
| IA            | Groq SDK (LLaMA 3, Whisper) |
| Base de datos | JSON (local) / MongoDB      |
| Cache         | Redis / Memory              |
| Testing       | Vitest                      |
| Logging       | Pino                        |

---

## Características

| Módulo         | Descripción                                                              |
| :------------- | :----------------------------------------------------------------------- |
| **AI**         | Chat contextual con Groq (LLaMA 3), transcripción de audio.              |
| **Moderación** | Ban, kick, mute, warn, anti-spam, anti-link, anti-fake.                  |
| **Economía**   | Recompensas diarias/semanales, trabajo, tienda, inventario, niveles XP.  |
| **Juegos**     | Coinflip, slots, quizzes con dificultad adaptativa, listas interactivas. |
| **Stickers**   | Crear stickers de imágenes, videos, GIFs.                                |
| **Descargas**  | YouTube audio/video, TikTok, Instagram, Facebook.                        |
| **Poesía**     | Poemas generados por IA, haikus, sonetos, dedicatorias.                  |
| **Utilidades** | Traductor, conversor de moneda, QR, encuestas, recordatorios.            |
| **SubBots**    | Múltiples instancias de WhatsApp paralelas.                              |

---

## Dependencias del Sistema

### Requisitos Mínimos

| Dependencia | Versión mínima | Descripción                  |
| :---------- | :------------- | :--------------------------- |
| **Node.js** | 18+            | Runtime de JavaScript        |
| **Git**     | -              | Para clonar el repositorio   |
| **FFmpeg**  | -              | Procesamiento de audio/video |
| **Python**  | 3.8+           | Para yt-dlp                  |

### Dependencias de Node.js (Principales)

```json
{
  "@whiskeysockets/baileys": "^6.7.9",
  "groq-sdk": "^0.37.0",
  "axios": "^1.13.5",
  "pino": "^9.5.0",
  "ioredis": "^5.9.3",
  "mongodb": "^7.1.0",
  "sharp": "^0.34.5",
  "yt-search": "^2.13.1",
  "zod": "^3.24.1"
}
```

---

## Instalación

### VPS / Servidor Dedicado (Linux)

#### Requisitos del servidor

- **RAM**: Mínimo 1GB (recomendado 2GB)
- **CPU**: 1 núcleo
- **Almacenamiento**: 5GB mínimo
- **SO**: Ubuntu 20.04+ / Debian 11+ / CentOS 8+

#### Paso 1: Actualizar sistema e instalar dependencias

```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y
sudo apt install -y git ffmpeg python3 python3-pip build-essential libgbm-dev

# Instalar Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

#### Paso 2: Instalar yt-dlp

```bash
pip3 install yt-dlp
```

#### Paso 3: Clonar el repositorio

```bash
git clone https://github.com/CARLOSGRCIAGRCIA/vaniabot.git
cd vaniabot
```

#### Paso 4: Instalar dependencias

```bash
npm install
```

#### Paso 5: Configurar variables de entorno

```bash
cp .env.example .env
nano .env
```

#### Paso 6: Iniciar el bot

```bash
# Opción 1: QR Code
npm start

# Opción 2: Código de pareo
npm run code

# Opción 3: Desarrollo (con reinicio automático)
npm run dev
```

#### Paso 7: Mantener el bot 24/7 con PM2

```bash
# Instalar PM2
sudo npm install -g pm2

# Iniciar con PM2
pm2 start vania.ts --interpreter tsx --name vaniabot

# Guardar configuración
pm2 save

# Iniciar al arranque del sistema
pm2 startup
# (seguir las instrucciones del comando)
```

---

### Computadora Personal (Windows/macOS/Linux)

<details>
<summary><b>Windows</b></summary>

1. **Instalar Node.js**: Descargar de [nodejs.org](https://nodejs.org/) (versión LTS)
2. **Instalar FFmpeg**:
   - Descargar de [ffmpeg.org](https://ffmpeg.org/download.html)
   - Extraer y agregar al PATH de Windows
3. **Instalar Git**: Descargar de [git-scm.com](https://git-scm.com/)
4. **Instalar Python**: Descargar de [python.org](https://www.python.org/)
5. **Abrir terminal y ejecutar**:

```bash
git clone https://github.com/CARLOSGRCIAGRCIA/vaniabot.git
cd vaniabot
npm install
copy .env.example .env
notepad .env
npm start
```

</details>

<details>
<summary><b>macOS</b></summary>

```bash
# Instalar Homebrew (si no tienes)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Instalar dependencias
brew install git node ffmpeg python

# Instalar yt-dlp
pip3 install yt-dlp

# Clonar y ejecutar
git clone https://github.com/CARLOSGRCIAGRCIA/vaniabot.git
cd vaniabot
npm install
cp .env.example .env
nano .env
npm start
```

</details>

<details>
<summary><b>Linux (Escritorio)</b></summary>

```bash
# Instalar dependencias del sistema
sudo apt update
sudo apt install -y git nodejs npm ffmpeg python3 python3-pip

# Instalar yt-dlp
pip3 install yt-dlp

# Clonar y ejecutar
git clone https://github.com/CARLOSGRCIAGRCIA/vaniabot.git
cd vaniabot
npm install
cp .env.example .env
nano .env
npm start
```

</details>

---

### Docker

#### Requisitos

- Docker 20.10+
- Docker Compose 2.0+

#### Paso 1: Clonar y configurar

```bash
git clone https://github.com/CARLOSGRCIAGRCIA/vaniabot.git
cd vaniabot
cp .env.example .env
nano .env
```

#### Paso 2: Configurar `.env`

```env
BOT_NAME=VaniaBot
BOT_PREFIX=.
OWNERS=tu_numero@lid
USE_PAIRING_CODE=true
PHONE_NUMBER=+1234567890
GROQ_API_KEY=tu_api_key
NODE_ENV=production
DB_TYPE=json
TZ=America/Mexico_City
```

#### Paso 3: Ejecutar con Docker Compose

```bash
# Iniciar contenedor
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener
docker-compose down

# Reiniciar
docker-compose restart
```

#### Construcción manual

```bash
docker build -t vaniabot .
docker run -d \
  --name vaniabot \
  --env-file .env \
  -v vaniabot_session:/app/vaniasession \
  -v vaniabot_temp:/app/data/temp \
  -v ./data/assets:/app/data/assets:ro \
  vaniabot
```

#### Persistencia de datos

| Volumen            | Descripción                         |
| :----------------- | :---------------------------------- |
| `vaniabot_session` | Credenciales de sesión WhatsApp     |
| `vaniabot_data`    | Archivos temporales y base de datos |

---

### Termux (Android)

#### Requisitos

- Termux instalado (de F-Droid o GitHub)
- Android 7.0+
- Al menos 500MB de almacenamiento libre

#### Paso 1: Actualizar repositorios

```bash
pkg update && pkg upgrade -y
```

#### Paso 2: Instalar dependencias del sistema

```bash
pkg install -y git nodejs ffmpeg python libwebp imagemagick bc jq
```

#### Paso 3: Instalar yt-dlp

```bash
pip install yt-dlp
```

#### Paso 4: Clonar repositorio

```bash
git clone https://github.com/CARLOSGRCIAGRCIA/vaniabot.git
cd vaniabot
```

#### Paso 5: Instalar dependencias Node.js

```bash
npm install
```

#### Paso 6: Configurar variables de entorno

```bash
cp .env.example .env
nano .env
```

#### Paso 7: Iniciar el bot

```bash
# Con código QR
npm start

# O con código de pareo
npm run code
```

#### Mantener el bot funcionando 24/7

```bash
# Activar wake lock (evita que Termux se duerma)
termux-wake-lock

# Iniciar el bot
npm start
```

#### Mejor estabilidad con PM2

```bash
# Instalar PM2
npm install -g pm2

# Iniciar con PM2
pm2 start vania.ts --interpreter tsx --name vaniabot

# Guardar configuración
pm2 save
```

<details>
<summary><b>Solución de problemas en Termux</b></summary>

```bash
# Error de permisos
termux-setup-storage

# Error de iconv
npm rebuild

# Ver proceso activo
ps

# Matar proceso del bot
pkill -f "tsx vania"

# Ver logs
pm2 logs vaniabot
```

</details>

---

## 🔧 Configuración

### Variables de Entorno

| Variable                  | Descripción                                                                                                          | Requerido                  | Valor por defecto                  |
| :------------------------ | :------------------------------------------------------------------------------------------------------------------- | :------------------------- | :--------------------------------- |
| `BOT_NAME`                | Nombre del bot                                                                                                       | No                         | VaniaBot                           |
| `BOT_PREFIX`              | Prefijo de comandos                                                                                                  | No                         | .                                  |
| `OWNERS`                  | IDs de owners (separados por coma)                                                                                   | Sí                         | 208924405956643@lid,529516526675   |
| `OWNER_JIDS`              | IDs adicionales de owners para permisos específicos                                                                  | No                         | 208924405956643@lid                |
| `SESSION_PATH`            | Ruta de almacenamiento de sesión WhatsApp                                                                            | No                         | ./vaniasession                     |
| `USE_PAIRING_CODE`        | Usar código de pareamiento (true) o QR (false)                                                                       | No                         | false                              |
| `PHONE_NUMBER`            | Número de teléfono para pareo (con código de país)                                                                   | Si `USE_PAIRING_CODE=true` | -                                  |
| `DB_TYPE`                 | Tipo de base de datos: `json` (local) o `mongodb`                                                                    | No                         | json                               |
| `DB_URI`                  | URI de conexión MongoDB                                                                                              | Si `DB_TYPE=mongodb`       | mongodb://localhost:27017/vaniabot |
| `NODE_ENV`                | Entorno de ejecución: `development` o `production`                                                                   | No                         | development                        |
| `GROQ_API_KEY`            | **API Key de Groq para funcionalidades de IA** (obtener gratis en [console.groq.com](https://console.groq.com/keys)) | **Sí**                     | -                                  |
| `MAX_RECONNECT_ATTEMPTS`  | Máximo de intentos de reconexión ante fallos de conexión                                                             | No                         | 10                                 |
| `AUTO_RECONNECT`          | Habilitar reconexión automática                                                                                      | No                         | true                               |
| `CACHE_ENABLED`           | Habilitar sistema de caché en memoria                                                                                | No                         | true                               |
| `ANTI_SPAM`               | Habilitar middleware anti-spam (rate limiting)                                                                       | No                         | true                               |
| `LOG_LEVEL`               | Nivel de logging: `error`, `warn`, `info`, `debug`                                                                   | No                         | info                               |
| `MAX_COMMANDS_PER_MINUTE` | Máximo de comandos por minuto por usuario                                                                            | No                         | 10                                 |
| `MAX_MEDIA_SIZE`          | Tamaño máximo de archivos multimedia en bytes (50MB = 52428800)                                                      | No                         | 52428800                           |
| `AUTO_READ`               | Marcar mensajes como leídos automáticamente                                                                          | No                         | false                              |

### Obtener Groq API Key

1. Ir a [console.groq.com](https://console.groq.com)
2. Crear cuenta o iniciar sesión
3. Ir a **API Keys**
4. Crear nueva key
5. Copiar a `.env`

```env
GROQ_API_KEY=gsk_tu_api_key_aqui
```

---

## Comandos

### Utilidades (15 comandos)

| Comando                               | Descripción                |
| :------------------------------------ | :------------------------- |
| `.ping`                               | Latencia del bot           |
| `.help [comando]`                     | Ayuda detallada            |
| `.profile [@usuario]`                 | Ver perfil                 |
| `.level [@usuario]`                   | Nivel y experiencia        |
| `.top [money/level/xp]`               | Ranking del grupo          |
| `.inventory [@usuario]`               | Inventario                 |
| `.achievements`                       | Logros obtenidos           |
| `.calc <expresión>`                   | Calculadora                |
| `.moneda <cantidad> <de> <a>`         | Conversor de moneda        |
| `.qr <texto>`                         | Generar código QR          |
| `.recordatorio <tiempo> <msg>`        | Recordatorio (10m, 2h, 1d) |
| `.acortar <url>`                      | Acortar URL                |
| `.traducir <idioma> <texto>`          | Traductor simple           |
| `.encuesta "pregunta" "op1" "op2"...` | Crear encuesta             |

### IA y Chat (3 comandos)

| Comando         | Descripción                                           |
| :-------------- | :---------------------------------------------------- |
| `.ai <mensaje>` | Chatear con Vania AI - mantiene historial por usuario |
| `.aiclear`      | Limpiar historial de conversación                     |
| `.transcribe`   | Transcribir audio o nota de voz                       |

### Moderación (11 comandos) - Requiere admin de grupo

| Comando                             | Descripción                          |
| :---------------------------------- | :----------------------------------- |
| `.ban @usuario [razón]`             | Banear usuario                       |
| `.unban @usuario`                   | Quitar ban                           |
| `.kick @usuario [razón]`            | Expulsar                             |
| `.mute @usuario <duración> [razón]` | Silenciar (10m, 1h)                  |
| `.unmute @usuario`                  | Quitar silencio                      |
| `.warn @usuario [razón]`            | Advertir - 3 warns = kick automático |
| `.demote @usuario`                  | Quitar admin                         |
| `.promote @usuario`                 | Hacer admin                          |
| `.all [mensaje]`                    | Mencionar a todos                    |
| `.welcome [on/off/set/test/reset]`  | Configurar mensaje de bienvenida     |
| `.goodbye [on/off/set/test/reset]`  | Configurar mensaje de despedida      |

### Economía (6 comandos)

| Comando                    | Descripción                |
| :------------------------- | :------------------------- |
| `.daily`                   | Recompensa diaria          |
| `.weekly`                  | Recompensa semanal         |
| `.work`                    | Trabajar para ganar dinero |
| `.shop`                    | Ver tienda                 |
| `.buy <número>`            | Comprar artículo           |
| `.pay @usuario <cantidad>` | Transferir dinero          |

### Juegos (11 comandos)

| Comando                            | Descripción                              |
| :--------------------------------- | :--------------------------------------- |
| `.coinflip <cara/sello> <apuesta>` | Apostar cara o sello                     |
| `.slots <apuesta>`                 | Máquina tragamonedas                     |
| `.quiz [categoría] [preguntas]`    | Quiz educativo con dificultad adaptativa |
| `.quiz stop`                       | Detener quiz actual                      |
| `.quizstats [@usuario]`            | Estadísticas de quiz                     |
| `.quiztop [categoría]`             | Top del grupo                            |
| `.clk [hora] [liga]`               | Lista interactiva CLK                    |
| `.vv2 [hora]`                      | Lista VV2                                |
| `.cuadrilatero [hora] [color]`     | Lista cuadrilátero                       |
| `.trilatero [hora] [color]`        | Lista trilátero                          |
| `.hexagonal [hora] [color]`        | Lista hexagonal                          |

### Media y Stickers (17 comandos)

| Comando                      | Descripción                                 |
| :--------------------------- | :------------------------------------------ |
| `.sticker`                   | Convertir imagen/video/GIF a sticker        |
| `.take <pack>/<author>`      | Cambiar pack o autor del sticker            |
| `.nota <texto>`              | Sticker de nota adhesiva                    |
| `.pat <texto>`               | Sticker meme de Patrick                     |
| `.qc <texto>`                | Sticker de cita con foto de perfil          |
| `.ytmp3 <búsqueda o URL>`    | Descargar audio de YouTube                  |
| `.ytmp4 <búsqueda o URL>`    | Descargar video de YouTube                  |
| `.tiktok <URL>`              | Video de TikTok sin marca de agua           |
| `.instagram <URL>`           | Reel o post de Instagram                    |
| `.facebook <URL>`            | Video de Facebook                           |
| `.descuentos [reddit/promo]` | Ofertas de Reddit y PromoDescuentos         |
| `.gitclone <url>`            | Descargar repositorio GitHub como ZIP       |
| `.githubsearch <query>`      | Buscar repositorios en GitHub               |
| `.toanime`                   | Convertir imagen a estilo anime (responder) |
| `.togif`                     | Convertir video a GIF (responder)           |
| `.animelink`                 | Lista de páginas de anime                   |

### Poesía (13 comandos)

| Comando                          | Descripción                       |
| :------------------------------- | :-------------------------------- |
| `.poema [tema] [estilo] [for:x]` | Poema personalizado               |
| `.frases [tema] [estilo]`        | 5 frases creativas                |
| `.piropo [estilo] [for:x]`       | Frases graciosas generadas por IA |
| `.dedicatoria [tema] [for:x]`    | Dedicatoria personalizada         |
| `.haiku [tema] [estilo]`         | 3 haikus                          |
| `.soneto [tema] [for:x]`         | Soneto clásico                    |
| `.copla [tema] [estilo]`         | Coplas populares                  |
| `.acrostico <NOMBRE> [tema]`     | Acróstico con nombre              |
| `.carta [razón] [for:x]`         | Carta de amor                     |
| `.historia [tema] [estilo]`      | Historia corta                    |
| `.votar <ID>`                    | Votar trabajo poético             |
| `.poetop [tipo]`                 | Ranking de votos                  |
| `.poetstats`                     | Tus estadísticas poéticas         |

### Gestión de Grupos (5 comandos)

| Comando            | Descripción                            |
| :----------------- | :------------------------------------- |
| `.link`            | Obtener enlace de invitación del grupo |
| `.invite <número>` | Enviar invitación al número            |
| `.add <número>`    | Agregar usuario directamente al grupo  |
| `.fantasmas`       | Ver lista de usuarios inactivos        |
| `.kickfantasmas`   | Expulsar usuarios fantasmas            |

### Interacciones (7 comandos)

| Comando           | Alias      | Descripción                   |
| :---------------- | :--------- | :---------------------------- |
| `.hug <@usuario>` | `.abrazar` | Abrazar a alguien             |
| `.cry`            | `.llorar`  | Llorar                        |
| `.sleep`          | `.dormir`  | Dormir                        |
| `.personalidad`   | -          | Análisis fake de personalidad |
| `.formarpareja5`  | -          | Formar 5 parejas aleatorias   |
| `.reirse`         | `.laugh`   | Reírse                        |

### Owner (4 comandos) - Solo owners del bot

| Comando                                      | Descripción                   |
| :------------------------------------------- | :---------------------------- |
| `.setowner add/remove @usuario`              | Conceder o revocar owner      |
| `.grant <money/xp/item> @usuario <cantidad>` | Otorgar recursos              |
| `.stats`                                     | Estadísticas globales del bot |
| `.autoadmin`                                 | Auto-promover en grupos       |

---

## Estructura del Proyecto

```
vaniabot/
│
├── src/
│   ├── commands/              # Comandos organizados por dominio
│   │   ├── admin/              # Welcome, Goodbye, Moderación
│   │   ├── creative/           # Poesía IA
│   │   ├── economy/            # Daily, Weekly, Work, Shop, Pay
│   │   ├── game/               # Coinflip, Slots, Listas
│   │   ├── media/              # Descargas y Stickers
│   │   ├── owner/              # AutoAdmin, Grant, SetOwner
│   │   └── utility/            # AI, Audio, Quiz, Herramientas, Usuario
│   │
│   ├── core/                    # Cliente, CommandRegistry, Auth
│   ├── handlers/                # Manejadores de eventos
│   ├── middlewares/             # AntiSpam, Cooldown, Permisos
│   ├── models/                   # User, Group
│   ├── services/                 # Lógica de negocio
│   │   ├── audio/                # AudioService
│   │   ├── creative/             # PoetryService
│   │   ├── database/             # JsonDatabase, MongoDatabase
│   │   ├── download/             # YouTube, TikTok, Instagram
│   │   ├── external/             # AIService (Groq)
│   │   ├── game/                 # ListaManager
│   │   ├── media/                # StickerService
│   │   ├── moderation/           # ModerationService
│   │   └── system/               # Servicios del sistema (Cache, Health, etc.)
│   │
│   ├── types/                    # Tipos TypeScript
│   └── utils/                    # Helpers, Logger, QR
│
├── vania.ts                       # Bootstrapper principal
├── data/                          # Base de datos y assets
├── vaniasession/                  # Sesión WhatsApp
├── docker-compose.yml
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## FAQ / Solución de Problemas

<details>
<summary><b>El bot no responde a comandos</b></summary>

1. Asegúrate de estar en un grupo donde el bot sea **admin**.
2. Verifica que el prefijo en `.env` coincida (por defecto `!`).
3. Usa `.help` para ver comandos disponibles.
</details>

<details>
<summary><b>Error "Session not found"</b></summary>

- Eliminar la carpeta `vaniasession/` y ejecutar nuevamente.
- Escanear el QR nuevamente o usar código de pareo.
</details>

<details>
<summary><b>Error de FFmpeg</b></summary>

**Linux:**

```bash
sudo apt install ffmpeg
```

**macOS:**

```bash
brew install ffmpeg
```

**Windows:** Descargar de [ffmpeg.org](https://ffmpeg.org/download.html) y agregar al PATH.

</details>

<details>
<summary><b>Error de descarga de YouTube</b></summary>

```bash
pip install --upgrade yt-dlp
```

</details>

<details>
<summary><b>El bot se desconecta frecuentemente</b></summary>

1. Aumentar `MAX_RECONNECT_ATTEMPTS` en `.env`.
2. Verificar conexión a internet.
3. En Docker, asegurar que el contenedor tenga suficientes recursos.
</details>

<details>
<summary><b>Error "Cannot find module" en Docker</b></summary>

```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

</details>

<details>
<summary><b>¿Cómo hacer backup de la sesión?</b></summary>
Simplemente copiar la carpeta `vaniasession/`. Para restaurar, colocar los archivos en la misma ubicación antes de iniciar.
</details>

<details>
<summary><b>El bot no crea stickers</b></summary>

1. Asegurarse que FFmpeg esté instalado.
2. Confirmar que `sharp` se instaló correctamente.
3. Ver logs para errores específicos.
</details>

<details>
<summary><b>Error de MongoDB</b></summary>

Si usas MongoDB, verificar:

1. `DB_URI` es correcta.
2. El servidor MongoDB está corriendo.
3. Tienes acceso a la base de datos.
</details>

---

## Licencia

Distribuido bajo la licencia **MIT**. Ver [LICENSE](LICENSE) para más detalles.

---

<div align="center">
  <h3>Redes Sociales del Creador</h3>
  <p>
    <a href="https://github.com/CARLOSGRCIAGRCIA">
      <img src="https://img.shields.io/badge/GitHub-CARLOSGRCIAGRCIA-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub">
    </a>
    <a href="https://tiktok.com/@carlos.grcia0">
      <img src="https://img.shields.io/badge/TikTok-carlos.grcia0-000000?style=for-the-badge&logo=tiktok&logoColor=white" alt="TikTok">
    </a>
    <a href="https://instagram.com/carlos.gxv">
      <img src="https://img.shields.io/badge/Instagram-carlos.gxv-E4405F?style=for-the-badge&logo=instagram&logoColor=white" alt="Instagram">
    </a>
  </p>
  <p>
    Reportar problemas: <a href="https://github.com/CARLOSGRCIAGRCIA/vaniabot/issues"><b>Abrir un issue</b></a>
  </p>
  <br>
  <img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=2,3,4,12,24&height=100&section=footer" width="100%"/>
</div>
