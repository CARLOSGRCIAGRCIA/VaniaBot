import { Command } from '../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import axios from 'axios';
import { logger } from '@/utils/logger.js';

interface MercadoLibreItem {
  title: string;
  price: string;
  link: string;
}

export class MercadoLibreCommand extends Command {
  name = 'mercadolibre';
  description = 'Buscar productos en MercadoLibre';
  category = CommandCategory.MEDIA;
  aliases = ['ml', 'mercadolibre'];
  usage = '!mercadolibre <búsqueda>';
  examples = ['!mercadolibre TV Samsung', '!mercadolibre iPhone'];
  cooldown = 15_000;

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args.join(' ');

    if (!query) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *falta la búsqueda* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *!mercadolibre* <producto>\n` +
          `✩ ejemplo: *!mercadolibre TV* ✩`,
      );
      return;
    }

    await ctx.react('🔍');

    try {
      const items = await this.searchMercadoLibre(query);

      if (items.length === 0) {
        await ctx.react('❌');
        await ctx.reply(`❌ No se encontraron resultados para: ${query}`);
        return;
      }

      const maxItems = Math.min(items.length, 10);
      let message = `╭━━━〔 🛒 MERCADO LIBRE 〕━━━⬣\n\n`;

      for (let i = 0; i < maxItems; i++) {
        const item = items[i];
        const shortTitle =
          item.title.length > 50 ? item.title.substring(0, 50) + '...' : item.title;
        message += `${i + 1}. *${shortTitle}*\n`;
        message += `   💰 ${item.price}\n`;
        message += `   🔗 ${item.link}\n\n`;
      }

      message += `╰━━━━━━━━━━━━━━━━━━━━━━⬣`;

      await ctx.reply(message);
      await ctx.react('✅');
    } catch (error) {
      logger.error('[MercadoLibreCommand] Error:', error);
      await ctx.react('❌');
      await ctx.reply(`˚₊· ͟͟͞͞➳ *error* ˚₊· ͟͟͞͞➳\n\n` + `❌ No pude buscar en MercadoLibre.`);
    }
  }

  private async searchMercadoLibre(query: string): Promise<MercadoLibreItem[]> {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://listado.mercadolibre.com/${encodedQuery}`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 30_000,
    });

    const html = response.data as string;
    const items: MercadoLibreItem[] = [];

    const titleRegex = /"title":"([^"]+)"/g;
    const priceRegex = /"price":(\d+)/g;
    const linkRegex = /"permalink":"([^"]+)"/g;

    let titleMatch;
    let priceMatch;
    let linkMatch;

    const titles: string[] = [];
    while ((titleMatch = titleRegex.exec(html)) !== null) {
      titles.push(titleMatch[1]);
    }

    const prices: string[] = [];
    while ((priceMatch = priceRegex.exec(html)) !== null) {
      prices.push('$' + parseInt(priceMatch[1]).toLocaleString());
    }

    const links: string[] = [];
    while ((linkMatch = linkRegex.exec(html)) !== null) {
      links.push(linkMatch[1]);
    }

    const minLength = Math.min(titles.length, prices.length, links.length);
    for (let i = 0; i < minLength; i++) {
      items.push({
        title: titles[i],
        price: prices[i],
        link: links[i].substring(0, 60) + '...',
      });
    }

    return items;
  }
}
