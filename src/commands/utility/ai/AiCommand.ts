import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { aiService } from '@/services/external/AIService.js';

export class AiCommand extends Command {
  name = 'ai';
  description = 'Chatea con Vania IA. Mantiene historial de conversación.';
  category = CommandCategory.UTILITY;
  aliases = ['chat', 'vania', 'ask'];
  usage = '!ai <mensaje>';
  examples = [
    '!ai ¿cuánto es 15% de 340?',
    '!ai explícame qué es una API REST',
    '!ai háblame de la revolución mexicana',
  ];
  cooldown = 4000;
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.args.length) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *VaniaBot IA* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ háblame, quiero platicar contigo\n\n` +
          `✩ *lo que puedo hacer:*\n` +
          `  ﹒*!ai* <mensaje> — chateamos con recuerdos\n` +
          `  ﹒*!transcribe* — paso audios a texto\n` +
          `  ﹒*!aiclear* — borro mi memoria ✩`,
      );
      return;
    }

    await ctx.react('🤔');

    const response = await aiService.chat(ctx.chat.jid, ctx.sender.jid, ctx.args.join(' '));

    if (!response.success) {
      await ctx.react('❌');
      await ctx.reply(`❌ ${response.error}`);
      return;
    }

    await ctx.react('✅');

    if (response.text) {
      await ctx.reply(response.text);
    } else {
      await ctx.reply('✅ Listo');
    }
  }
}
