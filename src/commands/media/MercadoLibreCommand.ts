import { Command } from '../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import axios from 'axios';
import { logger } from '@/utils/logger.js';

interface MercadoLibreItem {
  title: string;
  price: string;
  link: string;
  condition: string;
}

interface MLApiResult {
  title: string;
  price: number;
  currency_id: string;
  permalink: string;
  condition: string;
}

interface MLApiResponse {
  results: MLApiResult[];
}

export class MercadoLibreCommand extends Command {
  name        = 'mercadolibre';
  description = 'Buscar productos en MercadoLibre';
  category    = CommandCategory.MEDIA;
  aliases     = ['ml', 'mercadolibre'];
  usage       = '!mercadolibre <búsqueda>';
  examples    = ['!mercadolibre TV Samsung', '!mercadolibre iPhone'];
  cooldown    = 15_000;

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args.join(' ').trim();

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
        await ctx.reply(`❌ No se encontraron resultados para: *${query}*`);
        return;
      }

      const maxItems = Math.min(items.length, 10);
      const conditionLabel = (c: string) => (c === 'new' ? '🆕 Nuevo' : '♻️ Usado');

      let message = `╭━━━〔 🛒 MERCADO LIBRE 〕━━━⬣\n`;
      message += `✩ *${query}* ✩\n\n`;

      for (let i = 0; i < maxItems; i++) {
        const item = items[i];
        const shortTitle =
          item.title.length > 50 ? item.title.substring(0, 50) + '...' : item.title;

        message += `*${i + 1}.* ${shortTitle}\n`;
        message += `   💰 ${item.price}  ${conditionLabel(item.condition)}\n`;
        message += `   🔗 ${item.link}\n\n`;
      }

      message += `╰━━━━━━━━━━━━━━━━━━━━━━⬣`;

      await ctx.reply(message);
      await ctx.react('✅');
    } catch (error) {
      logger.error('[MercadoLibreCommand] Error:', error);
      await ctx.react('❌');
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *error* ˚₊· ͟͟͞͞➳\n\n` +
          `❌ No pude buscar en MercadoLibre. Intenta de nuevo.`,
      );
    }
  }

  private async searchMercadoLibre(query: string): Promise<MercadoLibreItem[]> {
    const encodedQuery = encodeURIComponent(query);

    const url = `https://api.mercadolibre.com/sites/MLM/search?q=${encodedQuery}&limit=10`;

    const response = await axios.get<MLApiResponse>(url, {
      timeout: 15_000,
      headers: {
        Accept: 'application/json',
      },
    });

    const results = response.data?.results;
    if (!results || results.length === 0) return [];

    return results.map(item => ({
      title:     item.title,
      price:     `${item.currency_id} $${item.price.toLocaleString('es-MX')}`,
      link:      item.permalink,
      condition: item.condition,
    }));
  }
}