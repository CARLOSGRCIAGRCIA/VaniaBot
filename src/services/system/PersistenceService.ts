import type { WASocket } from '@whiskeysockets/baileys';
import type { Database } from '../database/Database.js';
import { randomUUID } from 'crypto';
import { logger, logError } from '@/utils/logger.js';

export interface Reminder {
  id: string;
  userJid: string;
  chatJid: string;
  message: string;
  triggerAt: number;
  createdAt: number;
}

export interface PollOption {
  label: string;
  votes: string[];
}

export interface Poll {
  id: string;
  chatJid: string;
  creatorJid: string;
  question: string;
  options: PollOption[];
  allowMultiple: boolean;
  createdAt: number;
  endsAt?: number;
  closed: boolean;
}

export class PersistenceService {
  private static instance: PersistenceService;
  private reminders = new Map<string, Reminder>();
  private reminderTimers = new Map<string, NodeJS.Timeout>();
  private polls = new Map<string, Poll>();
  private pollTimers = new Map<string, NodeJS.Timeout>();
  private db: Database | null = null;
  private sock: WASocket | null = null;
  private initialized = false;

  private readonly MAX_TOTAL_REMINDERS = 1000;
  private readonly DB_REMINDERS_KEY = 'system:reminders';
  private readonly DB_POLLS_KEY = 'system:polls';

  static getInstance(): PersistenceService {
    if (!PersistenceService.instance) {
      PersistenceService.instance = new PersistenceService();
    }
    return PersistenceService.instance;
  }

  setSocket(sock: WASocket): void {
    this.sock = sock;
  }

  setDatabase(db: Database): void {
    this.db = db;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    await this.loadReminders();
    await this.loadPolls();
    this.rescheduleReminders();
    this.startCleanup();

    logger.info(
      `PersistenceService: ${this.reminders.size} reminders, ${this.polls.size} polls loaded`,
    );
  }

  private async loadReminders(): Promise<void> {
    if (!this.db) return;
    try {
      const stored = await this.db.get<Record<string, Reminder>>(this.DB_REMINDERS_KEY, 'data');
      if (stored) {
        for (const [id, reminder] of Object.entries(stored)) {
          if (reminder.triggerAt > Date.now()) {
            this.reminders.set(id, reminder);
          }
        }
      }
    } catch (error) {
      logError('PersistenceService.loadReminders', error);
    }
  }

  private async loadPolls(): Promise<void> {
    if (!this.db) return;
    try {
      const stored = await this.db.get<Record<string, Poll>>(this.DB_POLLS_KEY, 'data');
      if (stored) {
        for (const [chatJid, poll] of Object.entries(stored)) {
          if (!poll.closed && (!poll.endsAt || poll.endsAt > Date.now())) {
            this.polls.set(chatJid, poll);
          }
        }
      }
    } catch (error) {
      logError('PersistenceService.loadPolls', error);
    }
  }

  private async saveReminders(): Promise<void> {
    if (!this.db) return;
    const data: Record<string, Reminder> = {};
    for (const [id, reminder] of this.reminders) {
      data[id] = reminder;
    }
    await this.db.set(this.DB_REMINDERS_KEY, 'data', data);
  }

  private async savePolls(): Promise<void> {
    if (!this.db) return;
    const data: Record<string, Poll> = {};
    for (const [chatJid, poll] of this.polls) {
      data[chatJid] = poll;
    }
    await this.db.set(this.DB_POLLS_KEY, 'data', data);
  }

  private rescheduleReminders(): void {
    if (!this.sock) return;
    for (const reminder of this.reminders.values()) {
      if (reminder.triggerAt > Date.now()) {
        this.scheduleReminder(reminder);
      }
    }
  }

