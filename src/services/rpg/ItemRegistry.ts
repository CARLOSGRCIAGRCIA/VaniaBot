export type ItemType =
  | 'weapon'
  | 'armor'
  | 'helmet'
  | 'gloves'
  | 'boots'
  | 'accessory'
  | 'consumable'
  | 'material'
  | 'questItem'
  | 'pet';

export interface RPGItemStats {
  hp?: number;
  maxHp?: number;
  mana?: number;
  atk?: number;
  def?: number;
  str?: number;
  int?: number;
  agi?: number;
  vit?: number;
  luck?: number;
  energy?: number;
  critChance?: number;
  dodgeChance?: number;
  blockChance?: number;
}

export interface RPGItem {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  stats: RPGItemStats;
  value: number;
  sellValue: number;
  levelRequired: number;
  classRequired?: string[];
  useEffect?: {
    type: 'heal' | 'buff' | 'restoreEnergy' | 'restoreStamina' | 'xpBoost';
    value: number;
    duration?: number;
  };
  craftRecipe?: {
    materials: { itemId: string; quantity: number }[];
    requiredTool?: string;
  };
}

export class ItemRegistry {
  private static instance: ItemRegistry;
  private items: Map<string, RPGItem> = new Map();

  private constructor() {
    this.registerItems();
  }

  static getInstance(): ItemRegistry {
    if (!ItemRegistry.instance) {
      ItemRegistry.instance = new ItemRegistry();
    }
    return ItemRegistry.instance;
  }

  private registerItems(): void {
    const allItems: RPGItem[] = [
      ...this.getWeapons(),
      ...this.getArmor(),
      ...this.getConsumables(),
      ...this.getMaterials(),
      ...this.getPets(),
    ];

    allItems.forEach(item => this.items.set(item.id, item));
  }

  private getWeapons(): RPGItem[] {
    return [
      {
        id: 'wooden_sword',
        name: 'Espada de Madera',
        description: 'Una espada básica feita de madera',
        type: 'weapon',
        rarity: 'common',
        stats: { atk: 5 },
        value: 50,
        sellValue: 25,
        levelRequired: 1,
      },
      {
        id: 'iron_sword',
        name: 'Espada de Hierro',
        description: 'Una espada de hierro resistente',
        type: 'weapon',
        rarity: 'common',
        stats: { atk: 15 },
        value: 200,
        sellValue: 100,
        levelRequired: 5,
      },
      {
        id: 'steel_sword',
        name: 'Espada de Acero',
        description: 'Una espada de acero de buena calidad',
        type: 'weapon',
        rarity: 'uncommon',
        stats: { atk: 30, critChance: 5 },
        value: 500,
        sellValue: 250,
        levelRequired: 10,
      },
      {
        id: 'silver_sword',
        name: 'Espada de Plata',
        description: 'Una espada encantada con plata',
        type: 'weapon',
        rarity: 'rare',
        stats: { atk: 50, luck: 10 },
        value: 1500,
        sellValue: 750,
        levelRequired: 20,
      },
      {
        id: 'golden_sword',
        name: 'Espada Dorada',
        description: 'Una legendaria espada dorada',
        type: 'weapon',
        rarity: 'epic',
        stats: { atk: 80, critChance: 15, luck: 20 },
        value: 5000,
        sellValue: 2500,
        levelRequired: 35,
      },
      {
        id: 'diamond_sword',
        name: 'Espada de Diamante',
        description: 'La espada más dura conocida',
        type: 'weapon',
        rarity: 'legendary',
        stats: { atk: 120, critChance: 20, luck: 30 },
        value: 15000,
        sellValue: 7500,
        levelRequired: 50,
      },
      {
        id: 'dragon_sword',
        name: 'Espada de Dragón',
        description: 'Forjada con escamas de dragón',
        type: 'weapon',
        rarity: 'mythic',
        stats: { atk: 200, critChance: 30, luck: 50, str: 20 },
        value: 50000,
        sellValue: 25000,
        levelRequired: 75,
      },
      {
        id: 'wooden_bow',
        name: 'Arco de Madera',
        description: 'Un arco básico de entrenamiento',
        type: 'weapon',
        rarity: 'common',
        stats: { atk: 8, agi: 5 },
        value: 75,
        sellValue: 35,
        levelRequired: 1,
      },
      {
        id: 'hunters_bow',
        name: 'Arco del Cazador',
        description: 'Un arco usado por cazadores expertos',
        type: 'weapon',
        rarity: 'uncommon',
        stats: { atk: 25, agi: 15 },
        value: 600,
        sellValue: 300,
        levelRequired: 12,
      },
      {
        id: 'elven_bow',
        name: 'Arco Élfico',
        description: 'Un arco élfico de gran precisión',
        type: 'weapon',
        rarity: 'rare',
        stats: { atk: 55, agi: 25, critChance: 10 },
        value: 2000,
        sellValue: 1000,
        levelRequired: 25,
      },
      {
        id: 'wooden_staff',
        name: 'Bastón de Madera',
        description: 'Un bastón para mago novato',
        type: 'weapon',
        rarity: 'common',
        stats: { atk: 6, int: 8 },
        value: 60,
        sellValue: 30,
        levelRequired: 1,
      },
      {
        id: 'arcane_staff',
        name: 'Bastón Arcano',
        description: 'Un bastón que canaliza poder mágico',
        type: 'weapon',
        rarity: 'uncommon',
        stats: { atk: 20, int: 20, mana: 50 },
        value: 700,
        sellValue: 350,
        levelRequired: 15,
      },
      {
        id: 'void_staff',
        name: 'Bastón del Vacío',
        description: 'Un bastón de poder oscuro',
        type: 'weapon',
        rarity: 'epic',
        stats: { atk: 70, int: 45, critChance: 15 },
        value: 6000,
        sellValue: 3000,
        levelRequired: 40,
      },
      {
        id: 'dagger',
        name: 'Daga',
        description: 'Una daga rápida y afilada',
        type: 'weapon',
        rarity: 'common',
        stats: { atk: 10, agi: 10 },
        value: 100,
        sellValue: 50,
        levelRequired: 3,
      },
      {
        id: 'shadow_dagger',
        name: 'Daga de las Sombras',
        description: 'Una daga que Grants invisibilidad',
        type: 'weapon',
        rarity: 'rare',
        stats: { atk: 45, agi: 30, dodgeChance: 15 },
        value: 2500,
        sellValue: 1250,
        levelRequired: 22,
      },
    ];
  }

