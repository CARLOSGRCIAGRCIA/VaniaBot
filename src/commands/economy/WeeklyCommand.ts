import { Command } from "../Command.js";
import { CommandCategory, type MessageContext } from "@/types/index.js";
import { serviceManager } from "@/services/Servicemanager.js";

export class WeeklyCommand extends Command {
    name = "weekly";
    description = "Claim your weekly reward";
    category = CommandCategory.ECONOMY;
    aliases = ["semanal"];
    usage = "!weekly";
    examples = ["!weekly"];
    cooldown = 5000;

    private readonly BASE_REWARD = 10000;
    private readonly STREAK_BONUS = 500;
    private readonly MAX_STREAK_BONUS = 5000;
    private readonly XP_REWARD = 200;

    async execute(ctx: MessageContext): Promise<void> {
        const user = await serviceManager.userService.getUser(ctx.sender.jid);

        if (!serviceManager.userService.canClaimWeekly(user) && !user.isOwner) {
            const remaining = serviceManager.userService.getWeeklyTimeRemaining(user);
            const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
            const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));


            await ctx.reply(
                `⏰ *Weekly Reward*\n\n` +
                `❌ Already claimed\n` +
                `⏳ Next claim in: ${days}d ${hours}h\n\n` +
                `💡 Come back later!`
            );
            return;
        }

        await ctx.react("⏳");


        let reward = this.BASE_REWARD;
        let streak = (user.weeklyStreak || 0) + 1;
        let streakBonus = Math.min(streak * this.STREAK_BONUS, this.MAX_STREAK_BONUS);

        if (!user.isOwner) {
            reward += streakBonus;

            await serviceManager.userService.addMoney(ctx.sender.jid, reward);
            await serviceManager.userService.addXP(ctx.sender.jid, this.XP_REWARD);

            await serviceManager.userService.updateWeeklyClaim(ctx.sender.jid, streak);
        }

        const updatedUser = await serviceManager.userService.getUser(ctx.sender.jid);

        let message = `🎁 *Weekly Reward Claimed!*\n\n`;
        message += `💰 Base Reward: $${this.BASE_REWARD.toLocaleString()}\n`;

        if (streak > 1) {
            message += `🔥 Streak Bonus: $${streakBonus.toLocaleString()} (${streak} weeks)\n`;
        }

        if (!user.isOwner) {
            message += `💵 Total: $${reward.toLocaleString()}\n`;
            message += `✨ XP Gained: +${this.XP_REWARD}\n\n`;
            message += `💰 New Balance: $${updatedUser.money.toLocaleString()}\n`;
            message += `🔥 Current Streak: ${streak} week${streak > 1 ? "s" : ""}\n\n`;
        } else {
            message += `\n👑 *Owner:* Infinite claims available\n\n`;
        }

        message += `📅 Next claim: 7 days\n`;
        message += `💡 Keep your streak going!\n\n`;

        message += `> _*VaniaBot💝*_`;

        await ctx.reply(message);
        await ctx.react("✅");
    }
}