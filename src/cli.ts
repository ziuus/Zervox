#!/usr/bin/env node
import { Command } from 'commander';
import { startProcess, listProcesses, stopProcess } from './clientApi';
import pc from 'picocolors';

const program = new Command();

program
  .name('zervox')
  .description('AI-powered Server Agent that auto-detects and fixes crashes')
  .version('1.0.0');

program
  .command('start <file>')
  .description('Start and monitor a Node.js file')
  .action(async (file: string) => {
    await startProcess(file);
  });

program
  .command('list')
  .description('List all tracked processes')
  .action(async () => {
    await listProcesses();
  });

program
  .command('stop <id>')
  .alias('kill')
  .description('Stop a tracked process by ID')
  .action(async (id: string) => {
    await stopProcess(id);
  });

program.parse();
