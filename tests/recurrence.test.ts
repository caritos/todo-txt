import { describe, it, expect } from 'bun:test';
import { validateFrequency } from '../src/recurrence';

const origExit = process.exit;
const origError = console.error;
let lastExitCode: number | undefined;
let lastErrorMsg: string | undefined;

function setup() {
  lastExitCode = undefined;
  lastErrorMsg = undefined;
  (process as any).exit = (code: number) => {
    lastExitCode = code;
    throw new Error('exit:' + code);
  };
  console.error = (msg: string) => { lastErrorMsg = String(msg); };
}

function teardown() {
  (process as any).exit = origExit;
  console.error = origError;
}

function valid(text: string) {
  setup();
  try { validateFrequency(text); } finally { teardown(); }
  expect(lastExitCode).toBeUndefined();
}

function invalid(text: string, msgContains: string) {
  setup();
  try {
    expect(() => validateFrequency(text)).toThrow();
  } finally {
    teardown();
  }
  expect(lastExitCode).toBe(1);
  expect(lastErrorMsg).toContain(msgContains);
}

describe('validateFrequency', () => {
  it('no-ops when no frequency key', () => {
    valid('Buy groceries due:2026-05-10');
  });

  it('no-ops when auxiliary keys present without frequency:', () => {
    valid('Pay bills every:2 frequency-day:M');
  });

  it('accepts frequency:daily', () => {
    valid('Stand-up frequency:daily');
  });

  it('accepts frequency:weekly with frequency-day:', () => {
    valid('Standup frequency:weekly every:1 frequency-day:M,W,F');
  });

  it('accepts frequency:monthly with day number', () => {
    valid('Pay rent frequency:monthly frequency-month-day:6');
  });

  it('accepts frequency:monthly with positional', () => {
    valid('Review frequency:monthly frequency-month-day:first-monday');
  });

  it('accepts frequency:monthly with last positional', () => {
    valid('Review frequency:monthly frequency-month-day:last-friday');
  });

  it('accepts frequency:monthly with weekend-day positional', () => {
    valid('Rest frequency:monthly frequency-month-day:first-weekend-day');
  });

  it('accepts frequency:yearly with month', () => {
    valid('Birthday frequency:yearly frequency-month:May');
  });

  it('accepts frequency:yearly with month and positional', () => {
    valid('Holiday frequency:yearly frequency-month:May frequency-month-day:last-weekend-day');
  });

  it('accepts every: as positive integer', () => {
    valid('Standup frequency:weekly every:2 frequency-day:M');
  });

  it('rejects invalid frequency: value', () => {
    invalid('Task frequency:hourly', "invalid frequency 'hourly'");
  });

  it('rejects every: of zero', () => {
    invalid('Task frequency:daily every:0', "invalid every '0'");
  });

  it('rejects every: of negative', () => {
    invalid('Task frequency:daily every:-1', "invalid every '-1'");
  });

  it('rejects every: non-integer', () => {
    invalid('Task frequency:daily every:1.5', "invalid every '1.5'");
  });

  it('rejects invalid frequency-day: value', () => {
    invalid('Task frequency:weekly frequency-day:Mon', "invalid frequency-day value 'Mon'");
  });

  it('rejects frequency-month-day: number out of range', () => {
    invalid('Task frequency:monthly frequency-month-day:32', "invalid frequency-month-day '32'");
  });

  it('rejects frequency-month-day: bad positional position', () => {
    invalid('Task frequency:monthly frequency-month-day:sixth-monday', "invalid frequency-month-day 'sixth-monday'");
  });

  it('rejects frequency-month-day: bad positional day type', () => {
    invalid('Task frequency:monthly frequency-month-day:first-blah', "invalid frequency-month-day 'first-blah'");
  });

  it('rejects invalid frequency-month: value', () => {
    invalid('Task frequency:yearly frequency-month:Smarch', "invalid frequency-month 'Smarch'");
  });

  it('accepts frequency-month-day: day boundary values 1 and 31', () => {
    valid('Task frequency:monthly frequency-month-day:1');
    valid('Task frequency:monthly frequency-month-day:31');
  });

  it('accepts all valid frequency-day values', () => {
    valid('Task frequency:weekly frequency-day:M,T,W,Th,F,Sat,Sun');
  });

  it('accepts fifth positional', () => {
    valid('Task frequency:monthly frequency-month-day:fifth-monday');
  });

  it('accepts weekday and day positionals', () => {
    valid('Task frequency:monthly frequency-month-day:first-weekday');
    valid('Task frequency:monthly frequency-month-day:last-day');
  });
});
