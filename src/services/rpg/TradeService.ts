import { itemRegistry } from './ItemRegistry.js';
import { itemService } from './ItemService.js';
import { serviceManager } from '../system/Servicemanager.js';

export interface TradeOffer {
  id: string;
  sellerJid: string;
  itemId: string;
  itemName: string;
  price: number;
  quantity: number;
  createdAt: number;
}

export interface TradeResult {
  success: boolean;
  message: string;
}

export class TradeService {
  private static instance: TradeService;
  private marketOffers: Map<string, TradeOffer> = new Map();
  private tradeCooldowns: Map<string, number> = new Map();

  private readonly TRADE_COOLDOWN = 30000;
  private readonly MAX_MARKET_FEE = 0.05;

  static getInstance(): TradeService {
    if (!TradeService.instance) {
      TradeService.instance = new TradeService();
    }
    return TradeService.instance;
  }

  async createOffer(
    jid: string,
    itemIdOrName: string,
    price: number,
    quantity: number = 1,
  ): Promise<TradeResult> {
    const user = await serviceManager.userService.getUser(jid);

    if (price < 1) {
      return { success: false, message: '❌ El precio debe ser mayor a 0' };
    }

    const item = user.inventory?.find(
      i =>
        i.itemId.toLowerCase() === itemIdOrName.toLowerCase() ||
        i.name.toLowerCase().includes(itemIdOrName.toLowerCase()),
    );

    if (!item) {
      return { success: false, message: '❌ No tienes ese item' };
    }

    const itemData = itemRegistry.getItem(item.itemId);
    if (!itemData) {
      return { success: false, message: '❌ Item no válido' };
    }

    if ((item.quantity || 1) < quantity) {
      return { success: false, message: `❌ No tienes suficientes ${item.name}` };
    }

    const hasCooldown = this.tradeCooldowns.get(jid);
    if (hasCooldown && Date.now() - hasCooldown < this.TRADE_COOLDOWN) {
      const remaining = Math.ceil((this.TRADE_COOLDOWN - (Date.now() - hasCooldown)) / 1000);
      return { success: false, message: `❌ Espera ${remaining}s antes de vender de nuevo` };
    }

    const offerId = `${jid}_${item.itemId}_${Date.now()}`;
    const offer: TradeOffer = {
      id: offerId,
      sellerJid: jid,
      itemId: item.itemId,
      itemName: item.name,
      price,
      quantity,
      createdAt: Date.now(),
    };

    this.marketOffers.set(offerId, offer);

    for (let i = 0; i < quantity; i++) {
      await itemService.removeItem(jid, item.itemId);
    }

    this.tradeCooldowns.set(jid, Date.now());

    return {
      success: true,
      message: `✅ Pusiste ${quantity}x ${item.name} en el mercado por $${price * quantity}`,
    };
  }

  async buyItem(jid: string, offerId: string): Promise<TradeResult> {
    const offer = this.marketOffers.get(offerId);

    if (!offer) {
      return { success: false, message: '❌ Oferta no encontrada' };
    }

    if (offer.sellerJid === jid) {
      return { success: false, message: '❌ No puedes comprar tu propia oferta' };
    }

    const buyer = await serviceManager.userService.getUser(jid);
    const totalPrice = offer.price * offer.quantity;
    const marketFee = Math.floor(totalPrice * this.MAX_MARKET_FEE);
    const sellerGets = totalPrice - marketFee;

    if (buyer.money < totalPrice) {
      return {
        success: false,
        message: `❌ No tienes suficiente dinero. Necesitas: $${totalPrice}`,
      };
    }

    const removed = await serviceManager.userService.removeMoney(jid, totalPrice);
    if (!removed) {
      return { success: false, message: '❌ Error al procesar el pago' };
    }

    await serviceManager.userService.addMoney(offer.sellerJid, sellerGets);

    for (let i = 0; i < offer.quantity; i++) {
      await itemService.addItem(jid, offer.itemId);
    }

    this.marketOffers.delete(offerId);

    const itemData = itemRegistry.getItem(offer.itemId);

    return {
      success: true,
      message: `✅ ¡Compraste ${offer.quantity}x ${itemData?.name || offer.itemName} por $${totalPrice}!\n💰 El vendedor recibió: $${sellerGets}\n📊 Comisión del mercado: $${marketFee}`,
    };
  }

