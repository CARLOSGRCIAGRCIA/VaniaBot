import { Command } from '../../Command.js';
import { quizService } from '@/services/study/QuizService.js';
import { logError } from '@/utils/logger.js';
import { difficultyEngine } from '@/services/study/DifficultyEngine.js';
import { QuizCategory, type UserQuizStats } from '@/services/study/QuizTypes.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

const CATEGORY_ALIASES: Record<string, string> = {
  js: QuizCategory.JAVASCRIPT,
  javascript: QuizCategory.JAVASCRIPT,
  ts: QuizCategory.TYPESCRIPT,
  typescript: QuizCategory.TYPESCRIPT,
  py: QuizCategory.PYTHON,
  python: QuizCategory.PYTHON,
  historia: QuizCategory.HISTORIA,
  history: QuizCategory.HISTORIA,
  ciencia: QuizCategory.CIENCIA,
  science: QuizCategory.CIENCIA,
  mate: QuizCategory.MATEMATICAS,
  matematicas: QuizCategory.MATEMATICAS,
  math: QuizCategory.MATEMATICAS,
  anime: QuizCategory.ANIME,
  cultura: QuizCategory.CULTURA,
  general: QuizCategory.CULTURA,
  geo: QuizCategory.GEOGRAFIA,
  geografia: QuizCategory.GEOGRAFIA,
};

const CATEGORIES_LIST = [
  '📜 historia',
  '🔬 ciencia',
  '➕ matematicas',
  '🎌 anime',
  '🌍 geografia',
  '🌐 cultura general',
  '💛 javascript',
  '🔷 typescript',
  '🐍 python',
].join('\n');

// ─── Local types ──────────────────────────────────────────────────────────────

interface UserWithQuizStats {
  quizStats?: UserQuizStats;
}

const DEFAULT_STATS: UserQuizStats = {
  totalCorrect: 0,
  totalAnswered: 0,
  totalScore: 0,
  bestStreak: 0,
  currentStreak: 0,
  byCategory: {},
  lastPlayed: 0,
  sessionsPlayed: 0,
};

// ──────────────────────────────────────────────────────────────────────────────

