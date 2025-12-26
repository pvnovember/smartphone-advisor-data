import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { format, addDays } from 'date-fns';

const LISTINGS_DIR = path.resolve(process.cwd(), '../data/euro/smartphone/listings');
const SOURCE_FILE = 'today_data.xlsx';
const CHUNK_SIZE = 260;

export async function splitData() {
    const sourcePath = path.join(LISTINGS_DIR, SOURCE_FILE);

    if (!fs.existsSync(sourcePath)) {
        console.error(`Error: Source file not found at ${sourcePath}`);
        process.exit(1);
    }

    console.log(`Reading data from ${sourcePath}...`);
    const workbook = XLSX.readFile(sourcePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON to easily manipulate rows
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    if (data.length === 0) {
        console.log("No data found in the source file.");
        return;
    }

    console.log(`Total records: ${data.length}`);
    
    const totalChunks = Math.ceil(data.length / CHUNK_SIZE);
    const today = new Date();

    for (let i = 0; i < totalChunks; i++) {
        const chunkData = data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        
        // Calculate date for this chunk
        const chunkDate = addDays(today, i);
        const folderName = format(chunkDate, 'dd_MM_yyyy');
        const folderPath = path.join(LISTINGS_DIR, folderName);

        // Create directory if it doesn't exist
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }

        // Create new workbook for the chunk
        const newWorkbook = XLSX.utils.book_new();
        const newWorksheet = XLSX.utils.json_to_sheet(chunkData);
        XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, "Sheet1");

        const destFile = path.join(folderPath, 'data.xlsx');
        XLSX.writeFile(newWorkbook, destFile);
        
        console.log(`Created ${destFile} with ${chunkData.length} records.`);
    }

    console.log("Data split completed successfully.");
}
