import { serviceManager } from '../system/Servicemanager.js';

export interface LotteryTicket {
  id: string;
  buyerJid: string;
  number: number;
  purchaseTime: number;
}

export interface LotteryState {
  tickets: LotteryTicket[];
  currentJackpot: number;
  lastDrawTime: number;
  ticketPrice: number;
  prizePool: number;
}

const LOTTERY_CONFIG = {
  ticketPrice: 10000,
  maxTicketsPerDraw: 100,
  minTicketsToDraw: 5,
  drawIntervalHours: 24,
  prizes: {
    first: 0.5,
    second: 0.25,
    third: 0.15,
    fourth: 0.1,
  },
};

export class LotteryService {
  private static instance: LotteryService;
  private state: LotteryState = {
    tickets: [],
    currentJackpot: 0,
    lastDrawTime: Date.now(),
    ticketPrice: LOTTERY_CONFIG.ticketPrice,
    prizePool: 0,
  };

  static getInstance(): LotteryService {
    if (!LotteryService.instance) {
      LotteryService.instance = new LotteryService();
    }
    return LotteryService.instance;
  }

  getState(): LotteryState {
    return this.state;
  }

  getTicketPrice(): number {
    return this.state.ticketPrice;
  }

  async buyTicket(
    jid: string,
    number?: number,
  ): Promise<{ success: boolean; ticket?: LotteryTicket; message: string }> {
    const user = await serviceManager.userService.getUser(jid);

    if (user.money < this.state.ticketPrice) {
      return {
        success: false,
        message: `❌ No tienes suficiente dinero. Cuesta $${this.state.ticketPrice.toLocaleString()}`,
      };
    }

    if (this.state.tickets.length >= LOTTERY_CONFIG.maxTicketsPerDraw) {
      return { success: false, message: '❌ Ya se vendieron todos los tickets para este sorteo' };
    }

    const existingTicket = this.state.tickets.find(t => t.buyerJid === jid);
    if (existingTicket) {
      return { success: false, message: '❌ Ya compraste un ticket en este sorteo' };
    }

    const ticketNumber = number ?? Math.floor(Math.random() * 99) + 1;

    const duplicateNumber = this.state.tickets.find(t => t.number === ticketNumber);
    if (duplicateNumber && !number) {
      return { success: false, message: '❌ Ese número ya fue tomado, intenta con otro' };
    }

    await serviceManager.userService.removeMoney(jid, this.state.ticketPrice);

    const ticket: LotteryTicket = {
      id: crypto.randomUUID(),
      buyerJid: jid,
      number: ticketNumber,
      purchaseTime: Date.now(),
    };

    this.state.tickets.push(ticket);
    this.state.prizePool += this.state.ticketPrice;
    this.state.currentJackpot = Math.floor(this.state.prizePool * 0.7);

    return {
      success: true,
      ticket,
      message: `🎫 *Ticket Comprado*\n\nNúmero: *${ticketNumber.toString().padStart(2, '0')}*\nCosto: $${this.state.ticketPrice.toLocaleString()}\nPremio mayor: $${this.state.currentJackpot.toLocaleString()}`,
    };
  }

  async draw(): Promise<{
    success: boolean;
    results: { prize: number; winner?: string; number?: number }[];
    message: string;
  }> {
    if (this.state.tickets.length < LOTTERY_CONFIG.minTicketsToDraw) {
      return {
        success: false,
        results: [],
        message: `❌ Se necesitan al menos ${LOTTERY_CONFIG.minTicketsToDraw} tickets para sortear`,
      };
    }

    const winningNumber = Math.floor(Math.random() * 99) + 1;
    const winner = this.state.tickets.find(t => t.number === winningNumber);

    const prize = this.state.prizePool;
    let message = `🎰 *SORTEO DE LOTERÍA* 🎰\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `✨ *Número Ganador:* ${winningNumber.toString().padStart(2, '0')}\n\n`;

    if (winner) {
      const firstPrize = Math.floor(prize * LOTTERY_CONFIG.prizes.first);
      await serviceManager.userService.addMoney(winner.buyerJid, firstPrize);
      message += `🎉 *GANADOR:* @${winner.buyerJid.split('@')[0]}\n`;
      message += `💰 *Premio:* $${firstPrize.toLocaleString()}\n`;
    } else {
      this.state.currentJackpot += Math.floor(prize * LOTTERY_CONFIG.prizes.first);
      message += `💔 *No hubo ganador del primer premio*\n`;
      message += `🎯 *Jackpot acumulado:* $${this.state.currentJackpot.toLocaleString()}\n`;
    }

    this.state.tickets = [];
    this.state.prizePool = 0;
    this.state.lastDrawTime = Date.now();

    return {
      success: true,
      results: [{ prize, winner: winner?.buyerJid, number: winningNumber }],
      message,
    };
  }

  getTicketsInfo(): { total: number; jackpot: number; ticketPrice: number } {
    return {
      total: this.state.tickets.length,
      jackpot: this.state.currentJackpot,
      ticketPrice: this.state.ticketPrice,
    };
  }

  getUserTicket(jid: string): LotteryTicket | undefined {
    return this.state.tickets.find(t => t.buyerJid === jid);
  }

  resetForNewDraw(): void {
    this.state.tickets = [];
    this.state.prizePool = 0;
  }
}

export const lotteryService = LotteryService.getInstance();
