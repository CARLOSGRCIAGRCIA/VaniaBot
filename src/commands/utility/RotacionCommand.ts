// import { Command } from "../Command.js";
// import { CommandCategory } from "@/types/index.js";
// import type { MessageContext } from "@/types/index.js";
// import { aiService } from "@/services/external/AIService.js";

// // GRID DEL MAPA
// // Columnas: A B C D E F G H I  (oeste → este)
// // Filas:    1 2 3 4 5 6 7 8 9 10  (norte → sur)
// // Formato coordenada: "fila,columna" ejemplo: "6,E" = fila 6 columna E (Brasilia)

// const MAPA_PURGATORIO = {
//   nombre: "Purgatorio",
//   grid: "Columnas A-I (oeste→este), Filas 1-10 (norte→sur)",

//   ubicaciones: {
//     // Zona A — Oeste
//     Marbleworks: { coord: "4,C", zona: "A" },
//     Quarry: { coord: "6,A", zona: "A" },
//     "Golf Course": { coord: "7,C", zona: "A" },
//     "Mt. Villa": { coord: "8,B", zona: "A" },
//     // Zona B — Norte
//     Crossroads: { coord: "2,C", zona: "B" },
//     Moathouse: { coord: "1,F", zona: "B" },
//     Fields: { coord: "4,G", zona: "B/C" },
//     // Zona C — Este
//     "Ski Lodge": { coord: "4,I", zona: "C" },
//     Forge: { coord: "6,I", zona: "C" },
//     Campsite: { coord: "7,G", zona: "C" },
//     // Zona D — Sur
//     Central: { coord: "9,D", zona: "D" },
//     "Fire Brigade": { coord: "9,F", zona: "D" },
//     "Lumber Mill": { coord: "9,H", zona: "D" },
//     // Centro
//     "Brasilia Norte": { coord: "5,E", zona: "Centro" },
//     "Brasilia Centro": { coord: "6,E", zona: "Centro" },
//     "Brasilia Sur": { coord: "7,E", zona: "Centro" },
//   },

//   zonas: {
//     A: {
//       nombre: "Zona A — Oeste",
//       subzonas: [
//         "Marbleworks (4,C)",
//         "Quarry (6,A)",
//         "Golf Course (7,C)",
//         "Mt. Villa (8,B)",
//       ],
//       centroAproximado: "6,B",
//     },
//     B: {
//       nombre: "Zona B — Norte",
//       subzonas: ["Crossroads (2,C)", "Moathouse (1,F)", "Fields norte (3,G)"],
//       centroAproximado: "2,E",
//     },
//     C: {
//       nombre: "Zona C — Este",
//       subzonas: [
//         "Ski Lodge (4,I)",
//         "Forge (6,I)",
//         "Campsite (7,G)",
//         "Fields (4,G)",
//       ],
//       centroAproximado: "5,H",
//     },
//     D: {
//       nombre: "Zona D — Sur",
//       subzonas: ["Central (9,D)", "Fire Brigade (9,F)", "Lumber Mill (9,H)"],
//       centroAproximado: "9,F",
//     },
//   },