  private getArmor(): RPGItem[] {
    return [
      {
        id: 'leather_armor',
        name: 'Armadura de Cuero',
        description: 'Armadura básica de cuero',
        type: 'armor',
        rarity: 'common',
        stats: { def: 10, agi: 5 },
        value: 150,
        sellValue: 75,
        levelRequired: 1,
      },
      {
        id: 'iron_armor',
        name: 'Armadura de Hierro',
        description: 'Armadura de hierro resistente',
        type: 'armor',
        rarity: 'common',
        stats: { def: 25, vit: 5 },
        value: 400,
        sellValue: 200,
        levelRequired: 8,
      },
      {
        id: 'steel_armor',
        name: 'Armadura de Acero',
        description: 'Armadura de acero de calidad',
        type: 'armor',
        rarity: 'uncommon',
        stats: { def: 45, vit: 10, hp: 50 },
        value: 1000,
        sellValue: 500,
        levelRequired: 18,
      },
      {
        id: 'golden_armor',
        name: 'Armadura Dorada',
        description: 'Armadura legendaria dorada',
        type: 'armor',
        rarity: 'epic',
        stats: { def: 80, vit: 25, hp: 150, luck: 10 },
        value: 8000,
        sellValue: 4000,
        levelRequired: 40,
      },
      {
        id: 'dragon_armor',
        name: 'Armadura de Dragón',
        description: 'Armadura forjada con escamas de dragón',
        type: 'armor',
        rarity: 'mythic',
        stats: { def: 150, vit: 50, hp: 300, str: 20 },
        value: 30000,
        sellValue: 15000,
        levelRequired: 70,
      },
      {
        id: 'leather_helmet',
        name: 'Casco de Cuero',
        description: 'Casco protector básico',
        type: 'helmet',
        rarity: 'common',
        stats: { def: 5, hp: 20 },
        value: 80,
        sellValue: 40,
        levelRequired: 1,
      },
      {
        id: 'iron_helmet',
        name: 'Casco de Hierro',
        description: 'Casco de hierro resistente',
        type: 'helmet',
        rarity: 'common',
        stats: { def: 12, hp: 40 },
        value: 250,
        sellValue: 125,
        levelRequired: 6,
      },
      {
        id: 'steel_helmet',
        name: 'Casco de Acero',
        description: 'Casco de acero de calidad',
        type: 'helmet',
        rarity: 'uncommon',
        stats: { def: 20, hp: 80, vit: 5 },
        value: 600,
        sellValue: 300,
        levelRequired: 15,
      },
      {
        id: 'leather_gloves',
        name: 'Guantes de Cuero',
        description: 'Guantes protectores básicos',
        type: 'gloves',
        rarity: 'common',
        stats: { def: 3, atk: 3 },
        value: 50,
        sellValue: 25,
        levelRequired: 1,
      },
      {
        id: 'iron_gloves',
        name: 'Guantes de Hierro',
        description: 'Guantes de hierro para combate',
        type: 'gloves',
        rarity: 'common',
        stats: { def: 8, atk: 8 },
        value: 180,
        sellValue: 90,
        levelRequired: 5,
      },
      {
        id: 'leather_boots',
        name: 'Botas de Cuero',
        description: 'Botas cómodas para caminar',
        type: 'boots',
        rarity: 'common',
        stats: { def: 4, agi: 5 },
        value: 60,
        sellValue: 30,
        levelRequired: 1,
      },
      {
        id: 'iron_boots',
        name: 'Botas de Hierro',
        description: 'Botas protectoras resistentes',
        type: 'boots',
        rarity: 'common',
        stats: { def: 10, agi: 8 },
        value: 200,
        sellValue: 100,
        levelRequired: 7,
      },
      {
        id: 'speed_boots',
        name: 'Botas de Velocidad',
        description: 'Botas que aumentan la velocidad',
        type: 'boots',
        rarity: 'rare',
        stats: { def: 15, agi: 20, dodgeChance: 10 },
        value: 1500,
        sellValue: 750,
        levelRequired: 20,
      },
      {
        id: 'lucky_charm',
        name: 'Amuleto de la Suerte',
        description: 'Un amuleto que trae buena suerte',
        type: 'accessory',
        rarity: 'uncommon',
        stats: { luck: 15 },
        value: 500,
        sellValue: 250,
        levelRequired: 10,
      },
      {
        id: 'power_ring',
        name: 'Anillo de Poder',
        description: 'Un anillo que aumenta el poder',
        type: 'accessory',
        rarity: 'rare',
        stats: { atk: 25, str: 10 },
        value: 1200,
        sellValue: 600,
        levelRequired: 15,
      },
      {
        id: 'protection_ring',
        name: 'Anillo de Protección',
        description: 'Un anillo que protege',
        type: 'accessory',
        rarity: 'rare',
        stats: { def: 20, vit: 15 },
        value: 1200,
        sellValue: 600,
        levelRequired: 15,
      },
      {
        id: 'wisdom_amulet',
        name: 'Amuleto de Sabiduría',
        description: 'Un amuleto de conocimiento',
        type: 'accessory',
        rarity: 'rare',
        stats: { int: 25, critChance: 10 },
        value: 1800,
        sellValue: 900,
        levelRequired: 20,
      },
    ];
  }

