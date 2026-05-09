#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TodoistAPI } from "./todoist-api.js";
import { createServer } from "./server.js";

const token = process.env.TODOIST_API_TOKEN;
if (!token) {
  console.error("TODOIST_API_TOKEN environment variable is required");
  process.exit(1);
}

const api = new TodoistAPI(token);
const server = createServer(api);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => { console.error("Server failed:", err); process.exit(1); });
