import test from "ava";
import { spawn } from "child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function startMCPServer() {
  const server = spawn("node", ["kiwimcp-client/index.js"], {
    env: {
      ...process.env,
      KIWI_API_URL: "https://news.kiwistand.com"
    }
  });
  
  const transport = new StdioClientTransport({
    command: "node",
    args: ["kiwimcp-client/index.js"],
    env: {
      ...process.env,
      KIWI_API_URL: "https://news.kiwistand.com"
    }
  });
  
  const client = new Client({
    name: "test-client",
    version: "1.0.0"
  }, {
    capabilities: {}
  });
  
  await client.connect(transport);
  
  return { client, server, transport };
}

async function stopMCPServer({ client, server, transport }) {
  await client.close();
  server.kill();
}

test("MCP server lists all tools", async (t) => {
  const { client, server, transport } = await startMCPServer();
  
  try {
    const tools = await client.listTools();
    
    const expectedTools = [
      "get-top-karma-holders",
      "get-user-karma",
      "search-content",
      "get-feed",
      "get-story",
      "get-url-metadata",
      "parse-url",
      "get-user-profile",
      "get-user-activity",
      "get-kiwi-price"
    ];
    
    t.is(tools.tools.length, expectedTools.length);
    
    for (const toolName of expectedTools) {
      const tool = tools.tools.find(t => t.name === toolName);
      t.truthy(tool, `Tool ${toolName} should exist`);
      t.truthy(tool.description, `Tool ${toolName} should have description`);
      t.truthy(tool.inputSchema, `Tool ${toolName} should have input schema`);
    }
  } finally {
    await stopMCPServer({ client, server, transport });
  }
});

test("MCP get-top-karma-holders tool works", async (t) => {
  const { client, server, transport } = await startMCPServer();
  
  try {
    const result = await client.callTool({
      name: "get-top-karma-holders",
      arguments: {
        limit: 5,
        offset: 0
      }
    });
    
    t.truthy(result);
    t.true(Array.isArray(result.content));
    t.true(result.content.length > 0);
    
    const content = JSON.parse(result.content[0].text);
    t.truthy(content.summary);
    t.truthy(content.totalUsers);
    t.true(Array.isArray(content.topHolders));
    
    if (content.topHolders.length > 0) {
      const holder = content.topHolders[0];
      t.truthy(holder.address);
      t.truthy(holder.karma !== undefined);
      t.truthy(holder.rank !== undefined);
    }
  } finally {
    await stopMCPServer({ client, server, transport });
  }
});

test("MCP get-user-karma tool works", async (t) => {
  const { client, server, transport } = await startMCPServer();
  
  try {
    const result = await client.callTool({
      name: "get-user-karma",
      arguments: {
        address: "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176"
      }
    });
    
    t.truthy(result);
    t.true(Array.isArray(result.content));
    
    const content = JSON.parse(result.content[0].text);
    t.truthy(content.address);
    t.truthy(content.karma !== undefined);
  } finally {
    await stopMCPServer({ client, server, transport });
  }
});

test("MCP search-content tool works", async (t) => {
  const { client, server, transport } = await startMCPServer();
  
  try {
    const result = await client.callTool({
      name: "search-content",
      arguments: {
        query: "ethereum",
        sort: "new"
      }
    });
    
    t.truthy(result);
    t.true(Array.isArray(result.content));
    
    const content = JSON.parse(result.content[0].text);
    t.truthy(content);
  } finally {
    await stopMCPServer({ client, server, transport });
  }
});

test("MCP get-feed tool works", async (t) => {
  const { client, server, transport } = await startMCPServer();
  
  try {
    const result = await client.callTool({
      name: "get-feed",
      arguments: {
        name: "hot",
        page: 0
      }
    });
    
    t.truthy(result);
    t.true(Array.isArray(result.content));
    
    const content = JSON.parse(result.content[0].text);
    t.truthy(content);
  } finally {
    await stopMCPServer({ client, server, transport });
  }
});

test("MCP get-story tool works", async (t) => {
  const { client, server, transport } = await startMCPServer();
  
  try {
    // First get a story from feed
    const feedResult = await client.callTool({
      name: "get-feed",
      arguments: {
        name: "hot",
        page: 0
      }
    });
    
    const feedContent = JSON.parse(feedResult.content[0].text);
    const stories = feedContent.stories || feedContent;
    
    if (stories && stories.length > 0 && stories[0].index) {
      const result = await client.callTool({
        name: "get-story",
        arguments: {
          index: stories[0].index
        }
      });
      
      t.truthy(result);
      t.true(Array.isArray(result.content));
      
      const content = JSON.parse(result.content[0].text);
      t.truthy(content);
    } else {
      t.pass("No stories available to test");
    }
  } finally {
    await stopMCPServer({ client, server, transport });
  }
});

test("MCP get-url-metadata tool works", async (t) => {
  const { client, server, transport } = await startMCPServer();
  
  try {
    const result = await client.callTool({
      name: "get-url-metadata",
      arguments: {
        url: "https://ethereum.org",
        generateTitle: false
      }
    });
    
    t.truthy(result);
    t.true(Array.isArray(result.content));
    
    const content = JSON.parse(result.content[0].text);
    t.truthy(content);
  } finally {
    await stopMCPServer({ client, server, transport });
  }
});

test("MCP parse-url tool works", async (t) => {
  const { client, server, transport } = await startMCPServer();
  
  try {
    const result = await client.callTool({
      name: "parse-url",
      arguments: {
        url: "https://twitter.com/VitalikButerin/status/1737133819626913857"
      }
    });
    
    t.truthy(result);
    t.true(Array.isArray(result.content));
    
    const content = JSON.parse(result.content[0].text);
    t.truthy(content);
  } finally {
    await stopMCPServer({ client, server, transport });
  }
});

test("MCP get-user-profile tool works", async (t) => {
  const { client, server, transport } = await startMCPServer();
  
  try {
    const result = await client.callTool({
      name: "get-user-profile",
      arguments: {
        address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
      }
    });
    
    t.truthy(result);
    t.true(Array.isArray(result.content));
    
    const content = JSON.parse(result.content[0].text);
    t.truthy(content);
  } finally {
    await stopMCPServer({ client, server, transport });
  }
});

test("MCP get-user-activity tool works", async (t) => {
  const { client, server, transport } = await startMCPServer();
  
  try {
    const result = await client.callTool({
      name: "get-user-activity",
      arguments: {
        address: "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176"
      }
    });
    
    t.truthy(result);
    t.true(Array.isArray(result.content));
    
    const content = JSON.parse(result.content[0].text);
    t.truthy(content);
  } finally {
    await stopMCPServer({ client, server, transport });
  }
});

test("MCP get-kiwi-price tool works", async (t) => {
  const { client, server, transport } = await startMCPServer();
  
  try {
    const result = await client.callTool({
      name: "get-kiwi-price",
      arguments: {}
    });
    
    t.truthy(result);
    t.true(Array.isArray(result.content));
    
    const content = JSON.parse(result.content[0].text);
    t.truthy(content);
  } finally {
    await stopMCPServer({ client, server, transport });
  }
});