  async cancelOffer(jid: string, offerId: string): Promise<TradeResult> {
    const offer = this.marketOffers.get(offerId);

    if (!offer) {
      return { success: false, message: '❌ Oferta no encontrada' };
    }

    if (offer.sellerJid !== jid) {
      return { success: false, message: '❌ No puedes cancelar ofertas de otros' };
    }

    for (let i = 0; i < offer.quantity; i++) {
      await itemService.addItem(jid, offer.itemId);
    }

    this.marketOffers.delete(offerId);

    return {
      success: true,
      message: `✅ Cancelaste la oferta. Tu/s item/s devuelto/s al inventario`,
    };
  }

  getMarketOffers(): TradeOffer[] {
    return Array.from(this.marketOffers.values());
  }

  getMyOffers(jid: string): TradeOffer[] {
    return this.getMarketOffers().filter(offer => offer.sellerJid === jid);
  }

  formatMarket(page: number = 1, limit: number = 10): string {
    const offers = this.getMarketOffers();

    if (offers.length === 0) {
      return '🏪 *Mercado vacío*\n\n💡 Usa !sell [item] [precio] para vender';
    }

    const start = (page - 1) * limit;
    const paginatedOffers = offers.slice(start, start + limit);

    let message = `🏪 *MERCADO*\n\n`;
    message += `📦 Total de ofertas: ${offers.length}\n\n`;

    paginatedOffers.forEach((offer, index) => {
      const itemData = itemRegistry.getItem(offer.itemId);
      const emoji =
        itemData?.type === 'weapon'
          ? '⚔️'
          : itemData?.type === 'armor'
            ? '🛡️'
            : itemData?.type === 'consumable'
              ? '🧪'
              : itemData?.type === 'material'
                ? '🪨'
                : '📦';

      message += `${start + index + 1}. ${emoji} *${offer.itemName}*\n`;
      message += `   💰 Precio: $${offer.price} x${offer.quantity}\n`;
      message += `   🆔 ID: ${offer.id.slice(-8)}\n\n`;
    });

    const totalPages = Math.ceil(offers.length / limit);
    if (totalPages > 1) {
      message += `📄 Página ${page}/${totalPages}\n`;
      message += `💡 Usa !market [página] para ver más`;
    }

    return message.trim();
  }

  formatMyOffers(jid: string): string {
    const offers = this.getMyOffers(jid);

    if (offers.length === 0) {
      return '📦 *No tienes ofertas en el mercado*';
    }

    let message = '📦 *TUS OFERTAS*\n\n';

    offers.forEach((offer, index) => {
      message += `${index + 1}. *${offer.itemName}*\n`;
      message += `   💰 Precio: $${offer.price} x${offer.quantity}\n`;
      message += `   🆔 ID: ${offer.id.slice(-8)}\n`;
      message += `   ❌ !cancel ${offer.id.slice(-8)}\n\n`;
    });

    return message.trim();
  }

  formatBuyHelp(offerId: string): string {
    const offer = this.marketOffers.get(offerId);

    if (!offer) {
      return '❌ Oferta no encontrada';
    }

    const itemData = itemRegistry.getItem(offer.itemId);
    const totalPrice = offer.price * offer.quantity;

    return (
      `💰 *Confirmar compra*\n\n` +
      `Item: ${itemData?.name || offer.itemName}\n` +
      `Cantidad: ${offer.quantity}\n` +
      `Precio unitario: $${offer.price}\n` +
      `Total: $${totalPrice}\n\n` +
      `Usa !buy ${offer.id.slice(-8)} para comprar`
    );
  }
}

export const tradeService = TradeService.getInstance();
