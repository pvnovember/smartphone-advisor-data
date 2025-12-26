import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import sqlite3 from 'sqlite3';
import { format, subMonths, parseISO, isBefore } from 'date-fns';

const LISTINGS_DIR = path.resolve(process.cwd(), '../data/euro/smartphone/listings');
const DB_FILE = 'data.sqlite';

function getDb() {
    const dbPath = path.join(LISTINGS_DIR, DB_FILE);
    if (!fs.existsSync(dbPath)) {
        console.error(`Error: Database not found at ${dbPath}`);
        process.exit(1);
    }
    return new sqlite3.Database(dbPath);
}

function runQuery(db, query, params = []) {
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function getQuery(db, query, params = []) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

export async function activityManagement(folderName) {
    const folderPath = path.join(LISTINGS_DIR, folderName);
    const filePath = path.join(folderPath, 'data.xlsx');

    if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found at ${filePath}`);
        process.exit(1);
    }

    console.log(`Processing ${filePath}...`);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
        console.log("No data found in the file.");
        return;
    }

    // Extract Product Codes from Excel
    // The column name is 'Product Code (Nr kat)'
    // Note: Keys in sheet_to_json might have trimmed spaces or different formatting if not careful, 
    // but usually it matches the header string.
    const productCodeKey = 'Product Code (Nr kat)';
    const xlsxProductCodes = new Set(data.map(row => String(row[productCodeKey] || '')).filter(c => c));

    const db = getDb();

    try {
        // 1. Deactivate records not in XLSX
        console.log("Checking for inactive products...");
        const allDbProducts = await getQuery(db, "SELECT product_code FROM products");
        
        let deactivatedCount = 0;
        for (const row of allDbProducts) {
            if (!xlsxProductCodes.has(row.product_code)) {
                await runQuery(db, "UPDATE products SET is_active = 0 WHERE product_code = ?", [row.product_code]);
                deactivatedCount++;
            }
        }
        console.log(`Deactivated ${deactivatedCount} products.`);

        // 2. Process XLSX records
        console.log("Updating active products and filtering list...");
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const sixMonthsAgo = subMonths(new Date(), 6);
        
        const recordsToKeep = [];

        for (const row of data) {
            const code = String(row[productCodeKey] || '');
            if (!code) continue;

            // Check if exists in DB
            const dbRecord = await getQuery(db, "SELECT * FROM products WHERE product_code = ?", [code]);
            
            if (dbRecord.length > 0) {
                const record = dbRecord[0];
                
                // Update is_active and last_active
                await runQuery(db, "UPDATE products SET is_active = 1, last_active = ? WHERE product_code = ?", [todayStr, code]);

                // Check last_processed
                let shouldKeep = true;
                if (record.last_processed) {
                    const lastProcessedDate = parseISO(record.last_processed);
                    // If last_processed is NOT older than 6 months (i.e., it is AFTER 6 months ago), remove it.
                    // Older than 6 months means: date < sixMonthsAgo
                    // Not older means: date >= sixMonthsAgo
                    
                    if (!isBefore(lastProcessedDate, sixMonthsAgo)) {
                        shouldKeep = false;
                    }
                }
                // If last_processed is null, we keep it (implied, as it hasn't been processed)

                if (shouldKeep) {
                    recordsToKeep.push(row);
                }

            } else {
                // Record does not exist in DB. 
                // Prompt doesn't explicitly say what to do, but usually we keep new items to process them.
                recordsToKeep.push(row);
            }
        }

        // 3. Rewrite Excel file
        console.log(`Rewriting Excel file. Original: ${data.length}, Keeping: ${recordsToKeep.length}`);
        
        const newWorkbook = XLSX.utils.book_new();
        const newWorksheet = XLSX.utils.json_to_sheet(recordsToKeep);
        XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, "Sheet1");
        
        XLSX.writeFile(newWorkbook, filePath);
        console.log("File updated successfully.");

    } catch (err) {
        console.error("Error during processing:", err);
    } finally {
        db.close();
    }
}
