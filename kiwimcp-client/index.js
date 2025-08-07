#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fetch from 'node-fetch';

// Configuration
const API_URL = process.env.KIWI_API_URL || 'https://news.kiwistand.com';

const server = new McpServer({
  name: 'kiwimcp',
  version: '1.0.0'
});

// Register prompts for usage guidelines
server.prompt(
  'kiwi-guidelines',
  'Guidelines for using Kiwi News MCP tools effectively',
  async () => ({
    messages: [{
      role: 'system',
      content: `When using Kiwi News MCP tools:

1. **Content Discovery**:
   - Use search-content for keyword searches across all posts
   - Use get-feed to browse hot/new/best content
   - Hot feed shows trending content, new shows recent, best shows top-rated
   - Always use limits (default 10, max 50) to prevent token overflow

2. **Story Details**:
   - Use get-story to fetch full story with comments
   - Story indices are hex strings - tool auto-adds 0x prefix if missing
   - Comments include author addresses and timestamps

3. **User & Karma System**:
   - Karma tracks user contributions (submissions and upvotes)
   - Higher karma = more valuable contributions
   - Use get-user-profile for ENS names and avatars
   - Use get-top-karma-holders for leaderboard
   - Display ENS names when available for readability

4. **Best Practices**:
   - Default to 10 items per request
   - Use pagination (page parameter) for browsing
   - For "best" feed, specify period (day/week/month)
   - When showing addresses, include ENS if available
   
5. **Response Handling**:
   - All responses follow {status, data} format
   - Check data.stories for feeds, data.data for search
   - Handle empty results gracefully`
    }]
  })
);

// Helper function to call Kiwi API
async function callKiwiAPI(endpoint, params = {}, options = {}) {
  const { method = 'GET', body = null } = options;
  const url = new URL(`${API_URL}${endpoint}`);
  
  // Add query parameters for GET requests
  if (method === 'GET') {
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.append(key, params[key]);
      }
    });
  }
  
  try {
    console.error(`[Kiwi MCP] Calling API: ${method} ${url.toString()}`);
    
    const fetchOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'kiwimcp-client/1.0.0'
      }
    };
    
    if (body) {
      fetchOptions.body = JSON.stringify(body || params);
    }
    
    const response = await fetch(url.toString(), fetchOptions);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json();
    
    // Check if response follows the standard Kiwi API format
    if (data.status === 'success' && data.data) {
      return data.data;
    }
    
    // Fallback for non-standard responses
    return data;
  } catch (error) {
    console.error(`[Kiwi MCP] Error calling ${endpoint}:`, error.message);
    throw error;
  }
}

