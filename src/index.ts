#!/usr/bin/env bun
import { resolveFile } from './store';
import { helpCommand } from './commands/help';
import { addCommand } from './commands/add';

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

  case 'list':
    console.log('todo list: not yet implemented');
    break;

  case 'listall':
    console.log('todo listall: not yet implemented');
    break;

  case 'done':
    console.log('todo done: not yet implemented');
    break;

  case 'rm':
    console.log('todo rm: not yet implemented');
    break;

  case 'pri':
    console.log('todo pri: not yet implemented');
    break;

  case 'depri':
    console.log('todo depri: not yet implemented');
    break;

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
