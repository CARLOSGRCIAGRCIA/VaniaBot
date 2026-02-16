import { Command } from "../Command.js";
import { CommandCategory } from "@/types/index.js";
import type { MessageContext } from "@/types/index.js";
import { serviceManager } from "@/services/Servicemanager.js";
import { formatNumber, formatTime } from "@/utils/helpers.js";
import type { User } from "@/services/database/UserService.js";
import fs from "fs";
import path from "path";

export class ProfileCommand extends Command {
  name = "profile";
  description = "Muestra el perfil de un usuario";
  category = CommandCategory.UTILITY;
  aliases = ["perfil", "me", "stats"];
  usage = "!profile [@usuario]";
  examples = ["!profile", "!profile @5215551234567", "!me"];

  private static logoBuffer: Buffer | null = null;
  private static logoLoaded = false;

  async execute(ctx: MessageContext): Promise<void> {
    const mentionedJid =
      ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const targetJid = mentionedJid || ctx.sender.jid;
    const isSelf = targetJid === ctx.sender.jid;

    try {
      const [userData, progress] = await Promise.all([
        serviceManager.userService.getUser(targetJid),
        serviceManager.levelService.getLevelProgress(targetJid),
      ]);

      const displayData = this.prepareDisplayData(userData);

      const message = this.buildProfileCard(
        userData,
        displayData,
        progress,
        isSelf,
      );

      await ctx.reply(message);

      this.sendProfileImageInBackground(ctx, targetJid, message).catch(
        () => {},
      );
    } catch (error) {
      console.error("Error en ProfileCommand:", error);
      await ctx.reply("❌ Error al obtener el perfil");
    }
  }

