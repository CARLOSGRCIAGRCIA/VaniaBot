import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  emoji: string;
  type: 'role' | 'feature' | 'cosmetic';
  duration?: number;
}

export class BuyCommand extends Command {
  name = 'buy';
  description = 'Buy an item from the shop';
  category = CommandCategory.ECONOMY;
  aliases = ['comprar', 'purchase'];
  usage = '!buy <item_number>';
  examples = ['!buy 1', '!buy 5'];
  cooldown = 5000;

  private readonly SHOP_ITEMS: ShopItem[] = [
    {
      id: 'vip_role',
      name: 'VIP Role',
      description: 'VIP status for 7 days',
      price: 5000,
      emoji: '👑',
      type: 'role',
      duration: 7 * 24 * 60 * 60 * 1000,
    },
    {
      id: 'legend_role',
      name: 'Legend Role',
      description: 'Legend status for 7 days',
      price: 10000,
      emoji: '💎',
      type: 'role',
      duration: 7 * 24 * 60 * 60 * 1000,
    },
    {
      id: 'name_color',
      name: 'Custom Name Color',
      description: 'Customize your name color',
      price: 3000,
      emoji: '🎨',
      type: 'cosmetic',
    },
    {
      id: 'cooldown_bypass',
      name: 'Cooldown Bypass',
      description: 'Reduce cooldowns by 50% for 24h',
      price: 2000,
      emoji: '⚡',
      type: 'feature',
      duration: 24 * 60 * 60 * 1000,
    },
    {
      id: 'xp_boost',
      name: 'XP Boost',
      description: 'Double XP for 24 hours',
      price: 1500,
      emoji: '✨',
      type: 'feature',
      duration: 24 * 60 * 60 * 1000,
    },
    {
      id: 'lucky_charm',
      name: 'Lucky Charm',
      description: 'Increase game win chance by 10%',
      price: 2500,
      emoji: '🍀',
      type: 'feature',
      duration: 24 * 60 * 60 * 1000,
    },
  ];

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.args.length) {
      await ctx.reply(
        '❌ Specify item number\n\n' +
          '📖 Usage: !buy <item_number>\n' +
          '💡 Use !shop to see available items',
      );
      return;
    }

    const itemNumber = parseInt(ctx.args[0]);

    if (isNaN(itemNumber) || itemNumber < 1 || itemNumber > this.SHOP_ITEMS.length) {
      await ctx.reply(
        `❌ Invalid item number\n\n` +
          `Valid range: 1-${this.SHOP_ITEMS.length}\n` +
          `Use !shop to see items`,
      );
      return;
    }

    const item = this.SHOP_ITEMS[itemNumber - 1];
    const user = await serviceManager.userService.getUser(ctx.sender.jid);

    if (user.money < item.price) {
      await ctx.reply(
        `❌ Insufficient funds\n\n` +
          `${item.emoji} *${item.name}*\n` +
          `💵 Price: $${item.price.toLocaleString()}\n` +
          `💰 Your balance: $${user.money.toLocaleString()}\n` +
          `📉 Need: $${(item.price - user.money).toLocaleString()} more`,
      );
      return;
    }

    await ctx.react('⏳');

    try {
      await serviceManager.userService.removeMoney(ctx.sender.jid, item.price);

      const expiresAt = item.duration ? Date.now() + item.duration : undefined;

      await serviceManager.userService.addItemToInventory(ctx.sender.jid, {
        itemId: item.id,
        name: item.name,
        type: item.type,
        purchasedAt: Date.now(),
        expiresAt,
      });

      const updatedUser = await serviceManager.userService.getUser(ctx.sender.jid);

      let message = `✅ *Purchase Successful!*\n\n`;
      message += `${item.emoji} *${item.name}*\n`;
      message += `${item.description}\n\n`;

      message += `💵 Paid: $${item.price.toLocaleString()}\n`;
      message += `💰 New Balance: $${updatedUser.money.toLocaleString()}\n\n`;

      if (item.duration) {
        const days = Math.floor(item.duration / (24 * 60 * 60 * 1000));
        const hours = Math.floor((item.duration % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

        message += `⏰ Duration: ${days > 0 ? `${days}d ` : ''}${hours}h\n`;
        message += `📅 Expires: ${new Date(Date.now() + item.duration).toLocaleString()}\n\n`;
      }

      message += `📦 Item added to your inventory\n`;
      message += `Use !inventory to see your items\n\n`;

      message += `> _*VaniaBot💝*_`;

      await ctx.reply(message);
      await ctx.react('✅');
    } catch (error) {
      logError('[BuyCommand] Error', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await ctx.reply(`❌ Error processing purchase: ${errorMessage}`);
      await ctx.react('❌');
    }
  }
}
