import { Command } from "../Command.js";
import { CommandCategory } from "@/types/index.js";
import type { MessageContext } from "@/types/index.js";

export class HelpCommand extends Command {
  name = "help";
  description = "Muestra lista de comandos";
  category = CommandCategory.UTILITY;
  aliases = ["ayuda", "menu"];

  async execute(ctx: MessageContext): Promise<void> {
    const text = `
📚 *COMANDOS DISPONIBLES*

🔧 *Utilidad:*
- !ping - Verifica latencia
- !help - Este menú

🎨 *Media:*
- !sticker - Crea stickers

📌 Usa: !comando para ejecutar
`.trim();

    await ctx.reply(text);
  }
}

export default HelpCommand;