//   movilidad: {
//     puentes: [
//       {
//         nombre: "Puente Norte — Marbleworks↔Crossroads",
//         conecta: ["Marbleworks (4,C)", "Crossroads (2,C)"],
//         coord: "3,C",
//         descripcion:
//           "Acceso directo zona A norte hacia zona B. Muy disputado en rotaciones A→B.",
//       },
//       {
//         nombre: "Puente Central Oeste — Golf Course↔Brasilia",
//         conecta: ["Golf Course (7,C)", "Brasilia Centro (6,E)"],
//         coord: "6,D",
//         descripcion:
//           "Principal cruce del río desde zona A hacia el centro. Cuello de botella crítico.",
//       },
//       {
//         nombre: "Puente Central — Fire Brigade↔Brasilia Sur",
//         conecta: ["Fire Brigade (9,F)", "Brasilia Sur (7,E)"],
//         coord: "8,F",
//         descripcion:
//           "Cruce sur del río desde zona D hacia Brasilia. Ruta natural D→Centro.",
//       },
//     ],
//     tirolesas: [
//       {
//         nombre: "Tirolesa Oeste-1 — flanco norte de Marbleworks↔Crossroads",
//         conecta: ["norte Marbleworks (3,B)", "Crossroads (2,C)"],
//         coord: "2,B",
//         descripcion:
//           "Flanco izquierdo del puente norte. Permite flanquear el puente evitando control directo.",
//       },
//       {
//         nombre: "Tirolesa Oeste-2 — flanco sur de Marbleworks↔Crossroads",
//         conecta: ["sur Marbleworks (5,C)", "Crossroads (3,D)"],
//         coord: "4,C",
//         descripcion:
//           "Flanco derecho del puente norte. Segunda opción de cruce rápido hacia B.",
//       },
//       {
//         nombre: "Tirolesa Marbleworks→Brasilia",
//         conecta: [
//           "borde Marbleworks/Golf Course (6,C)",
//           "Brasilia Centro (6,E)",
//         ],
//         coord: "6,D",
//         descripcion:
//           "Cruce express desde A al centro. Muy rápida pero te deposita directo en zona de combate.",
//       },
//       {
//         nombre: "Tirolesa Brasilia Sur→Central",
//         conecta: ["Brasilia Sur (7,E)", "Central (9,D)"],
//         coord: "8,D",
//         descripcion:
//           "Bajada rápida desde el centro hacia zona D. Útil para retroceder o alcanzar el cierre sur.",
//       },
//       {
//         nombre: "Tirolesa Lumber Mill→Forge",
//         conecta: ["Lumber Mill (9,H)", "borde Forge (7,I)"],
//         coord: "8,I",
//         descripcion:
//           "Conexión rápida D-este hacia C. Permite rotación D→C sin pasar por centro.",
//       },
//     ],
//   },

//   conflictos: {
//     "Brasilia (5-7,D-F)":
//       "Hub central. Cualquier equipo que cruce el río pasa por aquí. Combate casi garantizado, especialmente con cierre central.",
//     "Puente Golf Course↔Brasilia (6,D)":
//       "Cuello de botella A→Centro. Equipos de A y D convergen aquí.",
//     "Puente Fire Brigade↔Brasilia (8,F)":
//       "Cuello de botella D→Centro. Equipos de D y A convergen aquí.",
//     "Puente Marbleworks↔Crossroads (3,C)":
//       "Cuello de botella A→B. Equipos de A que suben al norte.",
//     "Fields (4,G)":
//       "Corredor abierto B↔C. Sin cobertura, cruce peligroso bajo fuego.",
//     "Campsite (7,G)": "Nodo C→D. Equipos de C que bajan al sur pasan por aquí.",
//   },

//   rotacionesEsperadas: {
//     A: "Tiende a subir por puente/tirolesa hacia B, o cruzar río hacia Brasilia por el puente de Golf Course o tirolesa de Marbleworks.",
//     B: "Baja por Crossroads hacia A o por Fields hacia C. Rara vez cruza al sur directo.",
//     C: "Baja por Campsite hacia D (Lumber Mill) o se mantiene en Fields hacia B. Puede tirolesa hacia Forge si el cierre es sur.",
//     D: "Sube por Fire Brigade hacia Brasilia o va este por Lumber Mill hacia C. Puente D→Brasilia es su ruta principal.",
//   },
// };

// function parseCoord(raw: string): string | null {
//   // Aceptara: "6,e" "6E" "e6" "E,6" → normaliza a "6,E"
//   const clean = raw.toUpperCase().replace(/\s/g, "");
//   const match =
//     clean.match(/^(\d+)[,]?([A-I])$/) || // "6,E" o "6E"
//     clean.match(/^([A-I])[,]?(\d+)$/); // "E,6" o "E6"

//   if (!match) return null;

