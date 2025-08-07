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
      content: `When using Kiwi News MCP tools, follow these guidelines:

1. **Karma Rankings**: The karma system tracks user contributions to Kiwi News
   - Higher karma indicates more valuable contributions (submissions and upvotes)
   - Rankings update in real-time as users interact with the platform
   
2. **User Information**: When displaying karma holders:
   - Always show their Ethereum address
   - Include ENS name if available for better readability
   - Display their karma score and rank
   
3. **Data Presentation**: When presenting Kiwi karma data:
   - Show rank numbers for context
   - Highlight top contributors (e.g., top 3 with medals)
   - Include total number of ranked users when relevant
   
4. **Performance**: For better performance:
   - Use reasonable limits (default 10, max 100)
   - Use offset for pagination through large lists
   - Data is cached for 5 minutes to reduce load`
    }]
  })
);

// Helper function to call Kiwi API
async function callKiwiAPI(endpoint, params = {}) {
  const url = new URL(`${API_URL}${endpoint}`);
  
  // Add query parameters
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null) {
      url.searchParams.append(key, params[key]);
    }
  });
  
  try {
    console.error(`[Kiwi MCP] Calling API: ${url.toString()}`);
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'kiwimcp-client/1.0.0'
      }
    });
    
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
      const data = await callKiwiAPI('/api/v1/karma/top', { limit, offset });
      
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

async function main() {
  console.error('[Kiwi MCP] Starting MCP server...');
  console.error('[Kiwi MCP] Connecting to API:', API_URL);
  
  // Test connection to API
  try {
    const response = await fetch(`${API_URL}/api/v1/karma/top?limit=1`);
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