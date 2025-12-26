#!/usr/bin/env node

import { Command } from 'commander';
import { splitData } from './commands/splitData.js';
import { initDb } from './commands/initDb.js';
import { activityManagement } from './commands/activityManagement.js';

const program = new Command();

program
  .name('euro-smartphone-cli')
  .description('CLI tools for managing Euro smartphone data')
  .version('1.0.0');

program.command('euro-smartphone-data-split')
  .description('Split today_data.xlsx into daily chunks')
  .action(splitData);

program.command('euro-smartphone-init-db')
  .description('Initialize SQLite database')
  .action(initDb);

program.command('euro-smartphone-activity-management')
  .description('Manage product activity and filter processed items')
  .argument('<folderName>', 'Folder name containing the data.xlsx file (e.g., 26_12_2025)')
  .action(activityManagement);

program.parse();
