import { Command } from "../Command.js";
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
} from "@/types/index.js";
import type { MessageContext } from "@/types/index.js";
import { welcomeService } from "@/services/WelcomeService.js";

export class GoodbyeCommand extends Command {
  name = "goodbye";
  description = "Configura mensajes de despedida";
  category = CommandCategory.ADMIN;
  aliases = ["despedida", "bye"];
  usage = "!goodbye [on/off/set/test/reset]";
  examples = [
    "!goodbye",
    "!goodbye on",
    "!goodbye off",
    "!goodbye set Adiós @user",
    "!goodbye test",
    "!goodbye reset",
  ];

  contexts = [CommandContext.GROUP];
  permissions = {
    user: [PermissionLevel.ADMIN],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const action = ctx.args[0]?.toLowerCase();

    if (!action) {
      await this.showConfig(ctx);
      return;
    }

    switch (action) {
      case "on":
      case "activar":
        await welcomeService.enableGoodbye(ctx.chat.jid);
        await ctx.reply("Despedida activada con mensaje por defecto");
        break;

      case "off":
      case "desactivar":
        await welcomeService.disableGoodbye(ctx.chat.jid);
        await ctx.reply("Despedida desactivada");
        break;

      case "set":
      case "establecer":
        const message = ctx.args.slice(1).join(" ");

        if (!message) {
          await ctx.reply(
            "Falta el mensaje\n\n" +
              "Ejemplo:\n" +
              "!goodbye set @user dijo adiós, qué pendejada\n\n" +
              "Variables:\n" +
              "@user  @group  @desc  @count",
          );
          return;
        }

        await welcomeService.setGoodbyeMessage(ctx.chat.jid, message);
        await ctx.reply("Mensaje de despedida guardado");
        break;

      case "test":
      case "probar":
        await welcomeService.handleParticipantLeft(
          ctx.sock,
          ctx.chat.jid,
          ctx.sender.jid,
        );
        break;

      case "reset":
      case "restablecer":
        await welcomeService.resetMessages(ctx.chat.jid);
        await ctx.reply("Mensajes restablecidos a los por defecto");
        break;

      default:
        await ctx.reply(
          "Comando no reconocido\n\n" +
            "Opciones:\n" +
            "on       → activar\n" +
            "off      → desactivar\n" +
            "set      → cambiar mensaje\n" +
            "test     → probar\n" +
            "reset    → volver a defecto",
        );
    }
  }

  private async showConfig(ctx: MessageContext): Promise<void> {
    const config = await welcomeService.getConfig(ctx.chat.jid);
    const goodbyeMsg =
      config.goodbye.message || welcomeService.getDefaultGoodbye();

    const text = `
✧･ﾟ:*  𝘾𝙊𝙉𝙁𝙄𝙂 𝘿𝙀𝙎𝙋𝙀𝘿𝙄𝘿𝘼  *:･ﾟ✧

Estado: ${config.goodbye.enabled ? "activado" : "desactivado"}

Mensaje actual:
${goodbyeMsg}

Comandos:
!goodbye on
!goodbye off
!goodbye set [texto]
!goodbye test
!goodbye reset

Variables: @user  @group  @desc  @count
    `.trim();

    await ctx.reply(text);
  }
}
