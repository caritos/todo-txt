#!/usr/bin/env bun
import { resolveFile } from './store';
import { helpCommand } from './commands/help';
import { addCommand } from './commands/add';
import { listCommand } from './commands/list';
import { listallCommand } from './commands/listall';
import { doneCommand } from './commands/done';
import { rmCommand } from './commands/rm';
import { priCommand, depriCommand } from './commands/pri';

const args = process.argv.slice(2);

// Extract --file flag if present
let fileFlag: string | undefined;
const filteredArgs: string[] = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--file' && i + 1 < args.length) {
    fileFlag = args[i + 1];
    i++; // Skip the next arg (the file path)
  } else {
    filteredArgs.push(args[i]!);
  }
}

// Resolve the file path
const filePath = resolveFile(fileFlag);

// Get the command
const cmd = filteredArgs[0];

// Route to commands
if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
  helpCommand();
  process.exit(0);
}

switch (cmd) {
  case 'add': {
    addCommand(filePath, filteredArgs.slice(1));
    break;
  }

  case 'list': {
    listCommand(filePath, filteredArgs.slice(1));
    break;
  }

  case 'listall': {
    listallCommand(filePath, filteredArgs.slice(1));
    break;
  }

  case 'done': {
    doneCommand(filePath, filteredArgs[1]);
    break;
  }

  case 'rm': {
    rmCommand(filePath, filteredArgs[1]);
    break;
  }

  case 'pri': {
    priCommand(filePath, filteredArgs[1], filteredArgs[2]);
    break;
  }

  case 'depri': {
    depriCommand(filePath, filteredArgs[1]);
    break;
  }

  case 'search':
    console.log('todo search: not yet implemented');
    break;

  case 'report':
    console.log('todo report: not yet implemented');
    break;

  default:
    console.error(`todo: unknown command '${cmd}'`);
    process.exit(1);
}
