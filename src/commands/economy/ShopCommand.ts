import { Command } from "../Command.js";
import { CommandCategory, type MessageContext } from "@/types/index.js";
import { serviceManager } from "@/services/Servicemanager.js";

interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  emoji: string;
  type: "role" | "feature" | "cosmetic";
}

export class ShopCommand extends Command {
  name = "shop";
  description = "Browse the shop and buy items";
  category = CommandCategory.ECONOMY;
  aliases = ["store", "tienda"];
  usage = "!shop";
  examples = ["!shop"];
  cooldown = 3000;

  private readonly SHOP_ITEMS: ShopItem[] = [
    {
      id: "vip_role",
      name: "VIP Role",
      description: "Get VIP status for 7 days",
      price: 5000,
      emoji: "👑",
      type: "role",
    },
    {
      id: "legend_role",
      name: "Legend Role",
      description: "Get Legend status for 7 days",
      price: 10000,
      emoji: "💎",
      type: "role",
    },
    {
      id: "name_color",
      name: "Custom Name Color",
      description: "Customize your name color",
      price: 3000,
      emoji: "🎨",
      type: "cosmetic",
    },
    {
      id: "cooldown_bypass",
      name: "Cooldown Bypass",
      description: "Reduce cooldowns by 50% for 24h",
      price: 2000,
      emoji: "⚡",
      type: "feature",
    },
    {
      id: "xp_boost",
      name: "XP Boost",
      description: "Double XP for 24 hours",
      price: 1500,
      emoji: "✨",
      type: "feature",
    },
    {
      id: "lucky_charm",
      name: "Lucky Charm",
      description: "Increase game win chance by 10% for 1 day",
      price: 2500,
      emoji: "🍀",
      type: "feature",
    },
  ];

  async execute(ctx: MessageContext): Promise<void> {
    const user = await serviceManager.userService.getUser(ctx.sender.jid);

    let message = `🏪 *VANIABOT SHOP*\n\n`;
    message += `💰 Your Balance: $${user.money.toLocaleString()}\n\n`;

    message += `📦 *Available Items:*\n\n`;

    this.SHOP_ITEMS.forEach((item, index) => {
      const canAfford = user.money >= item.price ? "✅" : "❌";
      message += `${canAfford} *${index + 1}. ${item.emoji} ${item.name}*\n`;
      message += `   ${item.description}\n`;
      message += `   💵 Price: $${item.price.toLocaleString()}\n`;
      message += `   🏷️ Type: ${item.type}\n\n`;
    });

    message += `📝 *How to buy:*\n`;
    message += `Use: !buy <item_number>\n`;
    message += `Example: !buy 1\n\n`;

    message += `> _*VaniaBot💝*_`;

    await ctx.reply(message);
  }
}