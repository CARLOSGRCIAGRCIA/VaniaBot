# VaniaBot - Notas del Proyecto

## Información General

| Atributo         | Valor          |
| ---------------- | -------------- |
| **Nombre**       | VaniaBot       |
| **Versión**      | 4.9.0          |
| **Licencia**     | MIT            |
| **Lenguaje**     | TypeScript     |
| **Runtime**      | Node.js 18+    |
| **WhatsApp Lib** | Baileys v6.7.9 |
| **Autor**        | Carlos G       |

## Arquitectura del Sistema

```
VaniaBot Core
├── Cliente WhatsApp (Baileys)
├── CommandRegistry (Registro de comandos)
├── MessageProcessor (Pipeline de middlewares)
└── Servicios especializados
    ├── AI (Groq, LLaMA 3, Whisper)
    ├── Moderación (Ban, Kick, Warn, AntiSpam)
    ├── Economía (Daily, Weekly, Work, Shop)
    ├── Juegos (Coinflip, Slots, Quiz, Listas)
    ├── Media (Stickers, Descargas)
    ├── Poesía IA (Poemas, Haikus, Sonetos)
    └── SubBots (Multi-device)
```

## Estructura de Directorios

```
src/
├── commands/          # Comandos por dominio
│   ├── admin/         # Moderación
│   ├── creative/      # Poesía IA
│   ├── economy/       # Economía
│   ├── game/          # Juegos
│   ├── media/         # Stickers/Descargas
│   ├── owner/         # Owner commands
│   └── utility/       # AI, Quiz, Herramientas
├── core/              # Cliente, Registry, Auth
├── handlers/          # Manejadores de eventos
├── middlewares/       # AntiSpam, Cooldown
├── models/            # User, Group
├── services/          # Lógica de negocio
│   ├── audio/
│   ├── creative/
│   ├── database/
│   ├── download/
│   ├── external/
│   ├── game/
│   ├── media/
│   ├── moderation/
│   ├── permission/
│   ├── study/
│   ├── subbot/
│   ├── system/
│   └── translator/
├── types/             # Tipos TypeScript
└── utils/             # Helpers, Logger, QR
```

## Dependencias Principales

```json
{
  "@whiskeysockets/baileys": "^6.7.9",
  "groq-sdk": "^0.37.0",
  "@google/generative-ai": "^0.24.1",
  "mongodb": "^7.1.0",
  "ioredis": "^5.9.3",
  "bull": "^4.16.5",
  "sharp": "^0.34.5",
  "yt-search": "^2.13.1",
  "zod": "^3.24.1",
  "pino": "^9.5.0"
}
```

## Comandos Principales

### Utilidades (15+ comandos)

- `.ping` - Latencia
- `.help` - Ayuda
- `.profile` - Perfil de usuario
- `.level` - Nivel y XP
- `.top` - Rankings
- `.inventory` - Inventario
- `.achievements` - Logros
- `.calc` - Calculadora
- `.moneda` - Conversor de moneda
- `.qr` - Generar QR
- `.traducir` - Traductor

### IA y Chat

- `.ai` - Chat con IA (Groq/LLaMA 3)
- `.aiclear` - Limpiar historial
- `.transcribe` - Transcribir audio

### Moderación (11 comandos)

- `.ban` / `.unban`
- `.kick`
- `.mute` / `.unmute`
- `.warn`
- `.promote` / `.demote`
- `.welcome` / `.goodbye`

### Economía (6 comandos)

- `.daily` - Recompensa diaria
- `.weekly` - Recompensa semanal
- `.work` - Trabajar
- `.shop` - Tienda
- `.buy` - Comprar
- `.pay` - Transferir

### Juegos (11 comandos)

- `.coinflip` - Apuesta cara/sello
- `.slots` - Tragamonedas
- `.quiz` - Quiz educativo
- `.clk`, `.vv2`, `.cuadrilatero`, etc. - Listas

### Media (10 comandos)

- `.sticker` - Crear sticker
- `.ytmp3` / `.ytmp4` - YouTube
- `.tiktok` - TikTok
- `.instagram` - Instagram
- `.facebook` - Facebook

### Poesía IA (13 comandos)

- `.poema` - Poema personalizado
- `.haiku` - Haikus
- `.soneto` - Soneto
- `.frases`, `.piropo`, `.dedicatoria`, etc.

## Configuración (.env)