  private startCleanup(): void {
    setInterval(
      () => {
        const now = Date.now();

        for (const [id, reminder] of this.reminders.entries()) {
          if (reminder.triggerAt < now) {
            this.reminders.delete(id);
            const timer = this.reminderTimers.get(id);
            if (timer) {
              clearTimeout(timer);
              this.reminderTimers.delete(id);
            }
          }
        }

        for (const [chatJid, poll] of this.polls.entries()) {
          if (poll.closed || (poll.endsAt && poll.endsAt < now)) {
            this.polls.delete(chatJid);
            const timer = this.pollTimers.get(chatJid);
            if (timer) {
              clearTimeout(timer);
              this.pollTimers.delete(chatJid);
            }
          }
        }

        if (this.reminders.size > this.MAX_TOTAL_REMINDERS) {
          const sorted = [...this.reminders.entries()].sort(
            (a, b) => a[1].triggerAt - b[1].triggerAt,
          );
          const toDelete = sorted.slice(0, this.reminders.size - this.MAX_TOTAL_REMINDERS);
          for (const [id] of toDelete) {
            this.reminders.delete(id);
            const timer = this.reminderTimers.get(id);
            if (timer) {
              clearTimeout(timer);
              this.reminderTimers.delete(id);
            }
          }
        }

        void this.saveReminders();
        void this.savePolls();
      },
      60 * 60 * 1000,
    );
  }

  private scheduleReminder(reminder: Reminder): void {
    const delay = reminder.triggerAt - Date.now();
    if (delay <= 0) return;

    const timer = setTimeout(async () => {
      try {
        if (this.sock) {
          await this.sock.sendMessage(reminder.chatJid, {
            text:
              `⏰ *¡Recordatorio!*\n` +
              `━━━━━━━━━━━━━━━━\n` +
              `📝 ${reminder.message}\n` +
              `━━━━━━━━━━━━━━━━\n` +
              `👤 @${reminder.userJid.split('@')[0]}`,
            mentions: [reminder.userJid],
          });
        }
      } catch {
        // Ignorar errores de envío
      }
      this.reminders.delete(reminder.id);
      this.reminderTimers.delete(reminder.id);
      void this.saveReminders();
    }, delay);

    this.reminderTimers.set(reminder.id, timer);
  }

  addReminder(reminder: Reminder): void {
    this.reminders.set(reminder.id, reminder);
    this.scheduleReminder(reminder);
    void this.saveReminders();
  }

  getReminder(id: string): Reminder | undefined {
    return this.reminders.get(id);
  }

  getUserReminders(userJid: string): Reminder[] {
    return [...this.reminders.values()].filter(r => r.userJid === userJid);
  }

  removeReminder(id: string): void {
    const timer = this.reminderTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.reminderTimers.delete(id);
    }
    this.reminders.delete(id);
    void this.saveReminders();
  }

  generateId(): string {
    return randomUUID().split('-')[0].toUpperCase();
  }

  getPoll(chatJid: string): Poll | undefined {
    const poll = this.polls.get(chatJid);
    if (!poll) return undefined;
    if (poll.endsAt && poll.endsAt < Date.now()) {
      poll.closed = true;
      void this.savePolls();
    }
    return poll;
  }

  addPoll(chatJid: string, poll: Poll): void {
    this.polls.set(chatJid, poll);
    void this.savePolls();

    if (poll.endsAt && poll.endsAt > Date.now()) {
      const delay = poll.endsAt - Date.now();
      const timer = setTimeout(async () => {
        const p = this.polls.get(chatJid);
        if (p && !p.closed) {
          p.closed = true;
          void this.savePolls();
        }
      }, delay);
      this.pollTimers.set(chatJid, timer);
    }
  }

  updatePoll(chatJid: string, poll: Poll): void {
    this.polls.set(chatJid, poll);
    void this.savePolls();
  }

  removePoll(chatJid: string): void {
    const timer = this.pollTimers.get(chatJid);
    if (timer) {
      clearTimeout(timer);
      this.pollTimers.delete(chatJid);
    }
    this.polls.delete(chatJid);
    void this.savePolls();
  }

  getAllPolls(): Poll[] {
    return [...this.polls.values()];
  }
}

export const persistenceService = PersistenceService.getInstance();
