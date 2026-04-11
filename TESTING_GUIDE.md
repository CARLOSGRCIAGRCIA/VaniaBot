# VaniaBot - Testing Guide

## Prefijo: `.` (configurable en .env)

---

## 🛠️ ADMIN (Requiere ADMIN)

| Comando       | Descripción                   | Prueba                               |
| ------------- | ----------------------------- | ------------------------------------ |
| `.antilink`   | Activar/desactivar antilink   | `.antilink on` / `.antilink off`     |
| `.antiarab`   | Activar/desactivar antiárabes | `.antiarab on` / `.antiarab off`     |
| `.antical`    | Anti llamadas                 | `.antical on` / `.antical off`       |
| `.antidelete` | Ver mensajes eliminados       | `.antidelete on` / `.antidelete off` |
| `.group`      | Configuración del grupo       | `.group info` / `.group close`       |
| `.add`        | Agregar usuario               | `.add 5219999999999`                 |
| `.kick`       | Expulsar usuario              | `.kick @usuario`                     |
| `.promote`    | Dar admin                     | `.promote @usuario`                  |
| `.demote`     | Quitar admin                  | `.demote @usuario`                   |

---

## ⚙️ SISTEMA (Owner)

| Comando                 | Descripción             | Prueba         |
| ----------------------- | ----------------------- | -------------- |
| `.boton` / `.vaniaon`   | Activar bot en grupo    | `.vaniaon`     |
| `.botoff` / `.vaniaoff` | Desactivar bot en grupo | `.vaniaoff`    |
| `.vaniastatus`          | Ver estado del bot      | `.vaniastatus` |
| `.restart`              | Reiniciar bot           | `.restart`     |
| `.speedtest`            | Test de velocidad       | `.speedtest`   |
| `.procesos`             | Ver procesos            | `.procesos`    |
| `.dashboard`            | Panel de control        | `.dashboard`   |

---

## 📥 DESCARGAS (Media)

| Comando               | Descripción         | Prueba                                     |
| --------------------- | ------------------- | ------------------------------------------ |
| `.tiktok`             | Descargar TikTok    | `.tiktok https://vm.tiktok.com/...`        |
| `.instagram`          | Descargar Instagram | `.instagram https://www.instagram.com/...` |
| `.facebook`           | Descargar Facebook  | `.facebook https://fb.watch/...`           |
| `.twitter`            | Descargar Twitter/X | `.twitter https://x.com/...`               |
| `.ytmp3`              | YouTube a MP3       | `.ytmp3 https://youtube.com/...`           |
| `.ytmp4`              | YouTube a MP4       | `.ytmp4 https://youtube.com/...`           |
| `.mega`               | Descargar Mega      | `.mega https://mega.nz/...`                |
| `.mediafire`          | Descargar Mediafire | `.mediafire https://mediafire.com/...`     |
| `.spotify` / `.sp`    | Buscar Spotify      | `.sp believer`                             |
| `.cuevana` / `.cv`    | Buscar películas    | `.cv avatar`                               |
| `.apk`                | Buscar APKs         | `.apk telegram`                            |
| `.pinterest` / `.pin` | Pinterest           | `.pin https://pinterest.com/...`           |
| `.buscar`             | Búsqueda web        | `.buscar Node.js`                          |

---

## 🎲 JUEGOS

| Comando             | Descripción      | Prueba       |
| ------------------- | ---------------- | ------------ |
| `.slots`            | Tragamonedas     | `.slots`     |
| `.ruleta`           | Ruleta rusa      | `.ruleta`    |
| `.dado`             | Dados            | `.dado`      |
| `.cf` / `.coinflip` | Cara o cruz      | `.cf`        |
| `.blackjack`        | Blackjack        | `.blackjack` |
| `.lista`            | Gestión de lista | `.lista`     |

---

## 💰 RPG / ECONOMÍA

| Comando               | Descripción        | Prueba        |
| --------------------- | ------------------ | ------------- |
| `.rpg`                | Panel RPG          | `.rpg`        |
| `.perfil`             | Tu perfil          | `.perfil`     |
| `.top`                | Top usuarios       | `.top`        |
| `.level`              | Tu nivel           | `.level`      |
| `.inventory` / `.inv` | Inventario         | `.inv`        |
| `.buy`                | Comprar item       | `.buy espada` |
| `.sell`               | Vender item        | `.sell`       |
| `.craft`              | Crafting           | `.craft`      |
| `.use`                | Usar item          | `.use poción` |
| `.heal`               | Curar              | `.heal`       |
| `.fight`              | Pelear             | `.fight`      |
| `.mercado`            | Mercado            | `.mercado`    |
| `.shop`               | Tienda             | `.shop`       |
| `.quest` / `.misión`  | Misiones           | `.quest`      |
| `.stats`              | Stats de batalla   | `.stats`      |
| `.daily`              | Recompensa diaria  | `.daily`      |
| `.weekly`             | Recompensa semanal | `.weekly`     |

