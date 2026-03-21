export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  emoji: string;
  type: 'role' | 'feature' | 'cosmetic';
  duration?: number;
}

export class ShopService {
  private static instance: ShopService;

  static getInstance(): ShopService {
    if (!ShopService.instance) {
      ShopService.instance = new ShopService();
    }
    return ShopService.instance;
  }

  readonly SHOP_ITEMS: ShopItem[] = [
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
      description: 'Increase game win chance by 10% for 1 day',
      price: 2500,
      emoji: '🍀',
      type: 'feature',
      duration: 24 * 60 * 60 * 1000,
    },
  ];

  getItems(): ShopItem[] {
    return this.SHOP_ITEMS;
  }

  getItemById(id: string): ShopItem | undefined {
    return this.SHOP_ITEMS.find(item => item.id === id);
  }

  getItemByIndex(index: number): ShopItem | undefined {
    return this.SHOP_ITEMS[index - 1];
  }

  getItemsByType(type: ShopItem['type']): ShopItem[] {
    return this.SHOP_ITEMS.filter(item => item.type === type);
  }
}

export const shopService = ShopService.getInstance();
