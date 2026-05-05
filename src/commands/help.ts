export function helpCommand(): void {
  const help = `Usage: todo <command> [options]

Commands:
  add <text>          Add a new task (creation date stamped automatically)
  list [filters]      List open tasks. Filters: +project @context (A) keyword
  listall [filters]   List all tasks including completed
  done <n>            Mark task #n complete
  rm <n>              Delete task #n permanently
  pri <n> <A-Z>       Set priority on task #n
  depri <n>           Remove priority from task #n
  search <term>       Full-text search across all tasks
  report              Stats: counts, by project/context, completed today/week

Options:
  --file <path>       Use a specific todo.txt file (overrides TODO_FILE env)

Examples:
  todo add "Fix login bug +backend @work due:2026-05-10"
  todo add "(A) Urgent task"
  todo list +backend
  todo list @work (B)
  todo done 3
  todo pri 5 A`;

  console.log(help);
}
