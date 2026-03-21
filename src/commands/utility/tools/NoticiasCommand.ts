import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { newsService } from '@/services/external/NewsService.js';

const CATEGORIES = [
  { id: 'top', name: 'Destacadas', emoji: '🔥' },
  { id: 'world', name: 'Mundo', emoji: '🌍' },
  { id: 'business', name: 'Negocios', emoji: '💼' },
  { id: 'technology', name: 'Tecnología', emoji: '💻' },
  { id: 'science', name: 'Ciencia', emoji: '🔬' },
  { id: 'sports', name: 'Deportes', emoji: '⚽' },
  { id: 'entertainment', name: 'Espectáculos', emoji: '🎬' },
  { id: 'health', name: 'Salud', emoji: '🏥' },
];

export class NoticiasCommand extends Command {
  name = 'noticias';
  description = 'Consulta las últimas noticias';
  category = CommandCategory.UTILITY;
  aliases = ['noticias', 'news', 'n'];
  usage = '!noticias [categoría]';
  examples = ['!noticias', '!noticias tecnologia', '!noticias deportes'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args.join(' ').toLowerCase().trim();

    if (!args || args === 'ayuda' || args === 'help') {
      await this.showHelp(ctx);
      return;
    }

    const category = CATEGORIES.find(c => c.name.toLowerCase().includes(args) || c.id === args);

    await ctx.react('📰');

    const articles = category
      ? await newsService.getTopHeadlines(category.id)
      : await newsService.searchNews(args);

    if (articles.length === 0 || !articles[0].url) {
      await ctx.reply(
        `❌ No encontré noticias. La API puede no estar configurada.\n\nAgrega *NEWSDATA_API_KEY* a tu archivo .env`,
      );
      return;
    }

    const header = category
      ? `${category.emoji} *${category.name}*`
      : `🔍 *Resultados para: ${args}*`;
    let msg = `${header}\n━━━━━━━━━━━━━━━━\n\n`;

    for (const article of articles) {
      const title = article.title.length > 80 ? article.title.slice(0, 77) + '...' : article.title;
      msg += `📰 *${title}*\n`;
      if (article.description) {
        msg += `   ${article.description.slice(0, 100)}...\n`;
      }
      msg += `   📍 ${article.source} • ${article.publishedAt}\n\n`;
    }

    msg += `> _*VaniaBot💝*_`;

    await ctx.reply(msg);
    await ctx.react('✅');
  }

  private async showHelp(ctx: MessageContext): Promise<void> {
    let msg = `📰 *Noticias - VaniaBot*\n\n`;
    msg += `*Categorías disponibles:*\n\n`;

    for (const cat of CATEGORIES) {
      msg += `${cat.emoji} ${cat.name}\n`;
    }

    msg += `\n*Uso:*\n`;
    msg += `  !noticias (destacadas)\n`;
    msg += `  !noticias tecnologia\n`;
    msg += `  !noticias deportes`;

    await ctx.reply(msg);
  }
}
