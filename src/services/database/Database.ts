export interface IDatabase {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  get<T>(collection: string, key: string): Promise<T | null>;
  set<T>(collection: string, key: string, value: T): Promise<void>;
  delete(collection: string, key: string): Promise<boolean>;
  has(collection: string, key: string): Promise<boolean>;

  find<T>(collection: string, filter: Record<string, unknown>): Promise<T[]>;
  findOne<T>(collection: string, filter: Record<string, unknown>): Promise<T | null>;

  update<T>(collection: string, key: string, updates: Partial<T>): Promise<void>;

  getAll<T>(collection: string): Promise<T[]>;

  getPaginated<T>(
    collection: string,
    options?: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      filter?: Record<string, unknown>;
    },
  ): Promise<PaginatedResult<T>>;

  count(collection: string, filter?: Record<string, unknown>): Promise<number>;

  clear(collection: string): Promise<void>;
  flush(): Promise<void>;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export abstract class Database implements IDatabase {
  protected connected = false;

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract get<T>(collection: string, key: string): Promise<T | null>;
  abstract set<T>(collection: string, key: string, value: T): Promise<void>;
  abstract delete(collection: string, key: string): Promise<boolean>;
  abstract has(collection: string, key: string): Promise<boolean>;
  abstract find<T>(collection: string, filter: Record<string, unknown>): Promise<T[]>;
  abstract findOne<T>(collection: string, filter: Record<string, unknown>): Promise<T | null>;
  abstract update<T>(collection: string, key: string, updates: Partial<T>): Promise<void>;
  abstract getAll<T>(collection: string): Promise<T[]>;
  abstract getPaginated<T>(
    collection: string,
    options?: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      filter?: Record<string, unknown>;
    },
  ): Promise<PaginatedResult<T>>;
  abstract count(collection: string, filter?: Record<string, unknown>): Promise<number>;
  abstract clear(collection: string): Promise<void>;
  abstract flush(): Promise<void>;

  isConnected(): boolean {
    return this.connected;
  }
}
