import SQLite from "better-sqlite3";
import { promises as fs } from "fs";
import { Kysely, SqliteDialect } from "kysely";
import {
    Migrator,
    type Migration,
    type MigrationProvider,
} from "kysely/migration";
import * as path from "path";
import { pathToFileURL } from "url";

class ESMFileMigrationProvider implements MigrationProvider {
    constructor(private migrationFolder: string) {}

    async getMigrations(): Promise<Record<string, Migration>> {
        const migrations: Record<string, Migration> = {};
        const files = await fs.readdir(this.migrationFolder);

        for (const fileName of files) {
            if (!fileName.endsWith(".ts") && !fileName.endsWith(".js"))
                continue;

            const fullPath = path.join(this.migrationFolder, fileName);
            const fileUrl = pathToFileURL(fullPath).href; // ← the actual fix
            const migration = await import(fileUrl);

            const migrationKey = fileName.substring(
                0,
                fileName.lastIndexOf("."),
            );
            migrations[migrationKey] = migration;
        }

        return migrations;
    }
}

async function migrateToLatest() {
    const sqlite = new SQLite(
        path.join(process.cwd(), "youtube-music-tracker.db"),
    );
    sqlite.pragma("foreign_keys = ON");

    const db = new Kysely<unknown>({
        dialect: new SqliteDialect({ database: sqlite }),
    });

    const migrator = new Migrator({
        db,
        provider: new ESMFileMigrationProvider(
            path.join(process.cwd(), "src/lib/database/migrations"),
        ),
    });

    const { error, results } = await migrator.migrateToLatest();

    results?.forEach((it) => {
        if (it.status === "Success") {
            console.log(`✅ migration "${it.migrationName}" executed`);
        } else if (it.status === "Error") {
            console.error(`❌ migration "${it.migrationName}" failed`);
        }
    });

    if (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }

    await db.destroy();
}

migrateToLatest();
