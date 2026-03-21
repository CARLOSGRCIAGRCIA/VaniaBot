import { logger } from '@/utils/logger.js';

export interface Migration {
  version: number;
  name: string;
  up: (data: Record<string, Record<string, unknown>>) => Promise<void>;
}

export class DatabaseMigration {
  private migrations: Migration[] = [];
  private currentVersion = 0;

  constructor() {
    this.registerMigrations();
  }

  private registerMigrations(): void {
    this.migrations = [
      {
        version: 1,
        name: 'add_schema_version',
        up: async data => {
          if (!data._meta) {
            data._meta = { version: 1 };
          }
        },
      },
    ];
    this.migrations.sort((a, b) => a.version - b.version);
  }

  getMigrations(): Migration[] {
    return this.migrations;
  }

  getCurrentVersion(): number {
    return this.currentVersion;
  }

  setCurrentVersion(version: number): void {
    this.currentVersion = version;
  }

  async migrate(data: Record<string, Record<string, unknown>>): Promise<number> {
    const meta = data._meta as { version: number } | undefined;
    const fromVersion = meta?.version ?? 0;
    this.currentVersion = fromVersion;

    let migrationsRun = 0;
    for (const migration of this.migrations) {
      if (migration.version > fromVersion) {
        logger.info(`Running migration ${migration.version}: ${migration.name}`);
        await migration.up(data);
        data._meta = { version: migration.version };
        this.currentVersion = migration.version;
        migrationsRun++;
      }
    }

    if (migrationsRun > 0) {
      logger.info(`Completed ${migrationsRun} migrations. New version: ${this.currentVersion}`);
    }

    return this.currentVersion;
  }
}

export const databaseMigration = new DatabaseMigration();
