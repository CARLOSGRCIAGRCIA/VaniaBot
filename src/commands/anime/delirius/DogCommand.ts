import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class DogCommand extends Command {
  name = 'dog';
  description = 'Obtiene una imagen de perro aleatoria';
  category = CommandCategory.ANIME;
  aliases = ['dog', 'perro'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!dog';
  examples = ['!dog'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🐕');
    try {
      const imageUrl = await deliriusService.getRandomImage('dog');
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[DogCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
