import { serviceManager } from '../system/Servicemanager.js';
import { gameStateService } from '../rpg/GameStateService.js';
import { logger } from '@/utils/logger.js';

export interface Loan {
  id: string;
  lenderJid: string;
  borrowerJid: string;
  amount: number;
  interestRate: number;
  totalToRepay: number;
  remaining: number;
  createdAt: number;
  dueDate: number;
  status: 'active' | 'paid' | 'defaulted';
}

class LoanService {
  private static instance: LoanService;
  private loans: Map<string, Loan> = new Map();
  private readonly MIN_LOAN = 1000;
  private readonly MAX_LOAN = 100000;
  private readonly INTEREST_RATE = 0.1;
  private readonly LOAN_DURATION = 7 * 24 * 60 * 60 * 1000;

  static getInstance(): LoanService {
    if (!LoanService.instance) {
      LoanService.instance = new LoanService();
    }
    return LoanService.instance;
  }

  loadFromPersistence(): void {
    const savedLoans = gameStateService.getLoans();
    this.loans.clear();
    for (const loan of savedLoans) {
      this.loans.set(loan.id, {
        id: loan.id,
        lenderJid: loan.lenderJid,
        borrowerJid: loan.borrowerJid,
        amount: loan.amount,
        interestRate: loan.interestRate,
        totalToRepay: loan.totalToRepay,
        remaining: loan.remaining,
        createdAt: loan.createdAt,
        dueDate: loan.dueDate,
        status: loan.status,
      });
    }
    logger.debug(`[Loan] Loaded ${this.loans.size} loans`);
  }

  private saveLoans(): void {
    const loans = Array.from(this.loans.values()).map(l => ({
      id: l.id,
      lenderJid: l.lenderJid,
      borrowerJid: l.borrowerJid,
      amount: l.amount,
      interestRate: l.interestRate,
      totalToRepay: l.totalToRepay,
      remaining: l.remaining,
      createdAt: l.createdAt,
      dueDate: l.dueDate,
      status: l.status,
    }));
    gameStateService.setLoans(loans);
  }

  async requestLoan(
    lenderJid: string,
    borrowerJid: string,
    amount: number,
  ): Promise<{ success: boolean; message: string; loan?: Loan }> {
    if (amount < this.MIN_LOAN) {
      return { success: false, message: `❌ El mínimo es $${this.MIN_LOAN}` };
    }

    if (amount > this.MAX_LOAN) {
      return { success: false, message: `❌ El máximo es $${this.MAX_LOAN}` };
    }

    const lender = await serviceManager.userService.getUser(lenderJid);
    if (lender.money < amount) {
      return { success: false, message: `❌ No tienes suficiente dinero` };
    }

    await serviceManager.userService.getUser(borrowerJid);
    const existingLoan = Array.from(this.loans.values()).find(
      l => l.borrowerJid === borrowerJid && l.status === 'active',
    );

    if (existingLoan) {
      return { success: false, message: `❌ Ya tienes un préstamo activo` };
    }

    const interest = Math.floor(amount * this.INTEREST_RATE);
    const totalToRepay = amount + interest;

    await serviceManager.userService.removeMoney(lenderJid, amount);
    await serviceManager.userService.addMoney(borrowerJid, amount);

    const loan: Loan = {
      id: crypto.randomUUID(),
      lenderJid,
      borrowerJid,
      amount,
      interestRate: this.INTEREST_RATE,
      totalToRepay,
      remaining: totalToRepay,
      createdAt: Date.now(),
      dueDate: Date.now() + this.LOAN_DURATION,
      status: 'active',
    };

    this.loans.set(loan.id, loan);
    this.saveLoans();

    return {
      success: true,
      message: `✅ *Préstamo concedido!*\n\n💰 Cantidad: $${amount}\n📈 Interés: ${this.INTEREST_RATE * 100}%\n💸 Total a pagar: $${totalToRepay}\n⏰ Vence en: 7 días\n\n🆔 ID: \`${loan.id}\``,
      loan,
    };
  }

  async repayLoan(
    borrowerJid: string,
    loanId: string,
  ): Promise<{ success: boolean; message: string }> {
    const loan = this.loans.get(loanId);

    if (!loan) {
      return { success: false, message: '❌ Préstamo no encontrado' };
    }

    if (loan.borrowerJid !== borrowerJid) {
      return { success: false, message: '❌ Este préstamo no es tuyo' };
    }

    if (loan.status !== 'active') {
      return { success: false, message: '❌ Este préstamo ya fue pagado' };
    }

    const borrower = await serviceManager.userService.getUser(borrowerJid);
    if (borrower.money < loan.totalToRepay) {
      return {
        success: false,
        message: `❌ No tienes suficiente dinero. Necesitas: $${loan.totalToRepay}\nTienes: $${borrower.money}`,
      };
    }

    await serviceManager.userService.removeMoney(borrowerJid, loan.totalToRepay);
    await serviceManager.userService.addMoney(loan.lenderJid, loan.totalToRepay);

    loan.status = 'paid';
    loan.remaining = 0;
    this.saveLoans();

    return {
      success: true,
      message: `✅ *Préstamo pagado!*\n\n💸 Pagaste: $${loan.totalToRepay}\n💰 Ganaste: $${loan.totalToRepay - loan.amount} en intereses\n\n¡Gracias por tu negocio!`,
    };
  }

  getActiveLoans(userJid: string): Loan[] {
    return Array.from(this.loans.values()).filter(
      l => (l.lenderJid === userJid || l.borrowerJid === userJid) && l.status === 'active',
    );
  }

  getLoanById(loanId: string): Loan | undefined {
    return this.loans.get(loanId);
  }

  checkOverdueLoans(): Loan[] {
    const now = Date.now();
    const overdue: Loan[] = [];
    let changed = false;

    for (const loan of this.loans.values()) {
      if (loan.status === 'active' && loan.dueDate < now) {
        loan.status = 'defaulted';
        overdue.push(loan);
        changed = true;
      }
    }

    if (changed) {
      this.saveLoans();
    }

    return overdue;
  }
}

export const loanService = LoanService.getInstance();
