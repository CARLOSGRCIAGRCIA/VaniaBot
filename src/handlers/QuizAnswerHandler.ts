import { quizService } from "@/services/study/QuizService.js";
import { answerValidator } from "@/services/study/AnswerValidator.js";
import { difficultyEngine } from "@/services/study/DifficultyEngine.js";
import { serviceManager } from "@/services/Servicemanager.js";
import type { MessageContext } from "@/types/index.js";

class QuizAnswerHandler {
  async handle(ctx: MessageContext): Promise<boolean> {
    if (!ctx.chat.isGroup) {
      return false;
    }

    const hasSession = quizService.hasActiveSession(ctx.chat.jid);

    if (!hasSession) return false;

    const text = ctx.text?.trim();
    if (!text) return false;

    if (text.startsWith("!") || text.startsWith("/")) {
      if (text.toLowerCase() === "!hint" || text.toLowerCase() === "/hint") {
        await this._handleHint(ctx);
        return true;
      }
      return false;
    }

    const getUserStats = async (jid: string) => {
      try {
        const user = await serviceManager.userService.getUser(jid);
        return (user as any)?.quizStats ?? null;
      } catch {
        return null;
      }
    };

    const updateStats = async (jid: string, patch: any) => {
      try {
        const user = await serviceManager.userService.getUser(jid);
        if (!user) return;
        const prev = (user as any).quizStats ?? {
          totalCorrect: 0,
          totalAnswered: 0,
          totalScore: 0,
          bestStreak: 0,
          currentStreak: 0,
          byCategory: {},
          lastPlayed: 0,
          sessionsPlayed: 0,
        };
        const updated = {
          ...prev,
          totalCorrect: prev.totalCorrect + (patch.totalCorrect ?? 0),
          totalAnswered: prev.totalAnswered + (patch.totalAnswered ?? 0),
          currentStreak:
            patch.currentStreak !== undefined
              ? patch.currentStreak
              : prev.currentStreak,
          bestStreak: Math.max(prev.bestStreak, patch.currentStreak ?? 0),
          lastPlayed: patch.lastPlayed ?? prev.lastPlayed,
        };
        await serviceManager.userService.updateUser(jid, {
          quizStats: updated,
        } as any);
      } catch {}
    };

    const awardCoins = async (jid: string, amount: number) => {
      try {
        await serviceManager.userService.addMoney(jid, amount);
      } catch {}
    };

    const awardXP = async (jid: string, amount: number) => {
      try {
        await serviceManager.userService.addXP(jid, amount);
      } catch {}
    };

    const result = await quizService.processAnswer(
      ctx.chat.jid,
      ctx.sender.jid,
      ctx.sender.pushName ?? ctx.sender.jid,
      text,
      {
        sendFn: (_, msg) => ctx.reply(msg),
        getUserStats,
        updateStats,
        awardCoins,
        awardXP,
      },
    );

    if (!result) return false;

    const { player, coinsAwarded, xpAwarded, newStreak, sessionEnded } = result;

    const streakMsg =
      newStreak >= 3
        ? `\n🔥 *¡Racha de ${newStreak}!* +${difficultyEngine.calculateCoins("medium" as any, newStreak) - 35} bonus`
        : "";

    const hintPenalty = player.usedHint
      ? "\n_(recompensa reducida por usar hint)_"
      : "";

    await ctx.reply(
      `✅ *¡Correcto, ${player.pushName}!*\n\n` +
        `💰 +${coinsAwarded} monedas\n` +
        `⭐ +${xpAwarded} XP` +
        streakMsg +
        hintPenalty +
        (sessionEnded ? "" : "\n\n_Siguiente pregunta en 4s..._"),
    );

    return true;
  }

  private async _handleHint(ctx: MessageContext): Promise<void> {
    const hint = quizService.getHint(ctx.chat.jid, ctx.sender.jid);
    if (!hint) return;

    await ctx.reply(
      `💡 *Pista:* ${hint}\n\n` +
        `_(Si respondes correctamente ganarás 50% menos monedas)_`,
    );
  }
}

export const quizAnswerHandler = new QuizAnswerHandler();