| Variable           | Descripción            | Requerido |
| ------------------ | ---------------------- | --------- |
| `BOT_NAME`         | Nombre del bot         | No        |
| `BOT_PREFIX`       | Prefijo de comandos    | No (.)    |
| `OWNERS`           | IDs de owners          | Sí        |
| `DB_TYPE`          | json/mongodb           | No        |
| `GROQ_API_KEY`     | API de Groq            | **Sí**    |
| `USE_PAIRING_CODE` | Código de pareo        | No        |
| `NODE_ENV`         | development/production | No        |
| `LOG_LEVEL`        | Nivel de logging       | No        |

## Scripts Disponibles

```bash
npm start           # Iniciar bot
npm run qr          # Iniciar con QR
npm run code        # Iniciar con código pareo
npm run dev         # Desarrollo con watch
npm run build       # Compilar TypeScript
npm run lint        # ESLint
npm run format      # Prettier
npm run typecheck   # Verificación de tipos
npm run test        # Ejecutar tests
npm run test:watch # Tests en watch
```

## Características Técnicas

### Sistema de IA

- **Groq SDK** - LLaMA 3 para chat
- **Whisper** - Transcripción de audio
- **Proveedores**: Groq, Gemini, Ollama

### Base de Datos

- **JSON** (local) - Por defecto
- **MongoDB** - Opcional

### Cache

- **Redis** - Cache distribuido
- **Memory Cache** - Cache en memoria

### Descargas

- **yt-dlp** - YouTube, TikTok, Instagram, Facebook
- **Worker threads** - Descargas en background

### Testing

- **Vitest** - Framework de testing
- **Cobertura** con v8 provider

### Patterns Implementados

- Circuit Breaker
- Rate Limiting
- Retry Logic
- Batch Writing
- Message Queue (Bull)
- Fallback Chain para APIs

---

## ⭐ Características Únicas y Destacadas

### 1. Sistema de SubBots (Multi-Device)

**Lo que diferencia:** Permite ejecutar hasta **50 instancias paralelas** de WhatsApp desde un solo proceso.

```
SubBotManager
├── Registro dinámico de subbots
├── Sesiones independientes
├── Middlewares por instancia
├── Comunicación entre subbots
└── Persistencia en SQLite
```

- Cada subbot tiene su propia sesión de WhatsApp
- Middlewares personalizados por instancia
- Comandos específicos de owner
- Soporte para múltiples grupos

### 2. Sistema de Poesía IA con Votación

**Lo que diferencia:** El bot genera poesía creativa y los usuarios pueden **votar** los mejores trabajos, creando un sistema social dentro del bot.

```
PoesiaService
├── 13 tipos de contenido (poema, haiku, soneto, etc.)
├── Sistema de votación
├── Ranking de votos (poetop)
├── Estadísticas por autor
├── Cache inteligente
└── Dedicatorias personalizadas
```

### 3. Quiz Adaptativo con Dificultad Dinámica

**Lo que diferencia:** El quiz se adapta al nivel del usuario basándose en su rendimiento histórico.

```typescript
// Algoritmo de dificultad
if (accuracy > 80% || streak >= 5) → HARD
if (accuracy > 55% || streak >= 2) → MEDIUM
else → EASY
```

- Recompensas variables por dificultad
- Bonus de racha cada 3 aciertos
- Estadísticas por categoría
- Sistema de hints

### 4. Sistema de Listas Interactivas (CLK, VV2, etc.)

**Lo que diferencia:** Listas deportivas interactivas con simulación visual y tracking de resultados.

- Múltiples modalidades: CLK, VV2, Cuadrilátero, Trilátero, Hexagonal
- Sistema de rotaciones
- Pathfinding para simulaciones
- Cache de resultados

### 5. VaniaToggle (Bot por Grupo)

**Lo que diferencia:** Control granular para **habilitar/deshabilitar el bot por grupo**, útil para grupos grandes o eventos especiales.

```typescript
// Por defecto: enabled = true
await vaniaToggleService.enable(chatJid, userJid);
await vaniaToggleService.disable(chatJid, userJid);
await vaniaToggleService.isEnabled(chatJid);
```

- Persistencia en DB
- Notificaciones al togglear
- Middleware para filtrar mensajes

### 6. Sistema Anti-Spam Inteligente

**Lo que diferencia:** Ban automático temporal con tracking por segundo y minuto.

```typescript
// Configuración por defecto
maxMessagesPerSecond: 3
maxMessagesPerMinute: 20
banDurationMs: 5 minutos
```

- Tracking en tiempo real
- Auto-unban después de duración
- Limpieza periódica de memoria

