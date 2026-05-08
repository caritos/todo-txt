# todo-txt

> Your tasks are a file. Not a subscription, not a cloud account — a file.

A fast, format-faithful [todo.txt](http://todotxt.org/) CLI with a powerful `focus` view,
rich recurrence rules, and zero lock-in. Your data is always a plain `.txt` file you own,
sync however you like, and read without any app.

## In action

```
$ todo focus

   7  today              (A) Call the dentist
  12  today 14:00        Team standup +work
  23  Fri May 9          Review PR +backend
  31  Mon May 12         Pay rent
  45  Thu May 15         Mom's birthday  ↻ May 15 2027
  67  Fri May 16         Book club  ↻ Fri Jun 20
```

Overdue tasks appear in red. Priority tasks lead the line. Recurring items show their cadence.

## Install

Requires [Bun](https://bun.sh).

```bash
git clone https://github.com/caritos/todo-txt
cd todo-txt
bun install
ln -s "$PWD/src/index.ts" /usr/local/bin/todo
```

## Quick start

```bash
todo add "Fix login bug +backend @work"
todo add "(A) Call dentist due:2026-05-09"
todo focus                    # your next 2 weeks at a glance
todo done 7                   # mark task 7 complete
todo list +backend            # filter by project
todo search "dentist"
```

## Commands

| Command | Description |
|---|---|
| `add <text>` | Add a task (creation date stamped automatically) |
| `event <text>` | Add a calendar event (tagged `type:event`) |
| `focus` | Tasks and events in the next 14 days |
| `list [filters]` | Open tasks, sorted by priority. Filter by `+project`, `@context`, `(A)`, keyword |
| `listall [filters]` | All tasks including completed |
| `search <term>` | Full-text search (multiple terms are ANDed) |
| `done <n>` | Mark task complete (accepts multiple numbers) |
| `edit <n> <text>` | Replace task text (preserves creation date) |
| `rm <n>` | Delete a task permanently |
| `pri <n> <A-Z>` | Set priority |
| `depri <n>` | Remove priority |
| `import <file.ics>` | Import events from an iCalendar file |
| `reminders [list]` | Import from Apple Reminders; pass a list name to filter (macOS only) |
| `report` | Stats: counts, by project/context, completed today/week |

Use `--file <path>` on any command to target a specific todo.txt file (overrides `TODO_FILE` env).

## Scheduling extensions

Add these `key:value` pairs to any task or event:

| Extension | Description | Example |
|---|---|---|
| `start:<date>` | Start date — `YYYY-MM-DD` or `YYYY-MM-DDThh:mm` | `start:2026-05-10T09:00` |
| `end:<date>` | End date/time | `end:2026-05-10T09:30` |
| `due:<date>` | Due date (shown in focus when approaching or overdue) | `due:2026-05-15` |
| `frequency:<freq>` | Recurrence: `daily` `weekly` `monthly` `yearly` | `frequency:weekly` |
| `every:<n>` | Repeat every N weeks with frequency:weekly (e.g. bi-weekly) | `every:2` |
| `frequency-day:<days>` | Days of week: `M,T,W,Th,F,Sat,Sun` | `frequency-day:M,W,F` |
| `frequency-month-day:<val>` | Day of month: `1–31` or `first-monday`, `last-weekend-day`, … | `frequency-month-day:first-tuesday` |
| `frequency-month:<months>` | Months for yearly recurrence | `frequency-month:Jan,Jun` |

### Examples

```bash
todo event "Standup start:2026-05-10T09:00 frequency:weekly frequency-day:M,W,F"
todo add "Pay rent frequency:monthly frequency-month-day:1"
todo event "Book club start:2026-05-06 frequency:monthly frequency-month-day:first-tuesday"
todo edit 45 "Mom's birthday start:1975-05-15 frequency:yearly type:anniversary"
```

## Format

Follows the [todo.txt format](https://github.com/todotxt/todo.txt) exactly. Tasks are plain text lines:

```
(A) 2026-05-08 Call the dentist due:2026-05-09 +health @personal
x 2026-05-07 2026-05-06 Renew passport +admin
```

Your file works with any todo.txt-compatible app, editor, or script.
