import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { shopService } from '@/services/economy/ShopService.js';

export class BuyCommand extends Command {
  name = 'buy';
  description = 'Buy an item from the shop';
  category = CommandCategory.ECONOMY;
  aliases = ['comprar', 'purchase'];
  usage = '!buy <item_number>';
  examples = ['!buy 1', '!buy 5'];
  cooldown = 5000;

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
    const item = shopService.getItemByIndex(itemNumber);

    if (!item) {
      await ctx.reply(
        `❌ Invalid item number\n\n` +
          `Valid range: 1-${shopService.getItems().length}\n` +
          `Use !shop to see items`,
      );
      return;
    }

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
