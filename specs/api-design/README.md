# Astrograph API Design Specifications

This directory contains public-facing API contracts. Use these docs when adding
or changing MCP tools, CLI commands, or TypeScript exports.

## API Categories

### 1. MCP Tools

The stdio MCP server is the primary agent integration surface.

- [MCP Tools](./mcp-tools.md)

### 2. CLI Commands

The `astrograph cli` surface returns JSON for local scripts, smoke tests, and
agent runtimes that do not use MCP.

- [CLI API](./cli-api.md)

### 3. TypeScript Library

The package exports reusable functions and types for direct Node integration.

- [Library API](./library-api.md)

## Change Rules

- Public result-shape changes require a spec update and contract test update.
- New API behavior must identify its CLI, MCP, and library exposure.
- API specs should link to tests that prove the contract.
