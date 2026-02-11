import {
  MongoClient,
  Db,
  Collection,
  Filter,
  ObjectId,
  Document,
} from "mongodb";
import { Database } from "./Database.js";
import { logger, logError } from "@/utils/logger.js";

export class MongoDatabase extends Database {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private uri: string;
  private dbName: string;

  constructor(uri: string, dbName: string = "vaniabot") {
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
      logError("MongoDatabase.connect", error);
      throw new Error("Error al conectar con MongoDB");
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.connected = false;
      logger.info("🗄️  Desconectado de MongoDB");
    }
  }

  private getCollection(name: string): Collection {
    if (!this.db) {
      throw new Error("Base de datos no conectada");
    }
    return this.db.collection(name);
  }

  async get<T>(collection: string, key: string): Promise<T | null> {
    const coll = this.getCollection(collection);
    const filter: Filter<Document> = { _id: this.createIdFilter(key) };
    const result = await coll.findOne(filter);
    return result ? (result as T) : null;
  }

  async set<T>(collection: string, key: string, value: T): Promise<void> {
    const coll = this.getCollection(collection);
    await coll.updateOne(
      { _id: this.createIdFilter(key) },
      { $set: { ...value, _id: key } },
      { upsert: true },
    );
  }

  async delete(collection: string, key: string): Promise<boolean> {
    const coll = this.getCollection(collection);
    const result = await coll.deleteOne({ _id: this.createIdFilter(key) });
    return result.deletedCount > 0;
  }

  async has(collection: string, key: string): Promise<boolean> {
    const coll = this.getCollection(collection);
    const count = await coll.countDocuments({ _id: this.createIdFilter(key) });
    return count > 0;
  }

  async find<T>(collection: string, filter: Filter<Document>): Promise<T[]> {
    const coll = this.getCollection(collection);
    return (await coll.find(filter).toArray()) as T[];
  }

  async findOne<T>(
    collection: string,
    filter: Filter<Document>,
  ): Promise<T | null> {
    const coll = this.getCollection(collection);
    const result = await coll.findOne(filter);
    return result ? (result as T) : null;
  }

  async update<T>(
    collection: string,
    key: string,
    updates: Partial<T>,
  ): Promise<void> {
    const coll = this.getCollection(collection);
    await coll.updateOne({ _id: this.createIdFilter(key) }, { $set: updates });
  }

  async getAll<T>(collection: string): Promise<T[]> {
    const coll = this.getCollection(collection);
    return (await coll.find({}).toArray()) as T[];
  }

  async clear(collection: string): Promise<void> {
    const coll = this.getCollection(collection);
    await coll.deleteMany({});
  }

  private createIdFilter(key: string): any {
    if (/^[0-9a-fA-F]{24}$/.test(key)) {
      return new ObjectId(key);
    }
    return key;
  }
}
