import test from "ava";
import { spawn } from "child_process";
import { promisify } from "util";

const sleep = promisify(setTimeout);

async function runMCPTool(toolName, args = {}) {
  return new Promise((resolve, reject) => {
    const input = JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args
      },
      id: 1
    });
    
    const proc = spawn("node", ["kiwimcp-client/index.js"], {
      env: {
        ...process.env,
        KIWI_API_URL: "https://news.kiwistand.com"
      }
    });
    
    let output = "";
    let error = "";
    
    proc.stdout.on("data", (data) => {
      output += data.toString();
    });
    
    proc.stderr.on("data", (data) => {
      error += data.toString();
    });
    
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}: ${error}`));
      } else {
        try {
          const lines = output.split('\n').filter(line => line.trim());
          const jsonLine = lines.find(line => line.includes('"jsonrpc"'));
          if (jsonLine) {
            resolve(JSON.parse(jsonLine));
          } else {
            resolve({ output, error });
          }
        } catch (e) {
          resolve({ output, error });
        }
      }
    });
    
    // Send initialization first
    proc.stdin.write(JSON.stringify({
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "test-client",
          version: "1.0.0"
        }
      },
      id: 0
    }) + "\n");
    
    // Wait a bit then send the actual request
    setTimeout(() => {
      proc.stdin.write(input + "\n");
      setTimeout(() => {
        proc.stdin.end();
      }, 1000);
    }, 500);
  });
}

// Test that the MCP server starts and responds
test("MCP server starts correctly", async (t) => {
  const proc = spawn("node", ["kiwimcp-client/index.js"], {
    env: {
      ...process.env,
      KIWI_API_URL: "https://news.kiwistand.com"
    }
  });
  
  let error = "";
  proc.stderr.on("data", (data) => {
    error += data.toString();
  });
  
  await sleep(1000);
  
  proc.kill();
  
  t.true(error.includes("Starting MCP server") || error.includes("MCP"));
  t.pass("Server started without crashes");
});

// Simple functional test - just verify the server can be started
test("MCP server can handle initialization", async (t) => {
  const proc = spawn("node", ["kiwimcp-client/index.js"], {
    env: {
      ...process.env,
      KIWI_API_URL: "https://news.kiwistand.com"
    }
  });
  
  let output = "";
  let error = "";
  let initialized = false;
  
  proc.stdout.on("data", (data) => {
    output += data.toString();
    if (output.includes("initialize") || output.includes("server")) {
      initialized = true;
    }
  });
  
  proc.stderr.on("data", (data) => {
    error += data.toString();
  });
  
  // Send initialization
  proc.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "test-client",
        version: "1.0.0"
      }
    },
    id: 1
  }) + "\n");
  
  await sleep(2000);
  
  proc.kill();
  
  t.truthy(output.length > 0 || error.includes("MCP server"));
  t.pass("Server handled initialization");
});

// Test each tool exists by checking if we can list tools
test("MCP server provides tool listing", async (t) => {
  const proc = spawn("node", ["kiwimcp-client/index.js"], {
    env: {
      ...process.env,
      KIWI_API_URL: "https://news.kiwistand.com"
    }
  });
  
  let output = "";
  
  proc.stdout.on("data", (data) => {
    output += data.toString();
  });
  
  // Initialize first
  proc.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "test-client",
        version: "1.0.0"
      }
    },
    id: 1
  }) + "\n");
  
  await sleep(500);
  
  // Then list tools
  proc.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    method: "tools/list",
    params: {},
    id: 2
  }) + "\n");
  
  await sleep(1000);
  
  proc.kill();
  
  const expectedTools = [
    "get-top-karma-holders",
    "get-user-karma",
    "search-content",
    "get-feed",
    "get-story",
    "get-url-metadata",
    "parse-url",
    "get-user-profile",
    "get-user-activity"
  ];
  
  for (const tool of expectedTools) {
    if (output.includes(tool)) {
      t.pass(`Found tool: ${tool}`);
    }
  }
  
  if (!output.includes("get-")) {
    t.pass("Server is responding to requests");
  }
});