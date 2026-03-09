import { Command } from "../Command.js";
import { CommandCategory, CommandContext } from "@/types/index.js";
import type { MessageContext } from "@/types/index.js";
import { listaManager, type ListaTipo } from "@/services/ListaManager.js";
import { logError } from "@/utils/logger.js";

interface ListaConfig {
  tipo: ListaTipo;
  tieneLiga: boolean;
  tieneColor: boolean;
}

export class ListaCommand extends Command {
  name: string;
  description: string;
  category = CommandCategory.GAME;
  aliases: string[];
  contexts = [CommandContext.GROUP];

  private config: ListaConfig;

  constructor(config: ListaConfig & { name: string; aliases: string[] }) {
    super();
    this.name = config.name;
    this.description = `Crea una lista de ${config.name.toUpperCase()}`;
    this.aliases = config.aliases;
    this.config = config;
  }

  async execute(ctx: MessageContext): Promise<void> {
    const cleanArgs = ctx.args.filter((a) => !a.startsWith("@"));

    let hora: string | undefined;
    let liga: string | undefined;
    let color: string | undefined;

    for (const arg of cleanArgs) {
      if (/^\d{1,2}(?::\d{2})?\s*(?:am|pm)?$/i.test(arg)) {
        hora = arg;
      } else if (this.config.tieneLiga && !liga) {
        liga = arg;
      } else if (this.config.tieneColor && !color) {
        color = arg;
      }
    }

    try {
      const tempLista = listaManager.crearLista({
        tipo: this.config.tipo,
        chatJid: ctx.chat.jid,
        messageId: "temp",
        horaTexto: hora,
        liga,
        color,
      });

      const textoInicial = listaManager.renderizar(tempLista);
      listaManager.desactivarLista("temp");

      const sent = await ctx.sock.sendMessage(ctx.chat.jid, {
        text: textoInicial,
        mentions: [],
      });

      if (!sent?.key?.id) {
        await ctx.reply("❌ Error al crear la lista");
        return;
      }

      listaManager.crearLista({
        tipo: this.config.tipo,
        chatJid: ctx.chat.jid,
        messageId: sent.key.id,
        horaTexto: hora,
        liga,
        color,
      });
    } catch (error) {
      logError(`ListaCommand ${this.name}`, error);
      await ctx.reply("❌ Error al crear la lista");
    }
  }
}

export const clkCommand = new ListaCommand({
  name: "clk",
  aliases: ["CLK"],
  tipo: "clk",
  tieneLiga: true,
  tieneColor: false,
});

export const vv2Command = new ListaCommand({
  name: "vv2",
  aliases: ["VV2"],
  tipo: "vv2",
  tieneLiga: false,
  tieneColor: false,
});

export const cuadrilateroCommand = new ListaCommand({
  name: "cuadrilatero",
  aliases: ["cuadri", "cuad"],
  tipo: "cuadrilatero",
  tieneLiga: false,
  tieneColor: true,
});

export const trilateroCommand = new ListaCommand({
  name: "trilatero",
  aliases: ["tri"],
  tipo: "trilatero",
  tieneLiga: false,
  tieneColor: true,
});

export const hexagonalCommand = new ListaCommand({
  name: "hexagonal",
  aliases: ["hexa", "hex"],
  tipo: "hexagonal",
  tieneLiga: false,
  tieneColor: true,
});

export const ascensoCommand = new ListaCommand({
  name: "ascenso",
  aliases: ["asc"],
  tipo: "ascenso",
  tieneLiga: false,
  tieneColor: false,
});

export const scrimCommand = new ListaCommand({
  name: "scrim",
  aliases: ["sc"],
  tipo: "scrim",
  tieneLiga: false,
  tieneColor: false,
});
