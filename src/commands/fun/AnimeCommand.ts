import { Command } from '../Command.js';
import { aiService } from '@/services/external/AIService.js';
import { AI_PROMPTS } from '@/config/ai-prompts.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

const ANIMES = [
  '*Attack on Titan*\n📺 87+ episodios\n📝 Una humanidad lucha por sobrevivir contra titanes',
  '*Death Note*\n📺 37 episodios\n📝 Un estudiante encuentra un cuaderno mortal',
  '*Naruto*\n📺 220 episodios\n📝 La historia del ninja más persistente',
  '*One Piece*\n📺 1000+ episodios\n📝 Una tripulación busca el tesoro definitivo',
  '*Demon Slayer*\n📺 44+ episodios\n📝 Un joven combate demonios para salvar a su hermana',
];

export class AnimeCommand extends Command {
  name = 'anime';
  description = 'Recomienda un anime';
  category = CommandCategory.FUN;
  aliases = ['animerec', 'animes', 'animu'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!anime [género]';
  examples = ['!anime', '!anime acción', '!anime romance'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const rawGenero = ctx.args?.join(' ') ?? '';
    const safeGenero = rawGenero.replace(/[\n\r\t]/g, '').slice(0, 100);

    await ctx.react('🎌');

    try {
      const prompt = AI_PROMPTS.ANIME(safeGenero);

      const response = await aiService.generate(prompt, 200);

      if (!response.success || !response.text) {
        const fallback = ANIMES[Math.floor(Math.random() * ANIMES.length)];
        await ctx.reply(`🎌 *Recomendación Random* 🎌\n\n${fallback}`);
        return;
      }

      await ctx.reply(`🎌 *Recomendación de Anime* 🎌\n\n${response.text.trim()}`);
      await ctx.react('✨');
    } catch {
      const fallback = ANIMES[Math.floor(Math.random() * ANIMES.length)];
      await ctx.reply(`🎌 *Recomendación Random* 🎌\n\n${fallback}`);
    }
  }
}
