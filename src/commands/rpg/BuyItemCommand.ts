import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { tradeService } from '@/services/rpg/TradeService.js';

export class BuyItemCommand extends Command {
  name = 'buyitem';
  description = 'Compra un item del mercado';
  category = CommandCategory.RPG;
  requiresRegistration = true;
  aliases = ['compraritem', 'buyitem'];
  usage = '!buyitem [id]';
  examples = ['!buyitem abc12345'];

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args;

    if (args.length === 0) {
      await ctx.reply(
        '💰 *COMPRAR DEL MERCADO*\n\n' +
          'Usa !market para ver los items disponibles.\n\n' +
          '💡 *Ejemplo:* !buyitem abc12345',
      );
      return;
    }

    const offerIdPart = args[0];

    const offers = tradeService.getMarketOffers();
    const offer = offers.find(o => o.id.endsWith(offerIdPart));

    if (!offer) {
      await ctx.reply('❌ Oferta no encontrada\n💡 Usa !market para ver las ofertas');
      return;
    }

    const confirmMessage = tradeService.formatBuyHelp(offer.id);
    await ctx.reply(confirmMessage);

    try {
      const result = await tradeService.buyItem(ctx.sender.jid, offer.id);

      if (!result.success) {
        await ctx.reply(result.message);
        return;
      }

      await ctx.reply(result.message);
      await ctx.react('✅');
    } catch {
      await ctx.reply('❌ Error al comprar item');
    }
  }
}