  private getConsumables(): RPGItem[] {
    return [
      {
        id: 'health_potion_small',
        name: 'Poción Pequeña de Vida',
        description: 'Restaura 30 HP',
        type: 'consumable',
        rarity: 'common',
        stats: {},
        value: 25,
        sellValue: 10,
        levelRequired: 1,
        useEffect: { type: 'heal', value: 30 },
      },
      {
        id: 'health_potion_medium',
        name: 'Poción Mediana de Vida',
        description: 'Restaura 75 HP',
        type: 'consumable',
        rarity: 'common',
        stats: {},
        value: 75,
        sellValue: 35,
        levelRequired: 5,
        useEffect: { type: 'heal', value: 75 },
      },
      {
        id: 'health_potion_large',
        name: 'Poción Grande de Vida',
        description: 'Restaura 150 HP',
        type: 'consumable',
        rarity: 'uncommon',
        stats: {},
        value: 200,
        sellValue: 100,
        levelRequired: 15,
        useEffect: { type: 'heal', value: 150 },
      },
      {
        id: 'health_potion_super',
        name: 'Poción Super de Vida',
        description: 'Restaura 300 HP',
        type: 'consumable',
        rarity: 'rare',
        stats: {},
        value: 500,
        sellValue: 250,
        levelRequired: 30,
        useEffect: { type: 'heal', value: 300 },
      },
      {
        id: 'energy_potion',
        name: 'Poción de Energía',
        description: 'Restaura 50 de energía',
        type: 'consumable',
        rarity: 'common',
        stats: {},
        value: 40,
        sellValue: 20,
        levelRequired: 1,
        useEffect: { type: 'restoreEnergy', value: 50 },
      },
      {
        id: 'stamina_potion',
        name: 'Poción de Resistencia',
        description: 'Restaura 50 de resistencia',
        type: 'consumable',
        rarity: 'common',
        stats: {},
        value: 35,
        sellValue: 15,
        levelRequired: 1,
        useEffect: { type: 'restoreStamina', value: 50 },
      },
      {
        id: 'bread',
        name: 'Pan',
        description: 'Restaura 10 HP',
        type: 'consumable',
        rarity: 'common',
        stats: {},
        value: 10,
        sellValue: 5,
        levelRequired: 1,
        useEffect: { type: 'heal', value: 10 },
      },
      {
        id: 'meat',
        name: 'Carne',
        description: 'Restaura 25 HP',
        type: 'consumable',
        rarity: 'common',
        stats: {},
        value: 20,
        sellValue: 10,
        levelRequired: 1,
        useEffect: { type: 'heal', value: 25 },
      },
      {
        id: 'fish',
        name: 'Pescado',
        description: 'Restaura 20 HP',
        type: 'consumable',
        rarity: 'common',
        stats: {},
        value: 15,
        sellValue: 7,
        levelRequired: 1,
        useEffect: { type: 'heal', value: 20 },
      },
      {
        id: 'cookie',
        name: 'Galleta',
        description: 'Restaura 15 HP',
        type: 'consumable',
        rarity: 'common',
        stats: {},
        value: 12,
        sellValue: 5,
        levelRequired: 1,
        useEffect: { type: 'heal', value: 15 },
      },
      {
        id: 'apple',
        name: 'Manzana',
        description: 'Restaura 12 HP',
        type: 'consumable',
        rarity: 'common',
        stats: {},
        value: 8,
        sellValue: 3,
        levelRequired: 1,
        useEffect: { type: 'heal', value: 12 },
      },
      {
        id: 'xp_scroll',
        name: 'Pergamino de XP',
        description: 'Da 100 XP extra',
        type: 'consumable',
        rarity: 'uncommon',
        stats: {},
        value: 150,
        sellValue: 75,
        levelRequired: 5,
        useEffect: { type: 'xpBoost', value: 100 },
      },
    ];
  }

