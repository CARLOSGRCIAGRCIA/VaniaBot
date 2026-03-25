import { Command } from '../../Command.js';
import { CommandCategory } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { formatNumber, formatTime } from '@/utils/helpers.js';
import type { User } from '@/services/database/UserService.js';
import fs from 'fs';
import path from 'path';

interface LevelProgress {
  currentXP: number;
  requiredXP: number;
  percentage: number;
}

interface ClientStats {
  messagesReceived: number;
  commandsExecuted: number;
  messagesProcessed: number;
  avgProcessingTime?: number;
  queue?: {
    queued: number;
    processing: number;
  };
}

export class ProfileCommand extends Command {
  name = 'profile';
  description = 'Show user profile';
  category = CommandCategory.UTILITY;
  aliases = ['perfil', 'me', 'stats'];
  usage = '!profile [@user]';
  examples = ['!profile', '!profile @5215551234567', '!me'];

  private static logoBuffer: Buffer | null = null;
  private static logoLoaded = false;

  async execute(ctx: MessageContext): Promise<void> {
    const mentionedJid = ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const targetJid = mentionedJid || ctx.sender.jid;
    const isSelf = targetJid === ctx.sender.jid;

    try {
      const botJid = ctx.sock.user?.id;
      const isBotProfile = this.isBotJid(targetJid, botJid);

      if (isBotProfile) {
        await this.sendBotProfile(ctx);
        return;
      }

      const [userData, progress] = await Promise.all([
        serviceManager.userService.getUser(targetJid),
        serviceManager.levelService.getLevelProgress(targetJid),
      ]);

      const displayData = this.prepareDisplayData(userData);

      const message = this.buildProfileCard(userData, displayData, progress, isSelf);

      await this.sendProfileWithImage(ctx, targetJid, message);
    } catch (error) {
      logError('[ProfileCommand] Error', error);
      await ctx.reply('❌ Error retrieving profile');
    }
  }

  private isBotJid(targetJid: string, botJid?: string): boolean {
    if (!botJid) return false;

    const targetNumber = targetJid.split('@')[0].split(':')[0];
    const botNumber = botJid.split('@')[0].split(':')[0];

    return targetNumber === botNumber;
  }

