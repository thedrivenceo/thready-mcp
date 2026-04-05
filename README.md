# Threadflow MCP Server

MCP server for [Threadflow](https://threadly-planner.vercel.app), the Threads content scheduler. Manage your content, drafts, scheduling, and analytics from any MCP-compatible AI tool (Claude Desktop, Cursor, etc.).

## Tools

| Tool | Description |
|------|-------------|
| `create_draft` | Create a draft post in the Content Bank |
| `create_thread` | Create a multi-post thread (threadstorm) |
| `schedule_post` | Schedule a post for a specific date/time |
| `list_drafts` | List all drafts in the Content Bank |
| `list_scheduled` | List all scheduled posts |
| `list_categories` | View content pillars and types |
| `repurpose_content` | AI-generate posts from text or a URL |
| `get_analytics` | Get performance summary |
| `get_follower_history` | View follower count over time |
| `delete_draft` | Delete a draft thread |

## Setup

### 1. Install

```bash
npm install -g @thedrivenceo/threadflow-mcp
```

### 2. Get your API key

Go to your Supabase project dashboard > Settings > API and copy the `anon` public key.

### 3. Configure Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "threadflow": {
      "command": "threadflow-mcp",
      "env": {
        "THREADFLOW_API_KEY": "your-supabase-anon-key",
        "THREADFLOW_WEBHOOK_SECRET": "your-webhook-secret"
      }
    }
  }
}
```

### 4. Use it

Ask Claude to:
- "Create a draft post about morning routines"
- "Schedule a thread about productivity for next Monday at 9am"
- "Show me my drafts"
- "Repurpose this article: https://example.com/blog-post"
- "How are my followers trending?"

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `THREADFLOW_API_KEY` | Yes | Supabase anon key for API access |
| `THREADFLOW_WEBHOOK_SECRET` | No | Webhook secret for write operations |
| `THREADFLOW_SUPABASE_URL` | No | Custom Supabase URL (defaults to Threadflow hosted) |

## Development

```bash
git clone https://github.com/thedrivenceo/threadflow-mcp.git
cd threadflow-mcp
npm install
npm run dev
```
