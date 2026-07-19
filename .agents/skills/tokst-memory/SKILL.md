---
name: tokst-memory
description: TokST long-term memory — search, store, and recall context across sessions. Use when the user needs to persist information between sessions, remember decisions, store facts, search past context, or set up long-term memory for a project.
---

# TokST Memory

Use `tokst` CLI to manage long-term memory for this project.
Memories persist in the cloud and are shared across all agents and sessions.

## Setup (run once per machine)

```bash
# 1. Install bun runtime
curl -fsSL https://bun.sh/install | bash && source ~/.bashrc

# 2. Install TokST CLI
npm install -g @tokst/cli

# 3. Login
tokst login --key YOUR_API_KEY

# 4. Verify
tokst status
```

> **Note:** On Windows, use `powershell -c "irm bun.sh/install.ps1 | iex"` instead of the curl command, and `npm install -g bun` as a fallback if needed.

## Commands

```bash
# Load context at session start
tokst context

# Store a memory (type: fact|decision|preference|task|architecture|note)
tokst remember "Decided to use PostgreSQL for persistence" --type decision
tokst remember "API endpoint is /api/v2/users" --type fact
tokst remember "User prefers dark theme" --type preference

# Store a memory with tags (better organization)
tokst remember "用户模块已完成" --type fact --tags 模块,用户,完成

# Store a memory with file attachment
tokst remember "项目架构图" --type architecture --file ./docs/architecture.png

# Search memories (hybrid: keyword + semantic)
tokst search "database choice"
tokst search "API design"
tokst search "keyword" --tags 模块     # 按标签筛选
tokst search "query" --type decision   # 按类型筛选

# List all memories
tokst memory list

# Update / append to existing memory
tokst memory update <memory-id> --content "新的内容"
tokst memory append <memory-id> --content "追加的内容"

# Attach files to an existing memory
tokst memory attach <memory-id> --file ./path/to/file.pdf

# Archive / restore / delete memories
tokst memory archive <memory-id>
tokst memory restore <memory-id>
tokst memory delete <memory-id>   # 谨慎使用

# Manage atlases (knowledge bases)
tokst atlas init --name "$(basename $PWD)"
tokst atlas profile --keywords react,typescript  # set keywords for auto-routing
tokst atlas list
tokst atlas rename --atlas-id <id> --name <new-name>
tokst atlas delete --atlas-id <id>

# Workspace management
tokst workspace list
tokst workspace create --name "team-project" --type team
tokst workspace switch <workspace-id>
```

## When to use

1. **Session start**: Run `tokst context` to load relevant memories
2. **After decisions**: Store with `tokst remember "..." --type decision`
3. **Before asking questions**: Search first `tokst search "topic"`
4. **Important facts**: Store with `tokst remember "..." --type fact`

## MCP Server (optional, for Claude Desktop / Cursor / Codex)

If your agent supports MCP, add this to the MCP config:

```json
{
  "mcpServers": {
    "tokst": {
      "command": "npx",
      "args": [
        "-y",
        "@tokst/mcp-server"
      ]
    }
  }
}
```

Then run `tokst login --key YOUR_API_KEY` on the same machine.