  private async sendProfileImageInBackground(
    ctx: MessageContext,
    targetJid: string,
    message: string,
  ): Promise<void> {
    try {
      const imageBuffer = await Promise.race([
        this.getProfileImage(ctx, targetJid),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
      ]);

      if (imageBuffer) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: imageBuffer,
          caption: message,
        });
      }
    } catch {
      // Silenciosamente ignorar errores
    }
  }

  private async getProfileImage(
    ctx: MessageContext,
    targetJid: string,
  ): Promise<Buffer | null> {
    try {
      const url = await ctx.sock.profilePictureUrl(targetJid, "image");
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
      const logoPath = path.join(process.cwd(), "data", "assets", "logo.png");
      if (fs.existsSync(logoPath)) {
        ProfileCommand.logoBuffer = fs.readFileSync(logoPath);
        ProfileCommand.logoLoaded = true;
        return ProfileCommand.logoBuffer;
      }
    } catch (err) {
      console.error("Error al cargar logo:", err);
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
    progress: any,
    isSelf: boolean,
  ): string {
    const progressBar = userData.isOwner
      ? "★".repeat(10)
      : this.createProgressBar(progress.currentXP, progress.requiredXP, 10);

    const registeredTime = this.getTimeSince(userData.createdAt);

    const canDaily = this.canClaimDaily(userData);
    const canWeekly = this.canClaimWeekly(userData);
    const canMonthly = this.canClaimMonthly(userData);

    let dailyInfo = "";
    if (!canDaily && !userData.isOwner) {
      const remaining = this.getDailyTimeRemaining(userData);
      if (remaining > 0) dailyInfo = `\n     ⏰ ${formatTime(remaining)}`;
    }

    const xpDisplay = userData.isOwner
      ? "∞ INFINITO"
      : `${formatNumber(progress.currentXP)} / ${formatNumber(progress.requiredXP)}`;

    const percentageDisplay = userData.isOwner
      ? "100%"
      : `${progress.percentage}%`;

    let card = `✦━━━━━━━━━━━━✦
> _*♡ VaniaBot Profile ♡*_
✦━━━━━━━━━━━━✦

✿ *${userData.name}*
`;

    if (userData.isBanned) {
      card += `   ⚠️ Estado: BANEADO\n\n`;
    } else {
      const roleIcon = this.getRoleIcon(displayData);
      card += `   ${roleIcon} ${this.getUserRole(displayData)}
   ⏱️ Miembro ${registeredTime}

`;
    }

    card += `✦━━━━━━━━━━━━━━✦
✦ *NIVEL ${displayData.level}*
   ${progressBar} ${percentageDisplay}
   XP: ${xpDisplay}

✦━━━━━━━━━━━━━━✦
💰 *Economía*
   💵 $${formatNumber(displayData.money)}
   🎒 ${displayData.inventory?.length || 0} items
   🏆 ${displayData.achievements?.length || 0} logros

✦━━━━━━━━━━━━━━✦
📊 *Estadísticas*
   ⚡ ${formatNumber(displayData.totalCommands)} comandos
   ⚠️ ${displayData.warnings}/3 warns
   🕐 Activo ${this.getTimeSince(userData.updatedAt)}

✦━━━━━━━━━━━━━━✦
🎁 *Recompensas*
`;

    if (userData.isOwner) {
      card += `   ✨ Daily: ∞ Ilimitado
   ✨ Weekly: ∞ Ilimitado
   ✨ Monthly: ∞ Ilimitado

✦━━━━━━━━━━━━━━✦
   ♛ *Privilegios Owner* ♛
> _*VaniaBot*_`;
    } else {
      card += `   ${canDaily ? "✅" : "❌"} Daily${dailyInfo}
   ${canWeekly ? "✅" : "❌"} Weekly
   ${canMonthly ? "✅" : "❌"} Monthly
`;

      if (isSelf) {
        card += `
✦━━━━━━━━━━━━━━✦
   💝 Usa !daily, !weekly
      o !monthly para reclamar`;
      }
    }

    card += `\n✦━━━━━━━━━━━━━━✦`;

    return card.trim();
  }

  private canClaimDaily(user: User): boolean {
    if (!user.lastDaily) return true;
    const oneDayMs = 24 * 60 * 60 * 1000;
    return Date.now() - user.lastDaily >= oneDayMs;
  }

  private canClaimWeekly(user: User): boolean {
    if (!user.lastWeekly) return true;
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - user.lastWeekly >= oneWeekMs;
  }

  private canClaimMonthly(user: User): boolean {
    if (!user.lastMonthly) return true;
    const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
    return Date.now() - user.lastMonthly >= oneMonthMs;
  }

  private getDailyTimeRemaining(user: User): number {
    if (!user.lastDaily) return 0;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const remaining = user.lastDaily + oneDayMs - Date.now();
    return Math.max(0, remaining);
  }

  private createProgressBar(
    current: number,
    total: number,
    length: number = 10,
  ): string {
    const percentage = Math.min(current / total, 1);
    const filled = Math.floor(percentage * length);
    const empty = length - filled;
    return "★".repeat(filled) + "☆".repeat(empty);
  }

  private getRoleIcon(user: User): string {
    if (user.isOwner) return "♛";
    if (user.isBanned) return "⛔";
    if (user.level >= 100) return "👑";
    if (user.level >= 50) return "💎";
    if (user.level >= 25) return "🌟";
    if (user.level >= 10) return "⭐";
    return "✨";
  }

  private getUserRole(user: User): string {
    if (user.isOwner) return "Owner Suprem@";
    if (user.isBanned) return "Baneado";
    if (user.level >= 100) return "Leyenda";
    if (user.level >= 50) return "Veterana";
    if (user.level >= 25) return "Experta";
    if (user.level >= 10) return "Intermedia";
    return "Novata";
  }

  private getTimeSince(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

    if (days > 30) {
      const months = Math.floor(days / 30);
      return `hace ${months} ${months === 1 ? "mes" : "meses"}`;
    }
    if (days > 0) {
      return `hace ${days} ${days === 1 ? "día" : "días"}`;
    }
    if (hours > 0) {
      return `hace ${hours} ${hours === 1 ? "hora" : "horas"}`;
    }
    return "hace minutos";
  }
}
