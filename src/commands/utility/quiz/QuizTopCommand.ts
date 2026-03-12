import { Command } from '../../Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

interface QuizStats {
  totalCorrect: number;
  totalAnswered: number;
  totalScore: number;
  bestStreak: number;
  currentStreak: number;
  byCategory: Record<string, { correct: number; answered: number }>;
  lastPlayed: number;
  sessionsPlayed: number;
}

interface UserData {
  pushName?: string;
  quizStats?: QuizStats;
}

interface TopEntry {
  name: string;
  score: number;
  correct: number;
  accuracy: number;
  bestStreak: number;
}

export class QuizTopCommand extends Command {
  name = 'quiztop';
  description = 'Top jugadores de quiz del grupo';
  category = CommandCategory.UTILITY;
  aliases = ['qtop', 'quizrank', 'topquiz'];
  cooldown = 10000;
  contexts = [CommandContext.GROUP];
  usage = '!quiztop [categoria?]';
  examples = ['!quiztop', '!quiztop javascript'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const category = ctx.args?.[0]?.toLowerCase();

    try {
      const groupMeta = await ctx.sock.groupMetadata(ctx.chat.jid);
      const memberJids = groupMeta.participants.map(p => p.id);

      const entries: TopEntry[] = [];

      for (const jid of memberJids) {
        try {
          const user = (await serviceManager.userService.getUser(jid)) as unknown as UserData;
          const stats = user?.quizStats;
          if (!stats || stats.totalAnswered === 0) continue;

          let score = stats.totalScore ?? stats.totalCorrect * 35;
          let correct = stats.totalCorrect;
          let answered = stats.totalAnswered;

          if (category && stats.byCategory?.[category]) {
            const cat = stats.byCategory[category];
            correct = cat.correct;
            answered = cat.answered;
            score = correct * 35;
            if (answered === 0) continue;
          } else if (category) {
            continue;
          }

          const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
          const name = user?.pushName ?? jid.split('@')[0];

          entries.push({
            name,
            score,
            correct,
            accuracy,
            bestStreak: stats.bestStreak ?? 0,
          });
        } catch {
          // Ignorar errores individuales
        }
      }

      if (entries.length === 0) {
        await ctx.reply(
          category
            ? `📊 Nadie tiene estadísticas de *${category}* aún.`
            : `📊 Nadie ha jugado quiz en este grupo aún.\nUsa *!quiz [categoría]* para empezar. 🎓`,
        );
        return;
      }

      entries.sort((a, b) => b.score - a.score || b.correct - a.correct);
      const top = entries.slice(0, 10);

      const medals = ['🥇', '🥈', '🥉'];
      const rows = top
        .map((e, i) => {
          const medal = medals[i] ?? `${i + 1}.`;
          return (
            `${medal} *${e.name}*\n` +
            `    ✅ ${e.correct} correctas · 🎯 ${e.accuracy}% · 🔥 racha ${e.bestStreak}`
          );
        })
        .join('\n\n');

      await ctx.reply(
        `🏆 *Top Quiz${category ? ` — ${category}` : ''}*\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n\n` +
          rows +
          `\n\n> _VaniaBot💝 — Modo Estudio_`,
      );
    } catch (err) {
      console.error('[QuizTopCommand]', err);
      await ctx.reply('❌ Error al obtener el ranking. Intenta de nuevo.');
    }
  }
}
