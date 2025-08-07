# Kiwi MCP Client

MCP (Model Context Protocol) client for accessing Kiwi News data.

## Setup

1. Install the package dependencies:
```bash
cd kiwimcp-client
npm install
```

2. Create a config file `kiwi.json`:
```json
{
  "mcpServers": {
    "kiwi": {
      "command": "node",
      "args": ["/path/to/kiwimcp-client/index.js"],
      "env": {
        "KIWI_API_URL": "https://news.kiwistand.com"
      }
    }
  }
}
```

Or use npx directly:
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

3. Run Claude with the MCP config:
```bash
claude --mcp-config kiwi.json
```

## Available Tools

### get-top-karma-holders
Get the top karma holders on Kiwi News.

**Parameters:**
- `limit` (optional): Number of results (1-100, default: 10)
- `offset` (optional): Pagination offset (default: 0)

**Example prompts:**
- "Get the top 10 Kiwi karma holders"
- "Show me the top 25 contributors on Kiwi News"
- "List Kiwi News karma rankings starting from position 50"

### get-user-karma
Get the karma score for a specific Ethereum address.

**Parameters:**
- `address`: Ethereum address (0x...)

**Example prompts:**
- "Check karma for address 0x1234..."
- "What's the Kiwi News karma score for vitalik.eth"

## API Endpoint

The client connects to the Kiwi News API endpoint:
- `GET /api/v1/karma/top?limit=10&offset=0`

This endpoint returns:
- Total number of ranked users
- List of top karma holders with:
  - Rank
  - Ethereum address
  - Display name (ENS if available)
  - Karma score
  - ENS avatar (if available)

## Environment Variables

- `KIWI_API_URL`: Base URL for Kiwi News API (default: https://news.kiwistand.com)

## Development

To test locally:
```bash
node index.js
```

The MCP server communicates via stdio, so it needs to be run through Claude or another MCP-compatible client.