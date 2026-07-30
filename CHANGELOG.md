# Bug Fixes — Diagnóstico de mensajes no procesados

## Causa raíz: Inconsistencia de prefijos en comando

**Archivo:** `src/core/MessageContext.ts:74`

`handleMessage` (`MainMessagePipeline.ts:138`) detectaba comandos con `config.prefix`, `.` y `!`, pero `parseCommand` solo aceptaba `config.prefix`. Si `BOT_PREFIX` no coincidía exactamente con el prefijo usado por el usuario (o si se usaba `!comando`), `parseCommand` devolvía `command: ''`, y el handler retornaba silenciosamente en `MainMessagePipeline.ts:216` sin ejecutar nada.

**Fix:** `parseCommand` ahora busca el primer prefijo que coincida entre `[config.prefix, '.', '!']`.

---

## PersistenceService — Null safety en carga de datos

**Archivo:** `src/services/system/PersistenceService.ts:94-143`

`loadReminders`, `loadPolls` y `loadListas` iteraban `Object.entries(stored)` sin verificar si cada valor era `null`. Datos corruptos/nulos en Redis causaban:
- `Cannot read properties of null (reading 'triggerAt')`
- `Cannot read properties of null (reading 'closed')`
- `Cannot read properties of null (reading 'activa')`

**Fix:** Agregados null-checks (`reminder &&`, `poll &&`, `if (!lista) continue`) antes de acceder propiedades.

---

## PluginLoader — Error context sin archivo

**Archivo:** `src/core/PluginLoader.ts:247`

Cuando un constructor de comando fallaba al instanciarse, el error se loggeaba como `[PluginLoader]` sin identificar qué archivo lo causó.

**Fix:** Se agregó `__filename` al contexto del error.
