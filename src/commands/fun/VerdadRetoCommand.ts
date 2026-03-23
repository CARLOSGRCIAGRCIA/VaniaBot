import { Command } from '../Command.js';
import { aiService } from '@/services/external/AIService.js';
import { AI_PROMPTS } from '@/config/ai-prompts.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

export class VerdadRetoCommand extends Command {
  name = 'verdad';
  description = 'Juego de verdad o reto';
  category = CommandCategory.FUN;
  aliases = ['verdadoreto', 'vrd', 'reto'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!verdad [numero]';
  examples = ['!verdad', '!verdad 5'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args ?? [];
    const cantidad = Math.min(parseInt(args[0]) || 1, 5);

    await ctx.react('🎯');

    try {
      const prompt = AI_PROMPTS.VERDAD_O_RETO(cantidad);

      const response = await aiService.generate(prompt, 500);

      if (!response.success || !response.text) {
        await ctx.reply('No pude generar los retos. Intenta de nuevo.');
        return;
      }

      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *verdad o reto* ˚₊· ͟͟͞͞➳\n\n` +
          `${response.text.trim()}\n\n` +
          `✩ _para @${ctx.sender.pushName || 'ti'}_ ✩`,
      );

      await ctx.react('🎲');
    } catch {
      await ctx.reply('Ocurrió un error. Intenta de nuevo.');
    }
  }
}