  private async sendBotProfile(ctx: MessageContext): Promise<void> {
    const uptime = this.formatUptime(process.uptime() * 1000);
    const client = (global as { client?: { getStats: () => ClientStats } }).client;
    const stats = client?.getStats() || {
      messagesReceived: 0,
      commandsExecuted: 0,
      messagesProcessed: 0,
    };

    const message = `
˚₊· ͟͟͞͞➳━━━━━━━━━━━━━━━━━━ ˚₊· ͟͟͞͞➳
   🌸 *VANIA BOT* 🌸
˚₊· ͟͟͞͞➳━━━━━━━━━━━━━━━━━━ ˚₊· ͟͟͞͞➳

✿ *quién soy*
   ﹒nombre: ${ctx.sock.user?.name || 'VaniaBot'}
   ﹒estado: 🟢 online
   ﹒desde: ${uptime}

✩ *lo que he hecho*
   ﹒mensajes: ${formatNumber(stats.messagesReceived)}
   ﹒comandos: ${formatNumber(stats.commandsExecuted)}
   ﹒procesados: ${formatNumber(stats.messagesProcessed)}

⚡ *cómo voy*
   ﹒tiempo promedio: ${stats.avgProcessingTime?.toFixed(0) || 0}ms
   ﹒en espera: ${stats.queue?.queued || 0}

♡ *mis habilidades*
   ﹒economía 💰
   ﹒juegos 🎮
   ﹒moderación 🛡️
   ﹒niveles ⭐

˚₊· ͟͟͞͞➳━━━━━━━━━━━━━━━━━━ ˚₊· ͟͟͞͞➳
   💕 *!help* para más cositas
˚₊· ͟͟͞͞➳━━━━━━━━━━━━━━━━━━ ˚₊· ͟͟͞͞➳
`.trim();

    const logoBuffer = this.getDefaultLogo();
    if (logoBuffer) {
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: logoBuffer,
        caption: message,
      });
    } else {
      await ctx.reply(message);
    }
  }

  private formatUptime(ms: number): string {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  private async sendProfileWithImage(
    ctx: MessageContext,
    targetJid: string,
    message: string,
  ): Promise<void> {
    try {
      const imageBuffer = await Promise.race([
        this.getProfileImage(ctx, targetJid),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 2000)),
      ]);

      if (imageBuffer) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: imageBuffer,
          caption: message,
        });
      } else {
        await ctx.reply(message);
      }
    } catch {
      await ctx.reply(message);
    }
  }

  private async getProfileImage(ctx: MessageContext, targetJid: string): Promise<Buffer | null> {
    try {
      let normalizedJid = targetJid;

      if (targetJid.includes('@lid')) {
        const phoneNumber = targetJid.split('@')[0];
        normalizedJid = `${phoneNumber}@s.whatsapp.net`;
      }

      const url = await ctx.sock.profilePictureUrl(normalizedJid, 'image');
      if (url) {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(1500),
        });
        if (response.ok) {
          return Buffer.from(await response.arrayBuffer());
        }
      }
    } catch {
      // Ignorar errores
    }

    return this.getDefaultLogo();
  }

  private getDefaultLogo(): Buffer | null {
    if (ProfileCommand.logoLoaded) {
      return ProfileCommand.logoBuffer;
    }

    try {
      const logoPath = path.join(process.cwd(), 'data', 'assets', 'logo.png');
      if (fs.existsSync(logoPath)) {
        ProfileCommand.logoBuffer = fs.readFileSync(logoPath);
        ProfileCommand.logoLoaded = true;
        return ProfileCommand.logoBuffer;
      }
    } catch {
      // Ignorar errores
    }

    ProfileCommand.logoLoaded = true;
    return null;
  }

  private prepareDisplayData(userData: User): User {
    if (userData.isOwner) {
      return {
        ...userData,
        level: 999,
        xp: 999999,
        money: 999999999,
        warnings: 0,
      };
    }
    return userData;
  }

  private buildProfileCard(
    userData: User,
    displayData: User,
    progress: LevelProgress,
    isSelf: boolean,
  ): string {
    const progressBar = userData.isOwner
      ? '★'.repeat(10)
      : this.createProgressBar(progress.currentXP, progress.requiredXP, 10);

    const registeredTime = this.getTimeSince(userData.createdAt);

    const canDaily = serviceManager.userService.canClaimDaily(userData);
    const canWeekly = serviceManager.userService.canClaimWeekly(userData);
    const canMonthly = serviceManager.userService.canClaimMonthly(userData);

    let dailyInfo = '';
    if (!canDaily && !userData.isOwner) {
      const remaining = serviceManager.userService.getDailyTimeRemaining(userData);
      if (remaining > 0) dailyInfo = `\n     ⏰ ${formatTime(remaining)}`;
    }

    const xpDisplay = userData.isOwner
      ? '∞ INFINITE'
      : `${formatNumber(progress.currentXP)} / ${formatNumber(progress.requiredXP)}`;

    const percentageDisplay = userData.isOwner ? '100%' : `${progress.percentage}%`;

    let card = `✦━━━━━━━━━━━━✦
> _*♡ VaniaBot Profile ♡*_
✦━━━━━━━━━━━━✦

✿ *${userData.name}*
`;

    if (userData.isBanned) {
      card += `   ⚠️ Status: BANNED\n\n`;
    } else {
      const roleIcon = this.getRoleIcon(displayData);
      card += `   ${roleIcon} ${this.getUserRole(displayData)}
   ⏱️ Member for ${registeredTime}

`;
    }

    const rpgStats = userData.stats || { hp: 100, maxHp: 100, atk: 10, def: 5 };

    card += `✦━━━━━━━━━━━━━━✦
 ✦ *LEVEL ${displayData.level}*
    ${progressBar} ${percentageDisplay}
    XP: ${xpDisplay}

 ✦━━━━━━━━━━━━━━✦
 ⚔️ *RPG Stats*
    ❤️ HP: ${rpgStats.hp}/${rpgStats.maxHp}
    🗡️ ATK: ${rpgStats.atk} | 🛡️ DEF: ${rpgStats.def}

 ✦━━━━━━━━━━━━━━✦
 💰 *Economy*
    💵 $${formatNumber(displayData.money)}
    🎒 ${displayData.inventory?.length || 0} items
    🏆 ${displayData.achievements?.length || 0} achievements
    ⚔️ Clase: ${userData.currentClass || 'Sin clase'}

✦━━━━━━━━━━━━━━✦
📊 *Statistics*
   ⚡ ${formatNumber(displayData.totalCommands)} commands
   ⚠️ ${displayData.warnings}/3 warns
   🕐 Active ${this.getTimeSince(userData.updatedAt)}

✦━━━━━━━━━━━━━━✦
🎁 *Rewards*
`;

    if (userData.isOwner) {
      card += `   ✨ Daily: ∞ Unlimited
   ✨ Weekly: ∞ Unlimited
   ✨ Monthly: ∞ Unlimited

✦━━━━━━━━━━━━━━✦
   ♛ *Owner Privileges* ♛
> _*VaniaBot*_`;
    } else {
      card += `   ${canDaily ? '✅' : '❌'} Daily${dailyInfo}
   ${canWeekly ? '✅' : '❌'} Weekly
   ${canMonthly ? '✅' : '❌'} Monthly
`;

      if (isSelf) {
        card += `
✦━━━━━━━━━━━━━━✦
   💝 Use !daily, !weekly
      or !monthly to claim`;
      }
    }

    card += `\n✦━━━━━━━━━━━━━━✦`;

    return card.trim();
  }

  private createProgressBar(current: number, total: number, length: number = 10): string {
    if (total <= 0 || current < 0) {
      return '★'.repeat(length);
    }

    const percentage = Math.min(Math.max(current / total, 0), 1);
    const filled = Math.floor(percentage * length);
    const empty = Math.max(0, length - filled);

    return '★'.repeat(filled) + '☆'.repeat(empty);
  }

  private getRoleIcon(user: User): string {
    if (user.isOwner) return '♛';
    if (user.isBanned) return '⛔';
    if (user.level >= 100) return '👑';
    if (user.level >= 50) return '💎';
    if (user.level >= 25) return '🌟';
    if (user.level >= 10) return '⭐';
    return '✨';
  }

  private getUserRole(user: User): string {
    if (user.isOwner) return 'Supreme Owner';
    if (user.isBanned) return 'Banned';
    if (user.level >= 100) return 'Legend';
    if (user.level >= 50) return 'Veteran';
    if (user.level >= 25) return 'Expert';
    if (user.level >= 10) return 'Intermediate';
    return 'Novice';
  }

  private getTimeSince(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

    if (days > 30) {
      const months = Math.floor(days / 30);
      return `${months} ${months === 1 ? 'month' : 'months'} ago`;
    }
    if (days > 0) {
      return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    }
    if (hours > 0) {
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    }
    return 'minutes ago';
  }
}
