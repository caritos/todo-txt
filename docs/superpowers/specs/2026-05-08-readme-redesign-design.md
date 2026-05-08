# README Redesign — Design Spec

**Date:** 2026-05-08
**Audience:** todo.txt fans — people who value plain text, portability, and format loyalty

## Goal

Replace the current near-empty README with a philosophy-first story that earns
attention by speaking to todo.txt community values before showcasing features.

## Approach

Option C: Philosophy-first. Open with the "why" (plain text, portable, no lock-in),
demonstrate the tool in action, then cover install, commands, and scheduling reference.

## Structure

### 1. Hero

Tagline: "Your tasks are a file. Not a subscription, not a cloud account — a file."

One-line description: fast, format-faithful todo.txt CLI with a powerful `focus` view,
rich recurrence rules, and zero lock-in.

### 2. In action (focus demo)

ASCII demo of `todo focus` output showing the 3-column layout:
line number | when (today/day+date) | clean task title

Highlights: priority prefix, overdue in red, recurring cadence label.

### 3. Install

From source only (Homebrew tap deferred until tap is published).

Requirements: Bun. Steps: clone → bun install → symlink to /usr/local/bin/todo.

### 4. Quick start

6 example commands covering add, focus, done, list, search.

### 5. Commands table

All commands with descriptions. Covers: add, event, focus, list, listall, search,
done, edit, rm, pri, depri, import, reminders, report.

### 6. Scheduling extensions table

All key:value extensions with description and example.
Followed by 4 real-world usage examples (standup, rent, book club, anniversary).

## Out of scope

- Homebrew tap setup (separate task, deferred)
- Screenshots or GIF demos
- Badges (CI, version, license)
- Contributing guide