### 7. LID Resolver (WhatsApp ID Resolution)

**Lo que diferencia:** Sistema para resolver **LIDs** (Legacy IDs) a números de teléfono, con cache para evitar llamadas repetidas.

```typescript
// Resuelve lid@lid a número de teléfono
await LidResolver.resolve(sock, lidJid);
// Cache en memoria para rendimiento
```

- Cache persistente en memoria
- Integración con Baileys
- Invalidación manual

### 8. Sistema de Permisos Granular

**Lo que diferencia:** Múltiples capas de verificación de permisos.

```
PermissionService
├── BotPermissionChecker (admin del grupo)
├── UserPermissionChecker (owner/admin)
├── GroupMetadataCache (cache de metadatos)
└── JidService (manejo de IDs)
```

- Verificación de admin del bot
- Verificación de owner global
- Permisos por comando
- Cache de grupos

---

## 🔧 Sistemas Avanzados Implementados

### 1. Circuit Breaker Pattern

Protege contra fallos en cascada de servicios externos.

```typescript
// Estados: CLOSED → HALF_OPEN → OPEN
// Threshold: 5 fallos → OPEN
// Recovery: 2 exitosos → CLOSED
// Timeout: 30 segundos
```

- Métricas en tiempo real
- Reset manual
- Health status por servicio

### 2. AI Fallback Chain

Sistema de failover automático para proveedores de IA.

```
Groq (LLaMA 3) → Gemini → Ollama (local)
```

- Detección automática de disponibilidad
- Priorización por velocidad
- Fallback transparente

### 3. Download Queue con p-limit

Cola de descargas con concurrencia controlada.

```typescript
// Concurrent downloads: 3 (configurable)
// Priorización de tareas
// Retry automático
// Stats en tiempo real
```

### 4. Batch Writer for Database

Escritura optimizada para evitar bloqueo de I/O.

- Escritura cada 3 segundos
- Buffer en memoria
- Flush en shutdown

### 5. Memory Cache con TTL

Cache en memoria con expiración configurable.

- LRU eviction
- Estadísticas de hits/misses
- Soporte para namespaces

### 6. Retry Service

Reintentos exponenciales con jitter.

```typescript
// maxRetries: 5
// baseDelay: 1000ms
// maxDelay: 30000ms
// exponential backoff + jitter
```

---

## 🏆 Puntos Fuertes del Proyecto

### Arquitectura

| Punto Fuerte               | Descripción                                   |
| -------------------------- | --------------------------------------------- |
| **Modularidad**            | each comando es independiente y reutilizable  |
| **Tipado completo**        | TypeScript strict con Zod para validación     |
| **Middleware Pipeline**    | Sistema de filtros antes de ejecutar comandos |
| **Patrones empresariales** | Circuit Breaker, Retry, Fallback, Queue       |
| **Testing**                | Tests para servicios core con Vitest          |

### Rendimiento

| Optimización           | Impacto                    |
| ---------------------- | -------------------------- |
| **Batch writes**       | Reduce I/O ~90%            |
| **Redis cache**        | Respuestas instantáneas    |
| **Download queue**     | Sin bloquear el event loop |
| **Worker threads**     | Descargas sin freeze       |
| **Connection pooling** | MongoDB optimizado         |

### Mantenibilidad

- **ESLint + Prettier** - Código uniforme
- **TypeScript strict** - Menos bugs en runtime
- **JSDoc** - Documentación en código
- **Logs estructurados** - Pino con niveles configurables

### Escalabilidad

- **SubBots** - Hasta 50 instancias
- **Horizontal scaling** - Compatible con PM2 cluster
- **MongoDB** - Base de datos escalable
- **Redis** - Cache distribuido

---

## 📊 Métricas del Proyecto

- **~90+ comandos** implementados
- **~60+ servicios** especializados
- **Tests** para servicios core
- **Middleware** para spam, permisos, cooldown
- **SubBots** - Múltiples instancias paralelas
- **18+ middlewares** especializados

---

## 🛠️ Stack Tecnológico Completo

### Core

| Tecnología      | Uso                |
| --------------- | ------------------ |
| TypeScript 5.7+ | Lenguaje principal |
| Node.js 18+     | Runtime            |
| Baileys v6.7.9  | Cliente WhatsApp   |
| ES Modules      | Sistema de módulos |

### IA & ML

| Tecnología | Uso                         |
| ---------- | --------------------------- |
| Groq SDK   | Chat LLaMA 3 (ultra rápido) |
| Gemini     | Fallback AI                 |
| Ollama     | AI local/offline            |
| Whisper    | Transcripción audio         |

