import { describe, test, expect } from 'bun:test';
import { applyReport } from '../../commands/report';
import { parseLine } from '../../parser';

describe('applyReport', () => {
  test('counts open and done tasks', () => {
    const tasks = [
      parseLine('open task', 1),
      parseLine('x 2026-05-23 done task', 2),
    ];
    const result = applyReport(tasks, '2026-05-23');
    expect(result.open).toBe(1);
    expect(result.done).toBe(1);
    expect(result.completedToday).toBe(1);
  });

  test('counts overdue tasks', () => {
    const tasks = [parseLine('overdue task due:2026-05-01', 1)];
    const result = applyReport(tasks, '2026-05-23');
    expect(result.overdue).toBe(1);
  });

  test('groups by project', () => {
    const tasks = [parseLine('task +backend', 1), parseLine('task +backend', 2)];
    const result = applyReport(tasks, '2026-05-23');
    expect(result.byProject.get('+backend')?.open).toBe(2);
  });
});
