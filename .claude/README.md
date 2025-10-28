# Zeff's Custom Claude Code Setup

This is your personalized Claude Code configuration optimized for your tech stack.

## Tech Stack

- **Backend**: Express + raw PostgreSQL (pg driver) + TypeScript
- **Frontend**: Next.js 15 + React 19 + Zustand
- **Database**: PostgreSQL 15 (Docker)
- **Blockchain**: Thirdweb v5

## Included Features

### Slash Commands (12 commands)

**Core:**
- `/new-task` - Analyze task complexity and create implementation plan

**Code Quality (6 commands):**
- `/code-optimize` - Performance and efficiency optimization
- `/code-cleanup` - Refactor and improve code quality
- `/code-explain` - Explain code functionality
- `/lint` - Run linting and fix issues
- `/docs-generate` - Generate documentation
- `/feature-plan` - Plan feature implementation

**API Development (3 commands):**
- `/api-new` - Create new Next.js API route
- `/api-test` - Test API endpoints
- `/api-protect` - Add auth and security to APIs

**UI Development (2 commands):**
- `/component-new` - Create new React component
- `/page-new` - Create new Next.js page

### Specialized Agents (12 agents)

- `blockchain-analyst` - Smart contract security, tokenomics, gas optimization ⭐ NEW
- `tech-stack-researcher` - Technology choice guidance
- `backend-architect` - Backend system design
- `frontend-architect` - UI/UX design
- `system-architect` - Scalable architecture
- `security-engineer` - Security and compliance
- `performance-engineer` - Performance optimization
- `refactoring-expert` - Code improvement
- `requirements-analyst` - Requirements discovery
- `learning-guide` - Programming education
- `deep-research-agent` - Comprehensive research
- `technical-writer` - Documentation

## Usage

Run this command in any project directory:

```bash
claude-setup
```

This copies the entire `.claude` folder to your current project.

## Blockchain Analyst Agent Usage

Perfect for your RepairCoin project! Use the blockchain analyst for:

```bash
# In Claude Code, invoke the agent:
"Can you analyze the RCN token contract security?"
"Review our token minting implementation for vulnerabilities"
"Optimize gas costs for the redemption function"
"Analyze our dual-token tokenomics"
"Review Thirdweb SDK integration best practices"
```

**What it analyzes:**
- ✅ Smart contract security (RCN/RCG tokens)
- ✅ Gas optimization opportunities
- ✅ Tokenomics and economic models
- ✅ Thirdweb v5 integration patterns
- ✅ Base Sepolia network best practices
- ✅ Treasury and wallet security

## Customization

**Location**: `~/.claude/zeff-custom-setup/.claude`

**Add a new command:**
```bash
code ~/.claude/zeff-custom-setup/.claude/commands/my-command.md
```

**Edit existing command:**
```bash
code ~/.claude/zeff-custom-setup/.claude/commands/api/api-new.md
```

**Remove a command:**
```bash
rm ~/.claude/zeff-custom-setup/.claude/commands/misc/code-explain.md
```

**Edit an agent:**
```bash
code ~/.claude/zeff-custom-setup/.claude/agents/blockchain-analyst.md
```

## What's Removed

- ❌ Supabase commands (not compatible with raw PostgreSQL)
- ❌ Supabase MCP server (not needed)

## MCP Servers

Configured in the original plugin at:
`~/.claude/plugins/marketplaces/edmunds-claude-code/.claude-plugin/plugin.json`

- ✅ `context7` - Up-to-date library documentation
- ✅ `playwright` - Browser automation and testing

---

Last updated: 2025-10-28
