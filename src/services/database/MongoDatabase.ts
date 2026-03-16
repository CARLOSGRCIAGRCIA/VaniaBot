import type { Db, Collection, Filter, Document } from 'mongodb';
import { MongoClient, ObjectId } from 'mongodb';
import { Database } from './Database.js';
import { logger, logError } from '@/utils/logger.js';
import { ErrorHandler } from '@/utils/ErrorHandler.js';

export class MongoDatabase extends Database {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private uri: string;
  private dbName: string;

  constructor(uri: string, dbName: string = 'vaniabot') {
    super();
    this.uri = uri;
    this.dbName = dbName;
  }

  async connect(): Promise<void> {
    try {
      this.client = new MongoClient(this.uri);
      await this.client.connect();
      this.db = this.client.db(this.dbName);
      this.connected = true;
      logger.info(`🗄️  Conectado a MongoDB: ${this.dbName}`);
    } catch (error) {
      logError('MongoDatabase.connect', error);
      throw new Error('Error al conectar con MongoDB');
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.connected = false;
      logger.info('🗄️  Desconectado de MongoDB');
    }
  }

  private getCollection(name: string): Collection {
    if (!this.db) {
      throw new Error('Base de datos no conectada');
    }
    return this.db.collection(name);
  }

  private createIdFilter(key: string): ObjectId | string {
    if (/^[0-9a-fA-F]{24}$/.test(key)) {
      return new ObjectId(key);
    }
    return key;
  }

  private createIdFilterDocument(key: string): Filter<Document> {
    const id = this.createIdFilter(key);
    return { _id: id } as Filter<Document>;
  }

  async get<T>(collection: string, key: string): Promise<T | null> {
    const coll = this.getCollection(collection);
    const filter = this.createIdFilterDocument(key);
    const result = await coll.findOne(filter);
    return result ? (result as T) : null;
  }

  async set<T>(collection: string, key: string, value: T): Promise<void> {
    const coll = this.getCollection(collection);
    const filter = this.createIdFilterDocument(key);

    // Guardar el key original como _id
    const doc = {
      ...value,
      _id: key, // Guardamos el key original como string siempre
    };

    await coll.updateOne(filter, { $set: doc }, { upsert: true });
  }

  async delete(collection: string, key: string): Promise<boolean> {
    const coll = this.getCollection(collection);
    const filter = this.createIdFilterDocument(key);
    const result = await coll.deleteOne(filter);
    return result.deletedCount > 0;
  }

  async has(collection: string, key: string): Promise<boolean> {
    const coll = this.getCollection(collection);
    const filter = this.createIdFilterDocument(key);
    const count = await coll.countDocuments(filter);
    return count > 0;
  }

  async find<T>(collection: string, filter: Filter<Document>): Promise<T[]> {
    const coll = this.getCollection(collection);
    const results = await coll.find(filter).toArray();
    return results as T[];
  }

  async findOne<T>(collection: string, filter: Filter<Document>): Promise<T | null> {
    const coll = this.getCollection(collection);
    const result = await coll.findOne(filter);
    return result ? (result as T) : null;
  }

  async update<T>(collection: string, key: string, updates: Partial<T>): Promise<void> {
    const coll = this.getCollection(collection);
    const filter = this.createIdFilterDocument(key);
    await coll.updateOne(filter, { $set: updates });
  }

  async getAll<T>(collection: string): Promise<T[]> {
    const coll = this.getCollection(collection);
    const results = await coll.find({}).toArray();
    return results as T[];
  }

  async clear(collection: string): Promise<void> {
    const coll = this.getCollection(collection);
    await coll.deleteMany({});
  }

  async retryOperation<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    return ErrorHandler.retry(operation, {
      maxRetries: 3,
      delayMs: 1000,
      onRetry: (attempt, error) => {
        logger.warn(
          `MongoDB ${operationName} retry ${attempt}: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      },
    });
  }
}
