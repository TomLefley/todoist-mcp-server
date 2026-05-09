import { test } from "node:test";
import assert from "node:assert/strict";
import { TodoistAPI } from "../src/todoist-api.js";
import { createServer } from "../src/server.js";
import { FetchMock, callTool, listTools } from "./helpers.js";

test("server registers expected tools", () => {
  const api = new TodoistAPI("fake-token");
  const server = createServer(api);
  const tools = listTools(server);
  assert.ok(tools.includes("find-tasks"));
  assert.ok(tools.includes("add-tasks"));
  assert.ok(tools.includes("user-info"));
});

test("user-info hits /user with bearer token", async () => {
  const fetchMock = new FetchMock();
  fetchMock.install();
  try {
    fetchMock.on("/api/v1/user", "GET", () => ({ body: { id: "1", full_name: "Test User" } }));
    const api = new TodoistAPI("test-token");
    const server = createServer(api);
    const result = await callTool(server, "user-info");
    assert.equal(fetchMock.calls.length, 1);
    assert.equal(fetchMock.calls[0].headers.Authorization, "Bearer test-token");
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.full_name, "Test User");
  } finally {
    fetchMock.restore();
  }
});