//   const fila = match[1].match(/\d/) ? match[1] : match[2];
//   const columna = match[1].match(/[A-I]/) ? match[1] : match[2];
//   const filaNum = parseInt(fila);

//   if (filaNum < 1 || filaNum > 10) return null;
//   return `${filaNum},${columna}`;
// }

// function buildPrompt(posActual: string, coordCierre: string): string {
//   const zonaActual = inferirZona(posActual);

//   return `Eres un analista táctico experto en Free Fire Battle Royale — mapa Purgatorio.

// MAPA COMPLETO CON INFRAESTRUCTURA:
// ${JSON.stringify(MAPA_PURGATORIO, null, 2)}

// ═══════════════════════════════════
// SITUACIÓN TÁCTICA ACTUAL
// ═══════════════════════════════════
// • Mi posición actual: coordenada *${posActual}* (aprox. zona ${zonaActual})
// • Centro del siguiente cierre de zona: coordenada *${coordCierre}*
// • Escenario ranked: 4 equipos (uno por zona A/B/C/D). Ya lucharon en su zona y ahora rotan.
// • El cierre en *${coordCierre}* define hacia dónde TODOS los equipos deben moverse.

// REGLAS TÁCTICAS IMPORTANTES:
// 1. El río es una barrera física — cruzarlo SOLO es posible por los 3 puentes o las tirolesas listadas
// 2. Brasilia (5-7, D-F) = combate garantizado si el cierre cae ahí
// 3. Los puentes son cuellos de botella — quien llega primero tiene ventaja posicional
// 4. Las tirolesas son más rápidas pero te exponen en el aire sin posibilidad de cubrirte
// 5. Considera la distancia Manhattan en el grid para estimar velocidad de llegada de enemigos
// 6. Cada equipo enemigo tomará la ruta más corta desde su zona hacia el cierre en ${coordCierre}

// ANÁLISIS REQUERIDO:
// - Calcula qué equipos enemigos llegarán antes al cierre en ${coordCierre} desde sus zonas
// - Identifica qué puentes/tirolesas serán los más disputados dado el cierre en ${coordCierre}
// - Dame Top 3 rutas desde ${posActual} hacia ${coordCierre} considerando todo lo anterior

// FORMATO ESTRICTO (WhatsApp):
// *ROTACIÓN TÁCTICA — Purgatorio*
// *Posición:* ${posActual} | 🔵 *Cierre:* ${coordCierre}

// *Análisis de amenazas:*
// • [Qué equipo enemigo llega antes al cierre y por dónde]
// • [Qué puente/tirolesa estará más disputado]
// • [Zona más peligrosa del recorrido]

// *Ruta 1 — [nombre táctico]*
// • Camino: [coord inicio → subzona → coord final, usando infraestructura real]
// • Infraestructura: [puente/tirolesa que usas si aplica]
// • Riesgo: [bajo/medio/alto/muy alto]
// • Ventaja: [1 línea]
// • Desventaja: [1 línea]

// *Ruta 2 — [nombre táctico]*
// • Camino: [coord inicio → subzona → coord final]
// • Infraestructura: [puente/tirolesa si aplica]
// • Riesgo: [bajo/medio/alto/muy alto]
// • Ventaja: [1 línea]
// • Desventaja: [1 línea]

// *Ruta 3 — [nombre táctico]*
// • Camino: [coord inicio → subzona → coord final]
// • Infraestructura: [puente/tirolesa si aplica]
// • Riesgo: [bajo/medio/alto/muy alto]
// • Ventaja: [1 línea]
// • Desventaja: [1 línea]

// 💡 *Decisión óptima:* [2-3 líneas: ruta recomendada, por qué, y cómo posicionarte al llegar al cierre]

// Usa SOLO coordenadas y subzonas reales del mapa. Sé quirúrgicamente preciso.`;
// }

// function inferirZona(coord: string): string {
//   const [filaStr, col] = coord.split(",");
//   const fila = parseInt(filaStr);
//   const columna = col?.toUpperCase();