export class QuizCommand extends Command {
  name = 'quiz';
  description = 'Modo estudio — responde preguntas y gana monedas';
  category = CommandCategory.UTILITY;
  aliases = ['q', 'estudio', 'study'];
  cooldown = 3000;
  contexts = [CommandContext.GROUP];
  usage = '!quiz [categoría] [preguntas?] | !quiz stop';
  examples = ['!quiz javascript', '!quiz historia 10', '!quiz anime 5', '!quiz stop'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args ?? [];
    const first = args[0]?.toLowerCase();

    if (first === 'stop' || first === 'parar' || first === 'detener') {
      const canStop =
        ctx.sender.isAdmin ||
        ctx.sender.isOwner ||
        quizService.getSession(ctx.chat.jid)?.startedBy === ctx.sender.jid;

      if (!canStop) {
        await ctx.reply('❌ Solo quien inició el quiz o un admin puede detenerlo.');
        return;
      }

      const stopped = await quizService.stopSession(ctx.chat.jid, (_, text) => ctx.reply(text));
      if (!stopped) await ctx.reply('ℹ️ No hay un quiz activo en este grupo.');
      return;
    }

    if (!first) {
      await ctx.reply(
        `🎓 *Modo Estudio — VaniaBot*\n` +
          `━━━━━━━━━━━\n\n` +
          `*Uso:* !quiz [categoría] [preguntas]\n\n` +
          `*Categorías disponibles:*\n${CATEGORIES_LIST}\n\n` +
          `*Ejemplos:*\n` +
          `• !quiz javascript\n` +
          `• !quiz historia 10\n` +
          `• !quiz stop\n\n` +
          `La dificultad sube automáticamente según tu rendimiento.\n` +
          `Escribe *!hint* si necesitas una pista (reduce la recompensa).\n\n` +
          `> _VaniaBot💝 — Modo Estudio_`,
      );
      return;
    }

    if (quizService.hasActiveSession(ctx.chat.jid)) {
      await ctx.reply(
        'Ya hay un quiz activo en este grupo.\n' +
          'Usa *!quiz stop* para detenerlo antes de iniciar uno nuevo.',
      );
      return;
    }

    const rawCategory = first;
    const category = CATEGORY_ALIASES[rawCategory] ?? rawCategory;

    const rawCount = args[1] ? parseInt(args[1], 10) : 5;
    const total = isNaN(rawCount) || rawCount < 1 ? 5 : Math.min(rawCount, 15);

    const getUserStats = async (jid: string): Promise<UserQuizStats | null> => {
      try {
        const user = (await serviceManager.userService.getUser(jid)) as UserWithQuizStats | null;
        return user?.quizStats ?? null;
      } catch {
        return null;
      }
    };

    const updateStats = async (jid: string, patch: Partial<UserQuizStats>): Promise<void> => {
      try {
        const user = (await serviceManager.userService.getUser(jid)) as UserWithQuizStats | null;
        if (!user) return;

        const prev: UserQuizStats = user.quizStats ?? { ...DEFAULT_STATS };

        const updated: UserQuizStats = {
          ...prev,
          totalCorrect: prev.totalCorrect + (patch.totalCorrect ?? 0),
          totalAnswered: prev.totalAnswered + (patch.totalAnswered ?? 0),
          currentStreak:
            patch.currentStreak !== undefined ? patch.currentStreak : prev.currentStreak,
          bestStreak: Math.max(prev.bestStreak, patch.currentStreak ?? prev.currentStreak),
          lastPlayed: patch.lastPlayed ?? prev.lastPlayed,
          sessionsPlayed:
            patch.sessionsPlayed !== undefined ? prev.sessionsPlayed + 1 : prev.sessionsPlayed,
        };

        await serviceManager.userService.updateUser(jid, { quizStats: updated } as Parameters<
          typeof serviceManager.userService.updateUser
        >[1]);
      } catch (e) {
        logError('[QuizCommand] updateStats error', e);
      }
    };

    const awardCoins = async (jid: string, amount: number): Promise<void> => {
      try {
        await serviceManager.userService.addMoney(jid, amount);
      } catch {
        // Ignore reward errors - don't block quiz for reward failures
      }
    };

    const awardXP = async (jid: string, amount: number): Promise<void> => {
      try {
        await serviceManager.userService.addXP(jid, amount);
      } catch {
        // Ignore XP reward errors - don't block quiz for reward failures
      }
    };

    await ctx.reply(`Generando preguntas de *${category}*...`);

    const result = await quizService.startSession({
      groupId: ctx.chat.jid,
      startedBy: ctx.sender.jid,
      startedByName: ctx.sender.pushName ?? 'Alguien',
      category,
      totalQuestions: total,
      sendFn: (_, text) => ctx.reply(text),
      getUserStats,
      updateStats,
      awardCoins,
      awardXP,
    });

    if (!result.success) {
      await ctx.reply(`❌ ${result.error}`);
      return;
    }

    if (!result.firstQuestion || !result.difficulty) {
      await ctx.reply('❌ Error al obtener la primera pregunta.');
      return;
    }

    const q = result.firstQuestion;
    const diff = result.difficulty;

    await ctx.reply(
      `🎓 *Quiz iniciado* — ${total} preguntas\n` +
        `━━━━━━━━━━━\n` +
        `Categoría: *${category}*\n` +
        `${difficultyEngine.emoji(diff)} Dificultad inicial: *${difficultyEngine.label(diff)}*\n` +
        `Recompensas: hasta *${difficultyEngine.calculateCoins(diff, 5)} monedas* por respuesta\n\n` +
        `_La dificultad sube con tu racha._\n` +
        `_Usa !hint para pistas (reduce recompensa 50%)._\n\n` +
        `━━━━━━━━━━━\n` +
        `*Pregunta 1/${total}* ${difficultyEngine.emoji(diff)} ${difficultyEngine.label(diff)}\n` +
        `━━━━━━━━━━━\n\n` +
        `*${q.question}*\n\n` +
        `_Tienes 30 segundos..._`,
    );
  }
}
