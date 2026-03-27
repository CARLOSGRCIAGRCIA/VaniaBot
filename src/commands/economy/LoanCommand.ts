import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { loanService } from '@/services/economy/LoanService.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { formatNumber } from '@/utils/helpers.js';

export class LoanCommand extends Command {
  name = 'prestamo';
  description = 'Sistema de préstamos entre usuarios';
  category = CommandCategory.ECONOMY;
  aliases = ['loan', 'deuda'];
  usage = '!prestamo [dar|pagar|estado]';
  examples = ['!prestamo dar @user 10000', '!prestamo pagar id'];

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args;
    const action = args[0]?.toLowerCase();

    switch (action) {
      case 'dar':
      case 'give':
        await this.giveLoan(ctx);
        break;
      case 'pagar':
      case 'pay':
        await this.repayLoan(ctx);
        break;
      case 'estado':
      case 'status':
        await this.showStatus(ctx);
        break;
      default:
        await this.showHelp(ctx);
    }
  }

  private async giveLoan(ctx: MessageContext): Promise<void> {
    const mentionedJid = ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const amountStr = ctx.args[2];
    const amount = parseInt(amountStr);

    if (!mentionedJid) {
      await ctx.reply(
        `💰 *PRÉSTAMOS*\n\n` +
          `✿ *Cómo dar un préstamo:*\n` +
          `!prestamo dar @usuario [cantidad]\n\n` +
          `📋 *Detalles:*\n` +
          `• Mínimo: $1,000\n` +
          `• Máximo: $100,000\n` +
          `• Interés: 10%\n` +
          `• Duración: 7 días\n\n` +
          `📝 *Ejemplo:*\n!prestamo dar @user 10000`,
      );
      return;
    }

    if (!amountStr || isNaN(amount)) {
      await ctx.reply(`❌ Especifica la cantidad\n\n💡 !prestamo dar @user 10000`);
      return;
    }

    if (mentionedJid === ctx.sender.jid) {
      await ctx.reply(`❌ No puedes darte un préstamo a ti mismo`);
      return;
    }

    const result = await loanService.requestLoan(ctx.sender.jid, mentionedJid, amount);

    if (result.success) {
      await ctx.reply(result.message);
    } else {
      await ctx.reply(result.message);
    }
  }

  private async repayLoan(ctx: MessageContext): Promise<void> {
    const loanId = ctx.args[1];

    if (!loanId) {
      await ctx.reply(
        `❌ Especifica el ID del préstamo\n\n💡 Usa !prestamo estado para ver tus préstamos`,
      );
      return;
    }

    const result = await loanService.repayLoan(ctx.sender.jid, loanId);

    if (result.success) {
      await ctx.reply(result.message);
      await ctx.react('✅');
    } else {
      await ctx.reply(result.message);
    }
  }

  private async showStatus(ctx: MessageContext): Promise<void> {
    const user = await serviceManager.userService.getUser(ctx.sender.jid);
    const loans = loanService.getActiveLoans(ctx.sender.jid);

    let message = `💰 *ESTADO DE PRÉSTAMOS*\n\n`;
    message += `💵 Tu balance: $${formatNumber(user.money)}\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (loans.length === 0) {
      message += `✨ No tienes préstamos activos\n\n`;
    } else {
      const asBorrower = loans.filter(l => l.borrowerJid === ctx.sender.jid);
      const asLender = loans.filter(l => l.lenderJid === ctx.sender.jid);

      if (asBorrower.length > 0) {
        message += `📋 *Préstamos que debes:*\n\n`;
        asBorrower.forEach((loan, i) => {
          const daysLeft = Math.ceil((loan.dueDate - Date.now()) / (1000 * 60 * 60 * 24));
          message += `${i + 1}. 💸 $${formatNumber(loan.remaining)}\n`;
          message += `   🆔 \`${loan.id.slice(0, 8)}\`\n`;
          message += `   ⏰ ${daysLeft} días restantes\n\n`;
        });
      }

      if (asLender.length > 0) {
        message += `📋 *Préstamos que diste:*\n\n`;
        asLender.forEach((loan, i) => {
          const daysLeft = Math.ceil((loan.dueDate - Date.now()) / (1000 * 60 * 60 * 24));
          message += `${i + 1}. 💰 $${formatNumber(loan.remaining)}\n`;
          message += `   🆔 \`${loan.id.slice(0, 8)}\`\n`;
          message += `   ⏰ ${daysLeft} días restantes\n\n`;
        });
      }

      message += `💡 *Para pagar:*\n!prestamo pagar [id]`;
    }

    await ctx.reply(message);
  }

  private async showHelp(ctx: MessageContext): Promise<void> {
    await ctx.reply(
      `💰 *SISTEMA DE PRÉSTAMOS*\n\n` +
        `✿ *Presta dinero a otros usuarios*\n` +
        `con interés del 10%.\n\n` +
        `📋 *Comandos:*\n\n` +
        `• !prestamo dar @user [cantidad]\n` +
        `   → Dar un préstamo\n\n` +
        `• !prestamo pagar [id]\n` +
        `   → Pagar un préstamo\n\n` +
        `• !prestamo estado\n` +
        `   → Ver tus préstamos\n\n` +
        `📊 *Detalles:*\n` +
        `• Mínimo: $1,000\n` +
        `• Máximo: $100,000\n` +
        `• Interés: 10%\n` +
        `• Duración: 7 días`,
    );
  }
}