  private getMaterials(): RPGItem[] {
    return [
      {
        id: 'wood',
        name: 'Madera',
        description: 'Madera básica para crafting',
        type: 'material',
        rarity: 'common',
        stats: {},
        value: 5,
        sellValue: 2,
        levelRequired: 1,
      },
      {
        id: 'stone',
        name: 'Piedra',
        description: 'Piedra para crafting',
        type: 'material',
        rarity: 'common',
        stats: {},
        value: 8,
        sellValue: 3,
        levelRequired: 1,
      },
      {
        id: 'iron_ore',
        name: 'Mineral de Hierro',
        description: 'Mineral de hierro refinado',
        type: 'material',
        rarity: 'common',
        stats: {},
        value: 15,
        sellValue: 7,
        levelRequired: 1,
      },
      {
        id: 'silver_ore',
        name: 'Mineral de Plata',
        description: 'Mineral de plata valiosa',
        type: 'material',
        rarity: 'uncommon',
        stats: {},
        value: 40,
        sellValue: 20,
        levelRequired: 10,
      },
      {
        id: 'gold_ore',
        name: 'Mineral de Oro',
        description: 'Mineral de oro precioso',
        type: 'material',
        rarity: 'rare',
        stats: {},
        value: 100,
        sellValue: 50,
        levelRequired: 20,
      },
      {
        id: 'diamond',
        name: 'Diamante',
        description: 'Una gema brillante',
        type: 'material',
        rarity: 'epic',
        stats: {},
        value: 500,
        sellValue: 250,
        levelRequired: 30,
      },
      {
        id: 'ruby',
        name: 'Rubí',
        description: 'Una gema roja',
        type: 'material',
        rarity: 'rare',
        stats: {},
        value: 300,
        sellValue: 150,
        levelRequired: 25,
      },
      {
        id: 'emerald',
        name: 'Esmeralda',
        description: 'Una gema verde',
        type: 'material',
        rarity: 'rare',
        stats: {},
        value: 300,
        sellValue: 150,
        levelRequired: 25,
      },
      {
        id: 'leather',
        name: 'Cuero',
        description: 'Cuero de animal',
        type: 'material',
        rarity: 'common',
        stats: {},
        value: 20,
        sellValue: 10,
        levelRequired: 1,
      },
      {
        id: 'magic_dust',
        name: 'Polvo Mágico',
        description: 'Polvo con propiedades mágicas',
        type: 'material',
        rarity: 'uncommon',
        stats: {},
        value: 50,
        sellValue: 25,
        levelRequired: 10,
      },
      {
        id: 'dragon_scale',
        name: 'Escama de Dragón',
        description: 'Una escama de dragón',
        type: 'material',
        rarity: 'legendary',
        stats: {},
        value: 1000,
        sellValue: 500,
        levelRequired: 50,
      },
      {
        id: 'phoenix_feather',
        name: 'Pluma de Fénix',
        description: 'Una pluma de fénix',
        type: 'material',
        rarity: 'mythic',
        stats: {},
        value: 2000,
        sellValue: 1000,
        levelRequired: 60,
      },
    ];
  }

