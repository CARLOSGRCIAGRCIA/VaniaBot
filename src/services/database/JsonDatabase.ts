import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { Database } from "./Database.js";
import { logger, logError } from "@/utils/logger.js";

interface JsonData {
  [collection: string]: {
    [key: string]: any;
  };
}

export class JsonDatabase extends Database {
  private data: JsonData = {};
  private filePath: string;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor(filePath: string = "./data/database.json") {
    super();
    this.filePath = filePath;
  }

  async connect(): Promise<void> {
    try {
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      if (existsSync(this.filePath)) {
        const rawData = readFileSync(this.filePath, "utf-8");
        this.data = JSON.parse(rawData);
        logger.info(`Base de datos JSON cargada: ${this.filePath}`);
      } else {
        this.data = {};
        this.save();
        logger.info(`Nueva base de datos JSON creada: ${this.filePath}`);
      }

      this.connected = true;
    } catch (error) {
      logError("JsonDatabase.connect", error);
      throw new Error("Error al conectar con la base de datos JSON");
    }
  }

  async disconnect(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    await this.save();
    this.connected = false;
    logger.info("Base de datos JSON desconectada");
  }

  private ensureCollection(collection: string): void {
    if (!this.data[collection]) {
      this.data[collection] = {};
    }
  }

  private save(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      try {
        writeFileSync(
          this.filePath,
          JSON.stringify(this.data, null, 2),
          "utf-8",
        );
      } catch (error) {
        logError("JsonDatabase.save", error);
      }
    }, 500);
  }

  async get<T>(collection: string, key: string): Promise<T | null> {
    this.ensureCollection(collection);
    return this.data[collection][key] || null;
  }

  async set<T>(collection: string, key: string, value: T): Promise<void> {
    this.ensureCollection(collection);
    this.data[collection][key] = value;
    this.save();
  }

  async delete(collection: string, key: string): Promise<boolean> {
    this.ensureCollection(collection);
    if (this.data[collection][key]) {
      delete this.data[collection][key];
      this.save();
      return true;
    }
    return false;
  }

  async has(collection: string, key: string): Promise<boolean> {
    this.ensureCollection(collection);
    return key in this.data[collection];
  }

  async find<T>(collection: string, filter: Record<string, any>): Promise<T[]> {
    this.ensureCollection(collection);
    const results: T[] = [];

    for (const [key, value] of Object.entries(this.data[collection])) {
      let matches = true;

      for (const [filterKey, filterValue] of Object.entries(filter)) {
        if (value[filterKey] !== filterValue) {
          matches = false;
          break;
        }
      }

      if (matches) {
        results.push(value as T);
      }
    }

    return results;
  }

  async findOne<T>(
    collection: string,
    filter: Record<string, any>,
  ): Promise<T | null> {
    const results = await this.find<T>(collection, filter);
    return results[0] || null;
  }

  async update<T>(
    collection: string,
    key: string,
    updates: Partial<T>,
  ): Promise<void> {
    this.ensureCollection(collection);

    if (this.data[collection][key]) {
      this.data[collection][key] = {
        ...this.data[collection][key],
        ...updates,
      };
      this.save();
    } else {
      throw new Error(`Key ${key} not found in collection ${collection}`);
    }
  }

  async getAll<T>(collection: string): Promise<T[]> {
    this.ensureCollection(collection);
    return Object.values(this.data[collection]) as T[];
  }

  async clear(collection: string): Promise<void> {
    this.data[collection] = {};
    this.save();
  }
}
