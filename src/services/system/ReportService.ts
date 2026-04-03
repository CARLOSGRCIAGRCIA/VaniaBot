import type { IDatabase } from '../database/Database.js';

export interface Report {
  id: string;
  type: 'report' | 'bugreport' | 'feedback';
  fromJid: string;
  fromName: string;
  fromGroup?: string;
  fromGroupName?: string;
  content: string;
  timestamp: number;
  status: 'pending' | 'read' | 'resolved';
  readAt?: number;
  resolvedAt?: number;
  resolvedBy?: string;
}

export class ReportService {
  private db: IDatabase;
  private readonly COLLECTION = 'reports';
  private idCounter: number = 0;

  constructor(db: IDatabase) {
    this.db = db;
  }

  async initialize(): Promise<void> {
    const counter = await this.db.get<{ value: number }>(this.COLLECTION, '_counter');
    this.idCounter = counter?.value || 0;
  }

  private generateId(): string {
    this.idCounter++;
    const id = `RPT-${Date.now()}-${this.idCounter.toString().padStart(4, '0')}`;
    void this.db.set(this.COLLECTION, '_counter', { value: this.idCounter });
    return id;
  }

  async createReport(
    type: Report['type'],
    fromJid: string,
    fromName: string,
    content: string,
    fromGroup?: string,
    fromGroupName?: string,
  ): Promise<Report> {
    const report: Report = {
      id: this.generateId(),
      type,
      fromJid,
      fromName,
      fromGroup,
      fromGroupName,
      content,
      timestamp: Date.now(),
      status: 'pending',
    };

    await this.db.set(this.COLLECTION, report.id, report);
    await this.db.flush();

    return report;
  }

  async getReport(id: string): Promise<Report | null> {
    return await this.db.get<Report>(this.COLLECTION, id);
  }

  async getReports(options?: {
    status?: Report['status'];
    limit?: number;
    page?: number;
  }): Promise<{ items: Report[]; total: number }> {
    const { status, limit = 50, page = 1 } = options || {};

    const allReports = await this.db.getAll<Report>(this.COLLECTION);
    let filtered = allReports.filter(r => r.id !== '_counter');

    if (status) {
      filtered = filtered.filter(r => r.status === status);
    }

    filtered.sort((a, b) => b.timestamp - a.timestamp);

    const total = filtered.length;
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);

    return { items, total };
  }

  async getReportsByUser(jid: string): Promise<Report[]> {
    const allReports = await this.db.getAll<Report>(this.COLLECTION);
    return allReports
      .filter(r => r.id !== '_counter' && r.fromJid === jid)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  async getPendingCount(): Promise<number> {
    const { total } = await this.getReports({ status: 'pending' });
    return total;
  }

  async markAsRead(id: string, _readBy?: string): Promise<boolean> {
    const report = await this.getReport(id);
    if (!report) return false;

    const updated: Report = {
      ...report,
      status: 'read',
      readAt: Date.now(),
    };

    await this.db.set(this.COLLECTION, id, updated);
    await this.db.flush();
    return true;
  }

  async resolveReport(id: string, resolvedBy?: string): Promise<boolean> {
    const report = await this.getReport(id);
    if (!report) return false;

    const updated: Report = {
      ...report,
      status: 'resolved',
      resolvedAt: Date.now(),
      resolvedBy,
    };

    await this.db.set(this.COLLECTION, id, updated);
    await this.db.flush();
    return true;
  }

  async deleteReport(id: string): Promise<boolean> {
    const report = await this.getReport(id);
    if (!report) return false;

    await this.db.delete(this.COLLECTION, id);
    await this.db.flush();
    return true;
  }

  formatReportForOwner(report: Report): string {
    const date = new Date(report.timestamp).toLocaleString();
    const typeEmoji = report.type === 'bugreport' ? '🐛' : report.type === 'feedback' ? '💡' : '📢';
    const typeLabel =
      report.type === 'bugreport'
        ? 'Bug Report'
        : report.type === 'feedback'
          ? 'Feedback'
          : 'Report';

    let message = `${typeEmoji} *${typeLabel}*\n`;
    message += `━━━━━━━━━━━━━━━━\n`;
    message += `📋 ID: \`${report.id}\`\n`;
    message += `👤 De: ${report.fromName}\n`;
    message += `📱 @${report.fromJid.split('@')[0]}\n`;

    if (report.fromGroup) {
      message += `💬 Grupo: ${report.fromGroupName || report.fromGroup}\n`;
    }

    message += `🕐 Fecha: ${date}\n`;
    message += `━━━━━━━━━━━━━━━━\n`;
    message += `📝 *Contenido:*\n${report.content}\n`;
    message += `━━━━━━━━━━━━━━━━\n`;
    message += `Estado: ${report.status === 'pending' ? '⏳ Pendiente' : report.status === 'read' ? '👁️ Leído' : '✅ Resuelto'}`;

    return message;
  }
}
