import { Command } from '../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import axios, { AxiosError } from 'axios';
import { logger } from '@/utils/logger.js';

interface RedditPost {
  title: string;
  selftext: string;
  url: string;
  author: string;
  permalink: string;
}

interface RedditResponse {
  data: {
    children: Array<{
      data: RedditPost;
    }>;
  };
}

interface PromoDescuentosItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

export class DescuentosCommand extends Command {
  name = 'descuentos';
  description = 'Buscar ofertas y descuentos en Reddit y PromoDescuentos';
  category = CommandCategory.MEDIA;
  aliases = ['ofertas', 'deals'];
  usage = '!descuentos [reddit|promo|todas]';
  examples = ['!descuentos', '!descuentos reddit', '!descuentos promo'];
  cooldown = 15_000;

  async execute(ctx: MessageContext): Promise<void> {
    const arg = ctx.args[0]?.toLowerCase() || 'todas';

    await ctx.react('🔥');

    try {
      let message = '';

      if (arg === 'reddit') {
        message = await this.getRedditOfertas();
      } else if (arg === 'promo') {
        message = await this.getPromoDescuentos();
      } else {
        const redditMsg = await this.getRedditOfertas();
        const promoMsg = await this.getPromoDescuentos();
        message = redditMsg + '\n' + promoMsg;
      }

      await ctx.reply(message);
      await ctx.react('✅');
    } catch (error) {
      if (error instanceof AxiosError) {
        logger.error('[DescuentosCommand] AxiosError:', {
          message: error.message,
          code: error.code,
          status: error.response?.status,
          url: error.config?.url,
        });
      } else if (error instanceof Error) {
        logger.error('[DescuentosCommand] Error:', {
          name: error.name,
          message: error.message,
        });
      } else {
        logger.error('[DescuentosCommand] Unknown error:', error);
      }

      await ctx.react('❌');
      await ctx.reply(
        '˚₊· ͟͟͞͞➳ *error* ˚₊· ͟͟͞͞➳\n\n' + '❌ No pude obtener las ofertas. Intenta de nuevo.',
      );
    }
  }

  private async getRedditOfertas(): Promise<string> {
    const url = 'https://www.reddit.com/r/ofertas_mexico/new.json?limit=5';

    logger.info(`[DescuentosCommand] Fetching Reddit: ${url}`);

    const response = await axios.get<RedditResponse>(url, {
      timeout: 10_000,
      headers: {
        'User-Agent': 'VaniaBot/1.0',
        Accept: 'application/json',
      },
    });

    const posts = response.data?.data?.children?.map(child => child.data) || [];

    if (posts.length === 0) {
      return '';
    }

    let message = '━━━━━━━━━━━━━━━━━━\n';
    message += '📦 *Reddit: Ofertas México*\n';
    message += '━━━━━━━━━━━━━━━━━━\n\n';

    posts.slice(0, 5).forEach((post, i) => {
      const title = post.title.length > 60 ? post.title.substring(0, 60) + '...' : post.title;
      const link = post.selftext?.startsWith('http')
        ? post.selftext
        : `https://reddit.com${post.permalink}`;

      message += `${i + 1}. [${title}](${link})\n`;
      message += `   💬 por u/${post.author}\n\n`;
    });

    return message;
  }

  private async getPromoDescuentos(): Promise<string> {
    const url = 'https://www.promodescuentos.com/rss/tendencias';

    logger.info(`[DescuentosCommand] Fetching PromoDescuentos: ${url}`);

    const response = await axios.get(url, {
      timeout: 10_000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml',
      },
    });

    const items = this.parseRSS(response.data);

    if (items.length === 0) {
      return '';
    }

    let message = '━━━━━━━━━━━━━━━━━━\n';
    message += '💰 *PromoDescuentos*\n';
    message += '━━━━━━━━━━━━━━━━━━\n\n';

    items.slice(0, 5).forEach((item, i) => {
      const title = item.title.length > 60 ? item.title.substring(0, 60) + '...' : item.title;

      message += `${i + 1}. [${title}](${item.link})\n`;
      if (item.description) {
        const desc =
          item.description.length > 80
            ? item.description.substring(0, 80) + '...'
            : item.description;
        message += `   📝 ${desc}\n`;
      }
      message += '\n';
    });

    return message;
  }

  private parseRSS(xml: string): PromoDescuentosItem[] {
    const items: PromoDescuentosItem[] = [];

    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xml)) !== null && items.length < 10) {
      const itemXml = match[1];

      const getTag = (tag: string): string => {
        const tagRegex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
        const tagMatch = itemXml.match(tagRegex);
        return tagMatch ? tagMatch[1].trim() : '';
      };

      const title = getTag('title');
      const link = getTag('link');
      const description = getTag('description');
      const pubDate = getTag('pubDate');

      if (title && link) {
        items.push({ title, link, description, pubDate });
      }
    }

    return items;
  }
}