---

## 🎭 CREATIVE

| Comando   | Descripción    | Prueba           |
| --------- | -------------- | ---------------- |
| `.poema`  | Generar poema  | `.poema amor`    |
| `.frases` | Frases随机     | `.frases`        |
| `.piropo` | Piropos        | `.piropo`        |
| `.haiku`  | Haiku          | `.haiku`         |
| `.amor`   | Compatibilidad | `.amor @usuario` |
| `.facto`  | Dato curioso   | `.facto`         |

---

## 😂 FUN

| Comando      | Descripción        | Prueba             |
| ------------ | ------------------ | ------------------ |
| `.chiste`    | Chiste aleatorio   | `.chiste`          |
| `.consejo`   | Consejo aleatorio  | `.consejo`         |
| `.anime`     | Info de anime      | `.anime naruto`    |
| `.película`  | Info de película   | `.película avatar` |
| `.horóscopo` | Horóscopo          | `.horóscopo aries` |
| `.verdad`    | Verdad o reto      | `.verdad`          |
| `.ship`      | Ver compatibilidad | `.ship @usuario`   |

---

## 🧠 AI / UTILIDADES

| Comando         | Descripción       | Prueba                       |
| --------------- | ----------------- | ---------------------------- |
| `.ai`           | Chat con IA       | `.ai hola`                   |
| `.traducir`     | Traducir texto    | `.traducir hola en`          |
| `.transcribe`   | Transcribir audio | (enviar audio)               |
| `.qr`           | Generar QR        | `.qr hola`                   |
| `.calc`         | Calculadora       | `.calc 2+2`                  |
| `.noticias`     | Últimas noticias  | `.noticias`                  |
| `.temperatura`  | Clima             | `.temperatura CDMX`          |
| `.githubsearch` | Buscar en GitHub  | `.githubsearch whatsapp bot` |

---

## 📦 STICKERS / MEDIA

| Comando           | Descripción       | Prueba                         |
| ----------------- | ----------------- | ------------------------------ |
| `.sticker` / `.s` | Crear sticker     | (enviar imagen + caption `.s`) |
| `.togif`          | Imagen a GIF      | `.togif`                       |
| `.toanime`        | Foto a anime      | (enviar foto + `.toanime`)     |
| `.qc`             | Quoted sticker    | (reenviar mensaje + `.qc`)     |
| `.nota`           | Sticker con texto | `.nota Hola`                   |
| `.pat`            | Patpat            | `.pat @usuario`                |

---

## 👤 USUARIO

| Comando   | Descripción      | Prueba    |
| --------- | ---------------- | --------- |
| `.perfil` | Ver perfil       | `.perfil` |
| `.stats`  | Tus estadísticas | `.stats`  |
| `.logros` | Logros           | `.logros` |
| `.reg`    | Registrarse      | `.reg`    |

---

## ℹ️ INFORMACIÓN

| Comando        | Descripción        | Prueba         |
| -------------- | ------------------ | -------------- |
| `.help`        | Ayuda              | `.help`        |
| `.ping`        | Ver latency        | `.ping`        |
| `.status`      | Estado del sistema | `.status`      |
| `.rules`       | Ver reglas         | `.rules`       |
| `.link`        | Ver link del grupo | `.link`        |
| `.resumirchat` | Resumir chat       | `.resumirchat` |

---

## 🎮 FREEFIRE

| Comando     | Descripción        | Prueba         |
| ----------- | ------------------ | -------------- |
| `.freefire` | Info de jugador FF | `.freefire ID` |
| `.fftop`    | Top FF             | `.fftop`       |
| `.ffearena` | Arena FF           | `.ffearena ID` |

---

## 🧪 QUIZ

| Comando    | Descripción    | Prueba     |
| ---------- | -------------- | ---------- |
| `.quiz`    | Iniciar trivia | `.quiz`    |
| `.quiztop` | Top quiz       | `.quiztop` |

---

## 🧪 TEST BÁSICO (Ejecutar en orden)

```bash
# 1. Sistema
.ping
.help

# 2. Admin
.vaniaon
.vaniastatus
.antilink off

# 3. Usuario
.perfil
.reg

# 4. Fun
.chiste
.facto
.horóscopo aries

# 5. AI
.ai hola

# 6. Media
.buscar prueba
.apk whatsapp

# 7. Juegos
.slots
.dado
.cf

# 8. RPG (si tienes registro)
.daily
.rpg

# 9. Apagar
.vaniaoff
```

---

## ⚠️ Notas

- Algunos comandos requieren permisos de admin o owner
- Algunos comandos necesitan API keys configuradas (GROQ, GEMINI, etc.)
- Los comandos NSFW pueden estar deshabilitados
- Algunas funciones requieren configuración adicional