// Register tool to get top karma holders
server.tool(
  'get-top-karma-holders',
  'Get the top karma holders on Kiwi News. Returns users ranked by their karma (contribution) scores.',
  {
    limit: z.number().min(1).max(100).optional().describe('Number of top holders to return (1-100, default: 10)'),
    offset: z.number().min(0).optional().describe('Offset for pagination (default: 0)')
  },
  async ({ limit = 10, offset = 0 }) => {
    console.error('[Kiwi MCP] Fetching top karma holders');
    
    try {
      const data = await callKiwiAPI('/api/v1/karma/top');
      
      // Format the response for better readability
      const formattedResponse = {
        summary: `Top ${data.holders.length} karma holders (showing ${offset + 1}-${offset + data.holders.length} of ${data.total})`,
        totalUsers: data.total,
        limit: data.limit,
        offset: data.offset,
        topHolders: data.holders.map(holder => ({
          rank: holder.rank,
          address: holder.identity,
          name: holder.displayName,
          karma: holder.karma,
          ensName: holder.ensData?.name || null,
          avatar: holder.ensData?.avatar || null
        }))
      };
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(formattedResponse, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error fetching karma holders: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// Register tool to get specific user's karma
server.tool(
  'get-user-karma',
  'Get the karma score for a specific Ethereum address on Kiwi News',
  {
    address: z.string().describe('Ethereum address (0x...)')
  },
  async ({ address }) => {
    console.error(`[Kiwi MCP] Fetching karma for address: ${address}`);
    
    try {
      const data = await callKiwiAPI(`/api/v1/karma/${address}`);
      
      // Get user's rank by fetching top holders
      let rank = null;
      try {
        const allHolders = await callKiwiAPI('/api/v1/karma/top', { limit: 1000, offset: 0 });
        const userIndex = allHolders.holders.findIndex(h => 
          h.identity.toLowerCase() === address.toLowerCase()
        );
        if (userIndex !== -1) {
          rank = userIndex + 1;
        }
      } catch (err) {
        // Silently ignore rank lookup errors
      }
      
      const formattedResponse = {
        address: data.address,
        karma: data.karma,
        rank: rank || 'Unranked'
      };
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(formattedResponse, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error fetching user karma: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// Register tool to search content
server.tool(
  'search-content',
  'Search for content on Kiwi News',
  {
    query: z.string().describe('Search query'),
    sort: z.enum(['new', 'top']).optional().describe('Sort order (default: new)'),
    limit: z.number().min(1).max(50).optional().describe('Number of results to return (1-50, default: 10)')
  },
  async ({ query, sort = 'new', limit = 10 }) => {
    console.error(`[Kiwi MCP] Searching for: ${query} with limit ${limit}`);
    
    try {
      const data = await callKiwiAPI('/api/v1/search', {}, { 
        method: 'POST', 
        body: { query, sort, limit } 
      });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(data, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error searching content: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// Register tool to get feeds
server.tool(
  'get-feed',
  'Get content from a specific feed (hot, new, best)',
  {
    name: z.enum(['hot', 'new', 'best']).describe('Feed name'),
    page: z.number().min(0).optional().describe('Page number for pagination (default: 0)'),
    limit: z.number().min(1).max(50).optional().describe('Number of stories to return (1-50, default: 10)'),
    period: z.string().optional().describe('Time period for best feed only (e.g., "day", "week", "month")')
  },
  async ({ name, page = 0, limit = 10, period }) => {
    console.error(`[Kiwi MCP] Fetching ${name} feed with limit ${limit}`);
    
    try {
      const params = { page, limit };
      if (period && name === 'best') params.period = period;
      
      const data = await callKiwiAPI(`/api/v1/feeds/${name}`, params);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(data, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error fetching feed: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// Register tool to get story details
server.tool(
  'get-story',
  'Get detailed information about a specific story including comments',
  {
    index: z.string().describe('Story index/ID (hex string, with or without 0x prefix)')
  },
  async ({ index }) => {
    // Ensure the index has 0x prefix
    if (!index.startsWith('0x')) {
      index = '0x' + index;
    }
    
    console.error(`[Kiwi MCP] Fetching story: ${index}`);
    
    try {
      const data = await callKiwiAPI('/api/v1/stories', { index });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(data, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error fetching story: ${error.message}`
        }],
        isError: true
      };
    }
  }
);


// Register tool to get user profile
server.tool(
  'get-user-profile',
  'Get profile information for a user by Ethereum address',
  {
    address: z.string().describe('Ethereum address (0x...)')
  },
  async ({ address }) => {
    console.error(`[Kiwi MCP] Fetching profile for: ${address}`);
    
    try {
      const data = await callKiwiAPI(`/api/v1/profile/${address}`);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(data, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error fetching profile: ${error.message}`
        }],
        isError: true
      };
    }
  }
);


async function main() {
  console.error('[Kiwi MCP] Starting MCP server...');
  console.error('[Kiwi MCP] Connecting to API:', API_URL);
  
  // Test connection to API
  try {
    const response = await fetch(`${API_URL}/api/v1/karma/top`);
    if (response.ok) {
      console.error('[Kiwi MCP] Successfully connected to Kiwi News API');
    } else {
      console.error('[Kiwi MCP] Warning: API health check returned:', response.status);
    }
  } catch (error) {
    console.error('[Kiwi MCP] Warning: Could not reach API server:', error.message);
    console.error('[Kiwi MCP] Continuing anyway - API calls will fail if server is down');
  }
  
  const transport = new StdioServerTransport();
  
  transport.onclose = () => {
    console.error('[Kiwi MCP] Transport closed');
  };
  
  transport.onerror = (error) => {
    console.error('[Kiwi MCP] Transport error:', error);
  };
  
  await server.connect(transport);
  console.error('[Kiwi MCP] MCP server connected and running');
}

main().catch(error => {
  console.error('[Kiwi MCP] Fatal error:', error);
  process.exit(1);
});