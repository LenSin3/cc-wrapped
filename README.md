# cc-wrapped

Your year in code, wrapped. Visualize your git history and Claude Code usage in a beautiful, shareable format.

![cc-wrapped](https://img.shields.io/npm/v/cc-wrapped?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

## Features

- **Git Stats**: Commits, lines of code, activity by day/hour, most edited files
- **Claude Code Stats**: Tokens used, messages sent, tool calls, session data
- **Beautiful HTML Output**: Dark theme, responsive design, ready for screenshots
- **Flexible Modes**: Full wrapped, tokens-only, or git-only

## Installation

```bash
# Run directly with npx (no install needed)
npx cc-wrapped

# Or install globally
npm install -g cc-wrapped
```

## Usage

```bash
# Full wrapped (git + Claude Code tokens)
cc-wrapped

# Claude Code tokens only
cc-wrapped --tokens

# Git stats only
cc-wrapped --git

# Specify year
cc-wrapped --year 2024

# Custom output path
cc-wrapped --output my-wrapped.html

# Don't open browser automatically
cc-wrapped --no-open
```

## Options

| Flag | Description |
|------|-------------|
| `-t, --tokens` | Show Claude Code token usage only |
| `-g, --git` | Show git stats only (no Claude Code tokens) |
| `-y, --year <year>` | Year to analyze (default: current year) |
| `-o, --output <path>` | Output file path (default: ./wrapped.html) |
| `--no-open` | Don't open the generated HTML in browser |

## Requirements

- **Node.js 18+**
- **Git** (for git stats)
- **Claude Code** (optional, for token stats - reads from `~/.claude/stats-cache.json`)

## What It Looks Like

The generated HTML includes:

- **Big Numbers**: Total tokens, messages, commits, lines of code
- **Monthly Activity**: Commit distribution by month
- **Day of Week**: Your most productive day
- **Productive Hours**: When you code the most
- **Token Breakdown**: Input/output/cache token distribution
- **Achievements**: Unlocked badges based on your activity

## Sharing

1. Run `cc-wrapped` in your project
2. Open the generated HTML
3. Take a screenshot or save as PDF (`Cmd+P` → Save as PDF)
4. Share on Twitter/LinkedIn!

## License

MIT

## Author

Built with Claude Code.
