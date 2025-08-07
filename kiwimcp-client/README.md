# Kiwi MCP Client

Access Kiwi News directly from Claude Code using the Model Context Protocol (MCP).

## Setup

1. Save this config as `kiwi.json`:

```json
{
  "mcpServers": {
    "kiwi": {
      "command": "npx",
      "args": ["kiwimcp-client"],
      "env": {
        "KIWI_API_URL": "https://news.kiwistand.com"
      }
    }
  }
}
```

2. Run Claude:
```bash
claude --mcp-config kiwi.json
```

## Examples

**Content & Feeds:**
- "What's hot on Kiwi News today?"
- "Search for articles about Ethereum on Kiwi"
- "Show me the newest posts on Kiwi"
- "Get the best Kiwi posts from this week"

**Stories & Comments:**
- "Get the comments for story 0x68487fbf..."
- "Show me the details of this story: 68487fbf..."

**Users & Karma:**
- "Who are the top contributors on Kiwi News?"
- "Check karma for address 0x1234..."
- "Get the profile for vitalik.eth on Kiwi"

## Available Tools

### search-content
Search for content on Kiwi News.
- `query`: Search terms
- `sort`: "new" or "top" (default: "new")
- `limit`: Results to return, 1-50 (default: 10)

### get-feed
Browse hot, new, or best content feeds.
- `name`: "hot", "new", or "best"
- `page`: Page number (default: 0)
- `limit`: Stories per page, 1-50 (default: 10)
- `period`: For "best" feed - "day", "week", "month" (default: "week")

### get-story
Get full story details including comments.
- `index`: Story ID (hex string, with or without 0x prefix)

### get-user-profile  
Get profile information for a user.
- `address`: Ethereum address

### get-top-karma-holders
View the karma leaderboard.
- `limit`: Number of results, 1-100 (default: 10)
- `offset`: Pagination offset (default: 0)

### get-user-karma
Check karma score for a specific user.
- `address`: Ethereum address

## Development

For local development, use `http://localhost:4000`:

```json
{
  "mcpServers": {
    "kiwi": {
      "command": "npx",
      "args": ["kiwimcp-client"],
      "env": {
        "KIWI_API_URL": "http://localhost:4000"
      }
    }
  }
}
```

## Troubleshooting

**Token limit errors:** Responses are automatically limited to prevent this. Default is 10 items, max is 50.

**Story not found:** Story IDs need to be hex strings. The tool automatically adds "0x" prefix if missing.

## Contributing

Issues and PRs welcome at [github.com/attestate/kiwistand](https://github.com/attestate/kiwistand)