//   if (!columna || !fila) return "desconocida";

//   // Norte (filas 1-3) → B
//   if (fila <= 3) return "B";
//   // Este (columnas H-I) → C
//   if (["H", "I"].includes(columna)) return "C";
//   // Oeste (columnas A-C, filas 4-9) → A
//   if (["A", "B", "C"].includes(columna) && fila >= 4) return "A";
//   // Sur (filas 8-10, columnas D-H) → D
//   if (fila >= 8 && ["D", "E", "F", "G", "H"].includes(columna)) return "D";
//   // Centro
//   return "Centro (Brasilia)";
// }

// export class RotacionCommand extends Command {
//   name = "r cuadri";
//   description =
//     "Análisis de rotación táctica con coordenadas — Purgatorio (Free Fire)";
//   category = CommandCategory.UTILITY;
//   aliases = ["rot cuadri", "rotacion cuadri"];
//   usage = "!r cuadri [mi posición] [centro del cierre]";
//   examples = [
//     "!r cuadri 8,d 6,e",
//     "!r cuadri 4,i 9,f",
//     "!r cuadri 2,c 7,g",
//     "!r cuadri 6,a 5,e",
//   ];

//   async execute(ctx: MessageContext): Promise<void> {
//     const arg1 = ctx.args[0];
//     const arg2 = ctx.args[1];

//     if (!arg1 || !arg2) {
//       await ctx.reply(
//         `❌ *Faltan coordenadas*\n\n` +
//           `Uso: *!r cuadri [tu posición] [centro del cierre]*\n\n` +
//           `Formato coordenadas: *fila,columna*\n` +
//           `Columnas: A-I (oeste→este)\n` +
//           `Filas: 1-10 (norte→sur)\n\n` +
//           `Ejemplos:\n` +
//           `• !r cuadri 8,d 6,e → estoy en Central, cierre en Brasilia\n` +
//           `• !r cuadri 4,i 9,f → estoy en Ski Lodge, cierre en Fire Brigade\n` +
//           `• !r cuadri 2,c 7,g → estoy en Crossroads, cierre en Campsite\n\n` +
//           `Referencias rápidas:\n` +
//           `• Brasilia Centro: 6,E\n` +
//           `• Crossroads: 2,C | Moathouse: 1,F\n` +
//           `• Ski Lodge: 4,I | Forge: 6,I\n` +
//           `• Central: 9,D | Fire Brigade: 9,F | Lumber Mill: 9,H\n` +
//           `• Marbleworks: 4,C | Quarry: 6,A | Golf Course: 7,C`,
//       );
//       return;
//     }

//     const posActual = parseCoord(arg1);
//     const coordCierre = parseCoord(arg2);

//     if (!posActual) {
//       await ctx.reply(
//         `❌ Coordenada de posición inválida: *${arg1}*\nFormato: fila,columna (ej: 8,d)`,
//       );
//       return;
//     }
//     if (!coordCierre) {
//       await ctx.reply(
//         `❌ Coordenada de cierre inválida: *${arg2}*\nFormato: fila,columna (ej: 6,e)`,
//       );
//       return;
//     }

//     try {
//       await ctx.react("🗺️");
//     } catch {}

//     const zonaActual = inferirZona(posActual);
//     const zonaCierre = inferirZona(coordCierre);

//     await ctx.reply(
//       ` _Analizando posible rotación..._\n` +
//         `Posición: *${posActual}* (${zonaActual})\n` +
//         `Cierre: *${coordCierre}* (${zonaCierre})`,
//     );

//     const prompt = buildPrompt(posActual, coordCierre);
//     const response = await aiService.generate(prompt, 1400);

//     if (!response.success) {
//       await ctx.reply(`❌ Error al analizar: ${response.error}`);
//       return;
//     }

//     await ctx.sock.sendMessage(
//       ctx.chat.jid,
//       { text: response.text! },
//       { quoted: ctx.message },
//     );
//   }
// }

// export default RotacionCommand;