### Base de Datos

| Tecnología    | Uso                     |
| ------------- | ----------------------- |
| lowdb (JSON)  | DB local por defecto    |
| MongoDB       | DB escalable (opcional) |
| Redis/ioredis | Cache distribuido       |
| SQLite        | SubBots                 |

### Rendering & Media

| Tecnología   | Uso                    |
| ------------ | ---------------------- |
| Sharp        | Procesamiento imágenes |
| Canvas       | Generación imágenes    |
| node-webpmux | Stickers animados      |
| Jimp         | Manipulación imágenes  |
| FFmpeg       | Audio/video            |

### Colas & Workers

| Tecnología     | Uso                     |
| -------------- | ----------------------- |
| Bull           | Message queues          |
| p-limit        | Concurrencia controlada |
| Worker threads | Descargas background    |

### Validation & Types

| Tecnología        | Uso                    |
| ----------------- | ---------------------- |
| Zod               | Validación de esquemas |
| TypeScript strict | Tipado completo        |

### Logging & Monitor

| Tecnología  | Uso                        |
| ----------- | -------------------------- |
| Pino        | Logging estructurado       |
| Pino-pretty | Logs visuales              |
| PM2         | Production process manager |

### Utils

| Tecnología      | Uso              |
| --------------- | ---------------- |
| Axios           | HTTP client      |
| Cheerio         | Web scraping     |
| yt-search       | Búsqueda YouTube |
| Math.js         | Calculadora      |
| QRCode Terminal | QR codes         |

---

## 📋 Lista de Middlewares

1. ValidationMiddleware
2. PermissionMiddleware
3. CooldownMiddleware
4. AntiSpamMiddleware
5. AutoRegisterMiddleware
6. MuteMiddleware
7. LoggerMiddleware
8. VaniaToggleMiddleware
9. AntiLinkMiddleware
10. AntiFakeMiddleware
11. GroupOnlyMiddleware
12. PrivateOnlyMiddleware
13. AdminOnlyMiddleware
14. OwnerOnlyMiddleware
15. RateLimitMiddleware
16. TypingMiddleware
17. UploadsMiddleware
18. WelcomeMiddleware

---

## Notas de Desarrollo

### Boot Process (vania.ts)

1. Verifica sesión existente
2. Muestra banner interactivo
3. Selecciona método auth (QR/Code)
4. Spawn proceso hijo con tsx
5. Manejo de reinicios automáticos
6. Graceful shutdown

### Message Flow

```
Mensaje recibido
    ↓
Middleware Pipeline (AntiSpam, Permisos, Cooldown)
    ↓
CommandRegistry (buscar comando)
    ↓
Ejecutar comando
    ↓
Respuesta al usuario
```

### Autenticación

-QR Code o Código de pareo

- Sesión almacenada en `vaniasession/`
- Soporte multi-device

## Dependencias del Sistema

| Dependencia | Descripción               |
| ----------- | ------------------------- |
| Node.js 18+ | Runtime                   |
| FFmpeg      | Procesamiento audio/video |
| Python 3.8+ | Para yt-dlp               |
| Git         | Control de versiones      |

## Commands Pattern

```typescript
// Estructura base de comando
class Command {
  name: string;
  description: string;
  category: CommandCategory;
  usage: string;

  execute(context: MessageContext, args: string[]): Promise<void>;
}
```

## Servicios Clave

| Servicio            | Descripción      |
| ------------------- | ---------------- |
| `AIService`         | Chat IA con Groq |
| `ModerationService` | Ban, kick, warn  |
| `UserService`       | Gestión usuarios |
| `LevelService`      | XP y niveles     |
| `DownloadService`   | YouTube, TikTok  |
| `StickerService`    | Crear stickers   |
| `PoesiaService`     | Poesía IA        |

## Troubleshooting Común

1. **Bot no responde**: Verificar prefijo y permisos admin
2. **Session not found**: Eliminar `vaniasession/` y re-escuchar
3. **Error FFmpeg**: InstalarFFmpeg del sistema
4. **Desconexiones frecuentes**: Aumentar `MAX_RECONNECT_ATTEMPTS`

## Docker

```bash
docker-compose up -d    # Iniciar
docker-compose logs -f  # Ver logs
docker-compose down    # Detener
```

Volúmenes:

- `vaniabot_session` - Sesiones
- `vaniabot_data` - Datos temporales