  private getPets(): RPGItem[] {
    return [
      {
        id: 'pet_cat',
        name: 'Gato',
        description: 'Un lindo gato como mascota',
        type: 'pet',
        rarity: 'common',
        stats: { luck: 5 },
        value: 200,
        sellValue: 100,
        levelRequired: 1,
      },
      {
        id: 'pet_dog',
        name: 'Perro',
        description: 'Un fiel perro como mascota',
        type: 'pet',
        rarity: 'common',
        stats: { atk: 5, def: 5 },
        value: 250,
        sellValue: 125,
        levelRequired: 1,
      },
      {
        id: 'pet_owl',
        name: 'Búho',
        description: 'Un búho sabio',
        type: 'pet',
        rarity: 'uncommon',
        stats: { int: 15 },
        value: 500,
        sellValue: 250,
        levelRequired: 10,
      },
      {
        id: 'pet_wolf',
        name: 'Lobo',
        description: 'Un lobo feroz',
        type: 'pet',
        rarity: 'rare',
        stats: { atk: 20, agi: 10 },
        value: 1500,
        sellValue: 750,
        levelRequired: 20,
      },
      {
        id: 'pet_griffin',
        name: 'Grifo',
        description: 'Una criatura mítica',
        type: 'pet',
        rarity: 'epic',
        stats: { atk: 40, def: 30, agi: 20 },
        value: 5000,
        sellValue: 2500,
        levelRequired: 40,
      },
      {
        id: 'pet_dragon',
        name: 'Dragón Bebé',
        description: 'Un pequeño dragón',
        type: 'pet',
        rarity: 'legendary',
        stats: { atk: 60, def: 50, int: 30, luck: 20 },
        value: 15000,
        sellValue: 7500,
        levelRequired: 50,
      },
    ];
  }

  getItem(id: string): RPGItem | undefined {
    return this.items.get(id);
  }

  getAllItems(): RPGItem[] {
    return Array.from(this.items.values());
  }

  getItemsByType(type: ItemType): RPGItem[] {
    return this.getAllItems().filter(item => item.type === type);
  }

  getItemsByRarity(rarity: RPGItem['rarity']): RPGItem[] {
    return this.getAllItems().filter(item => item.rarity === rarity);
  }

  getItemsByLevel(level: number): RPGItem[] {
    return this.getAllItems().filter(item => item.levelRequired <= level);
  }

  getConsumablesList(): RPGItem[] {
    return this.getItemsByType('consumable');
  }

  getWeaponsList(): RPGItem[] {
    return this.getItemsByType('weapon');
  }

  getArmorList(): RPGItem[] {
    return this.getAllItems().filter(item =>
      ['armor', 'helmet', 'gloves', 'boots', 'accessory'].includes(item.type),
    );
  }

  getMaterialsList(): RPGItem[] {
    return this.getItemsByType('material');
  }

  getPetsList(): RPGItem[] {
    return this.getItemsByType('pet');
  }
}

export const itemRegistry = ItemRegistry.getInstance();
