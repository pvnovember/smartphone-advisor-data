import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';

const LISTINGS_DIR = path.resolve(process.cwd(), '../data/euro/smartphone/listings');
const DB_FILE = 'data.sqlite';

export async function initDb() {
    const dbPath = path.join(LISTINGS_DIR, DB_FILE);

    if (fs.existsSync(dbPath)) {
        console.error(`Error: Database already exists at ${dbPath}`);
        process.exit(1);
    }

    console.log(`Creating database at ${dbPath}...`);
    
    const db = new sqlite3.Database(dbPath);

    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS products (
            product_name TEXT,
            product_code TEXT PRIMARY KEY,
            url TEXT,
            price TEXT,
            is_active BOOLEAN,
            last_active DATE,
            last_processed DATE,
            analytics JSON
        )
    `;

    db.serialize(() => {
        db.run(createTableQuery, (err) => {
            if (err) {
                console.error("Error creating table:", err.message);
                process.exit(1);
            } else {
                console.log("Database initialized successfully with 'products' table.");
            }
        });
    });

    db.close();
}
