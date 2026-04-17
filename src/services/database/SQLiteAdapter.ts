import type { IDatabase, PaginatedResult } from './Database.js';
import { Database } from './Database.js';
import { getDatabase } from '@/repositories/Database.js';

interface DbRow {
  [key: string]: unknown;
}

export class SQLiteAdapter extends Database {
  protected connected = true;

  private getDb() {
    return getDatabase();
  }

  async connect(): Promise<void> {
    // No actual connection needed for SQLite, but we can verify the database is accessible
  }

  async disconnect(): Promise<void> {
    this.getDb().forceSave();
  }

  isConnected(): boolean {
    return true;
  }

  private getTableName(collection: string): string {
    const tableMap: Record<string, string> = {
      users: 'users',
      groups: 'groups',
      vania_toggle: 'vania_toggle',
      reports: 'reports',
      reminders: 'reminders',
      polls: 'polls',
      listas: 'listas',
      cooldowns: 'cooldowns',
      locks: 'locks',
      jobs: 'jobs',
    };
    return tableMap[collection] || collection;
  }

  async get<T>(collection: string, key: string): Promise<T | null> {
    const table = this.getTableName(collection);
    const result = this.getDb().fetchOne<T>(`SELECT * FROM ${table} WHERE jid = ?`, {
      params: [key],
    });
    return result;
  }

  async set<T>(collection: string, key: string, value: T): Promise<void> {
    const table = this.getTableName(collection);
    const row = value as Record<string, unknown>;
    row['jid'] = key;
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
    const hasJidColumn =
      this.getDb().fetchOne<{ name: string }>(`PRAGMA table_info(${table})`)?.name === 'jid';

    if (hasJidColumn) {
      this.getDb().query(`DELETE FROM ${table} WHERE jid = ?`, { params: [key] });
    } else {
      this.getDb().query(`DELETE FROM ${table} WHERE key = ?`, { params: [key] });
    }
    return true;
  }

  async has(collection: string, key: string): Promise<boolean> {
    const table = this.getTableName(collection);
    const hasJidColumn =
      this.getDb().fetchOne<{ name: string }>(`PRAGMA table_info(${table})`)?.name === 'jid';

    const column = hasJidColumn ? 'jid' : 'key';
    const result = this.getDb().fetchOne<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM ${table} WHERE ${column} = ?`,
      { params: [key] },
    );
    return (result?.cnt ?? 0) > 0;
  }

  async find<T>(collection: string, filter: Record<string, unknown>): Promise<T[]> {
    const table = this.getTableName(collection);
    const conditions = Object.keys(filter)
      .map(key => `${key} = ?`)
      .join(' AND ');
    const values = Object.values(filter).map(v => {
      if (typeof v === 'object') return JSON.stringify(v);
      return v;
    });

    if (!conditions) {
      return this.getDb().fetchAll<T>(`SELECT * FROM ${table}`);
    }

    return this.getDb().fetchAll<T>(`SELECT * FROM ${table} WHERE ${conditions}`, {
      params: values,
    });
  }

  async findOne<T>(collection: string, filter: Record<string, unknown>): Promise<T | null> {
    const results = await this.find<T>(collection, filter);
    return results[0] || null;
  }

  async update<T>(collection: string, key: string, updates: Partial<T>): Promise<void> {
    const table = this.getTableName(collection);
    const updateData = updates as Record<string, unknown>;

    const setClauses = Object.keys(updateData)
      .map(key => {
        const val = updateData[key];
        if (typeof val === 'object') {
          return `${key} = ?`;
        }
        return `${key} = ?`;
      })
      .join(', ');

    const values = Object.values(updateData).map(v => {
      if (typeof v === 'object') return JSON.stringify(v);
      return v;
    });

    const hasJidColumn =
      this.getDb().fetchOne<{ name: string }>(`PRAGMA table_info(${table})`)?.name === 'jid';

    const column = hasJidColumn ? 'jid' : 'key';

    const sql = `UPDATE ${table} SET ${setClauses}, updatedAt = ? WHERE ${column} = ?`;
    this.getDb().query(sql, { params: [...values, Date.now(), key] });
  }

  async getAll<T>(collection: string): Promise<T[]> {
    const table = this.getTableName(collection);
    return this.getDb().fetchAll<T>(`SELECT * FROM ${table}`);
  }

  async keys(collection: string): Promise<string[]> {
    const table = this.getTableName(collection);
    const hasJidColumn =
      this.getDb().fetchOne<{ name: string }>(`PRAGMA table_info(${table})`)?.name === 'jid';

    const column = hasJidColumn ? 'jid' : 'key';

    const results = this.getDb().fetchAll<{ id: string }>(`SELECT ${column} as id FROM ${table}`);
    return results.map((r: { id: string }) => r.id);
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
  ): Promise<PaginatedResult<T>> {
    const table = this.getTableName(collection);
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const sortBy = options?.sortBy || 'jid';
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

    const conditions = Object.keys(filter)
      .map(key => `${key} = ?`)
      .join(' AND ');
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
