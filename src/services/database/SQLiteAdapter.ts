import { Database } from './Database.js';
import { getDatabase } from '@/repositories/Database.js';

const COLLECTION_KEY_COLUMN: Record<string, string> = {
  users: 'jid',
  groups: 'jid',
  vania_toggle: 'key',
  reports: 'id',
  reminders: 'key',
  polls: 'key',
  listas: 'key',
  mutes: 'id',
  ai_sessions: 'id',
  subbots: 'id',
  subbot_slots: 'slot_number',
  cooldowns: 'id',
  locks: 'key',
  jobs: 'id',
  anticall_config: 'id',
  anticall_blocked_users: 'id',
  bot_runtime_state: 'bot_id',
  health_events: 'id',
  orchestrator_state: 'id',
  processed_messages: 'message_id',
};

export class SQLiteAdapter extends Database {
  protected connected = true;

  private getDb() {
    return getDatabase();
  }

  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {
    this.getDb().forceSave();
  }

  isConnected(): boolean {
    return true;
  }

  private getTableName(collection: string): string {
    return collection;
  }

  private getKeyColumn(collection: string): string {
    return COLLECTION_KEY_COLUMN[collection] || 'id';
  }

  async get<T>(collection: string, key: string): Promise<T | null> {
    const table = this.getTableName(collection);
    const keyCol = this.getKeyColumn(collection);
    const result = this.getDb().fetchOne<T>(
      `SELECT * FROM ${table} WHERE ${keyCol} = ?`,
      { params: [key] },
    );
    return result || null;
  }

  async set<T>(collection: string, key: string, value: T): Promise<void> {
    const table = this.getTableName(collection);
    const keyCol = this.getKeyColumn(collection);
    const row = { ...(value as Record<string, unknown>) };
    row[keyCol] = key;
    row['updatedAt'] = Date.now();

    if (!row['createdAt']) {
      row['createdAt'] = Date.now();
    }

    const columns = Object.keys(row);
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map(col => {
      const val = row[col];
      if (typeof val === 'object') return JSON.stringify(val);
      return val;
    });

    const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    this.getDb().query(sql, { params: values });
  }

  async delete(collection: string, key: string): Promise<boolean> {
    const table = this.getTableName(collection);
    const keyCol = this.getKeyColumn(collection);
    this.getDb().query(`DELETE FROM ${table} WHERE ${keyCol} = ?`, { params: [key] });
    return true;
  }

  async has(collection: string, key: string): Promise<boolean> {
    const table = this.getTableName(collection);
    const keyCol = this.getKeyColumn(collection);
    const result = this.getDb().fetchOne<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM ${table} WHERE ${keyCol} = ?`,
      { params: [key] },
    );
    return (result?.cnt ?? 0) > 0;
  }

  async find<T>(collection: string, filter: Record<string, unknown>): Promise<T[]> {
    const table = this.getTableName(collection);
    const conditions = Object.keys(filter).map(key => `${key} = ?`).join(' AND ');
    const values = Object.values(filter).map(v => {
      if (typeof v === 'object') return JSON.stringify(v);
      return v;
    });

    if (!conditions) {
      return this.getDb().fetchAll<T>(`SELECT * FROM ${table}`);
    }

    return this.getDb().fetchAll<T>(
      `SELECT * FROM ${table} WHERE ${conditions}`,
      { params: values },
    );
  }

  async findOne<T>(collection: string, filter: Record<string, unknown>): Promise<T | null> {
    const results = await this.find<T>(collection, filter);
    return results[0] || null;
  }

  async update<T>(collection: string, key: string, updates: Partial<T>): Promise<void> {
    const table = this.getTableName(collection);
    const keyCol = this.getKeyColumn(collection);
    const updateData = updates as Record<string, unknown>;

    const setClauses = Object.keys(updateData)
      .map(key => `${key} = ?`)
      .join(', ');

    const values = Object.values(updateData).map(v => {
      if (typeof v === 'object') return JSON.stringify(v);
      return v;
    });

    const sql = `UPDATE ${table} SET ${setClauses}, updatedAt = ? WHERE ${keyCol} = ?`;
    this.getDb().query(sql, { params: [...values, Date.now(), key] });
  }

  async getAll<T>(collection: string): Promise<T[]> {
    const table = this.getTableName(collection);
    return this.getDb().fetchAll<T>(`SELECT * FROM ${table}`);
  }

  async keys(collection: string): Promise<string[]> {
    const table = this.getTableName(collection);
    const keyCol = this.getKeyColumn(collection);
    const results = this.getDb().fetchAll<{ key: string }>(`SELECT ${keyCol} as key FROM ${table}`);
    return results.map(r => r.key);
  }

  async getPaginated<T>(
    collection: string,
    options?: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      filter?: Record<string, unknown>;
    },
  ): Promise<import('./Database.js').PaginatedResult<T>> {
    const table = this.getTableName(collection);
    const keyCol = this.getKeyColumn(collection);
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const sortBy = options?.sortBy || keyCol;
    const sortOrder = options?.sortOrder || 'asc';
    const filter = options?.filter || {};

    const whereClauses = Object.keys(filter).map(key => `${key} = ?`);
    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const params = Object.values(filter);

    const countResult = this.getDb().fetchOne<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM ${table} ${where}`,
      { params },
    );
    const total = countResult?.cnt ?? 0;

    const offset = (page - 1) * limit;
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const items = this.getDb().fetchAll<T>(
      `SELECT * FROM ${table} ${where} ORDER BY ${sortBy} ${order} LIMIT ? OFFSET ?`,
      { params: [...params, limit, offset] },
    );

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    };
  }

  async count(collection: string, filter?: Record<string, unknown>): Promise<number> {
    const table = this.getTableName(collection);
    if (!filter || Object.keys(filter).length === 0) {
      const result = this.getDb().fetchOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM ${table}`);
      return result?.cnt ?? 0;
    }

    const conditions = Object.keys(filter).map(key => `${key} = ?`).join(' AND ');
    const values = Object.values(filter);
    const result = this.getDb().fetchOne<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM ${table} WHERE ${conditions}`,
      { params: values },
    );
    return result?.cnt ?? 0;
  }

  async clear(collection: string): Promise<void> {
    const table = this.getTableName(collection);
    this.getDb().query(`DELETE FROM ${table}`);
  }

  async flush(): Promise<void> {
    this.getDb().forceSave();
  }
}

export const sqliteAdapter = new SQLiteAdapter();