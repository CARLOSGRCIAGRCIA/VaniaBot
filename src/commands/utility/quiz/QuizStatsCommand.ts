import { Command } from "../../Command.js";
import { quizService } from "@/services/study/QuizService.js";
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from "@/types/index.js";
import { serviceManager } from "@/services/system/Servicemanager.js";

export class QuizStatsCommand extends Command {
  name = "quizstats";
  description = "Tus estadísticas del modo estudio";
  category = CommandCategory.UTILITY;
  aliases = ["qstats", "misquiz", "quizperfil"];
  cooldown = 5000;
  contexts = [CommandContext.BOTH];
  usage = "!quizstats [@usuario]";
  examples = ["!quizstats", "!quizstats @Carlos"];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    let targetJid = ctx.sender.jid;
    let targetName = ctx.sender.pushName ?? "Tú";

    const mentioned =
      ctx.message?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (mentioned && (ctx.sender.isAdmin || ctx.sender.isOwner)) {
      targetJid = mentioned;
      targetName = mentioned.split("@")[0];
    }

    try {
      const user = await serviceManager.userService.getUser(targetJid);
      const stats = (user as any)?.quizStats;

      if (!stats || stats.totalAnswered === 0) {
        const isSelf = targetJid === ctx.sender.jid;
        await ctx.reply(
          isSelf
            ? `📊 Aún no has jugado ningún quiz.\nUsa *!quiz [categoría]* para empezar. 🎓`
            : `📊 *${targetName}* aún no ha jugado ningún quiz.`,
        );
        return;
      }

      await ctx.reply(quizService.formatStatsMessage(stats, targetName));
    } catch (err) {
      console.error("[QuizStatsCommand]", err);
      await ctx.reply("❌ No pude obtener tus estadísticas. Intenta de nuevo.");
    }
  }
}
