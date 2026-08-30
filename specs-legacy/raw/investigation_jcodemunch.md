jCodeMunch init -- one-command setup

Detected MCP clients:
  [1] Claude Code
Configure which? [1-1/all/none]: 1
  Claude Code:  ran: claude mcp add jcodemunch uvx jcodemunch-mcp

Install CLAUDE.md policy? [global/project/skip]: project
  CLAUDE.md:  appended policy to /Users/macbook/personal/astrograph/CLAUDE.md

Install AGENTS.md (OpenCode/Codex policy)? [Y/n]: Y
  AGENTS.md:  already present in /Users/macbook/personal/astrograph/AGENTS.md

Install worktree hooks? [y/N]: y
  Hooks:  added WorktreeCreate, WorktreeRemove hooks to /Users/macbook/.claude/settings.json

Install enforcement hooks (intercept Read on large code files, auto-reindex after Edit/Write)? [Y/n]: y
  Enforcement:  added PreToolUse, PostToolUse, PreCompact, TaskCompleted, SubagentStart enforcement hooks to /Users/macbook/.claude/settings.json

Index current directory (/Users/macbook/personal/astrograph)? [Y/n]: y
  Index:  indexed /Users/macbook/personal/astrograph (? files, ? symbols)

Audit agent config files for token waste? [Y/n]: y

  Audit:
  scanned 2 file(s), 1,141 tokens total per turn
      842 tokens  project CLAUDE.md
      299 tokens  Claude Code settings (global)
  no issues found

Done. Restart your MCP client(s) to connect.