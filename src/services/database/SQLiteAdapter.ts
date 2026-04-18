import { Database } from './Database.js';
import { getDatabase } from '@/repositories/Database.js';

const TABLE_NAME_MAP: Record<string, string> = {
  'system:reminders': 'reminders',
  'system:polls': 'polls',
  'game:listas': 'listas',
  bans: 'bans',
  mutes: 'mutes',
  moderation_logs: 'moderation_logs',
};

const COLLECTION_KEY_COLUMN: Record<string, string> = {
  users: 'jid',
  groups: 'jid',
  vania_toggle: 'key',
  reports: 'id',
  reminders: 'key',
  polls: 'key',
  listas: 'key',
  bans: 'id',
  mutes: 'id',
  moderation_logs: 'id',
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
    return TABLE_NAME_MAP[collection] || collection;
  }

  private getKeyColumn(collection: string): string {
    return COLLECTION_KEY_COLUMN[collection] || 'id';
  }

  private parseJsonFields(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) {
        continue;
      }
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      if (value === undefined) {
        continue;
      }
      if (value === null) {
        result[key] = null;
        continue;
      }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.startsWith('[')) {
          try {
            result[key] = JSON.parse(value);
          } catch {
            result[key] = value;
          }
        } else if (trimmed.startsWith('{')) {
          try {
            result[key] = JSON.parse(value);
          } catch {
            result[key] = value;
          }
        } else {
          result[key] = value;
        }
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  async get<T>(collection: string, key: string): Promise<T | null> {
    const table = this.getTableName(collection);
    const keyCol = this.getKeyColumn(collection);
    const result = this.getDb().fetchOne<Record<string, unknown>>(
      `SELECT * FROM ${table} WHERE ${keyCol} = ?`,
      { params: [key] },
    );
    if (!result) return null;
    return this.parseJsonFields(result) as T;
  }

  private getTableColumns(table: string): string[] {
    try {
      const result = this.getDb().fetchAll<{ name: string }>(`PRAGMA table_info(${table})`);
      return result.map(col => col.name);
    } catch {
      return [];
    }
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

    const existingColumns = this.getTableColumns(table);
    const filteredRow: Record<string, unknown> = {};
    for (const [col, val] of Object.entries(row)) {
      if (existingColumns.includes(col)) {
        filteredRow[col] = val;
      }
    }

    const columns = Object.keys(filteredRow);
    if (columns.length === 0) return;

    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map(col => {
      const val = filteredRow[col];
      if (val === undefined || val === null) return null;
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
    const filterKeys = Object.keys(filter).filter(
      k => filter[k] !== undefined && filter[k] !== null,
    );
    const conditions = filterKeys.map(key => `${key} = ?`).join(' AND ');
    const values = filterKeys.map(k => {
      const v = filter[k];
      if (typeof v === 'object') return JSON.stringify(v);
      return v;
    });

    if (!conditions) {
      return this.getAll<T>(collection);
    }

    const results = this.getDb().fetchAll<Record<string, unknown>>(
      `SELECT * FROM ${table} WHERE ${conditions}`,
      { params: values },
    );
    return results.map(r => this.parseJsonFields(r) as T);
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
      if (v === undefined || v === null) return null;
      if (typeof v === 'object') return JSON.stringify(v);
      return v;
    });

    const sql = `UPDATE ${table} SET ${setClauses}, updatedAt = ? WHERE ${keyCol} = ?`;
    this.getDb().query(sql, { params: [...values, Date.now(), key] });
  }

  async getAll<T>(collection: string): Promise<T[]> {
    const table = this.getTableName(collection);
    const results = this.getDb().fetchAll<Record<string, unknown>>(`SELECT * FROM ${table}`);
    return results.map(r => this.parseJsonFields(r) as T);
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

    const filterKeys = Object.keys(filter).filter(
      k => filter[k] !== undefined && filter[k] !== null,
    );
    const whereClauses = filterKeys.map(key => `${key} = ?`);
    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const params = filterKeys.map(k => {
      const v = filter[k];
      if (typeof v === 'object') return JSON.stringify(v);
      return v;
    });

    const countResult = this.getDb().fetchOne<{ cnt: number }>(
      where
        ? `SELECT COUNT(*) as cnt FROM ${table} ${where}`
        : `SELECT COUNT(*) as cnt FROM ${table}`,
      where ? { params } : undefined,
    );
    const total = countResult?.cnt ?? 0;

    const offset = (page - 1) * limit;
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const rawItems =
      params.length > 0
        ? this.getDb().fetchAll<Record<string, unknown>>(
            `SELECT * FROM ${table} ${where} ORDER BY ${sortBy} ${order} LIMIT ? OFFSET ?`,
            { params: [...params, limit, offset] },
          )
        : this.getDb().fetchAll<Record<string, unknown>>(
            `SELECT * FROM ${table} ORDER BY ${sortBy} ${order} LIMIT ? OFFSET ?`,
            { params: [limit, offset] },
          );

    const items = rawItems.map(r => this.parseJsonFields(r) as T);

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
    const filterObj = filter || {};
    const filterKeys = Object.keys(filterObj).filter(
      k => filterObj[k] !== undefined && filterObj[k] !== null,
    );

    if (filterKeys.length === 0) {
      const result = this.getDb().fetchOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM ${table}`);
      return result?.cnt ?? 0;
    }

    const conditions = filterKeys.map(key => `${key} = ?`).join(' AND ');
    const values = filterKeys.map(k => {
      const v = filterObj[k];
      if (typeof v === 'object') return JSON.stringify(v);
      return v;
    });
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
