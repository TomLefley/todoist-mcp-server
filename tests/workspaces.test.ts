import { test } from "node:test";
import assert from "node:assert/strict";
import { TodoistAPI } from "../src/todoist-api.js";
import { createServer } from "../src/server.js";
import { FetchMock, callTool } from "./helpers.js";

test("list-workspaces hits GET /workspaces, not /user", async () => {
  const fetchMock = new FetchMock();
  fetchMock.install();
  try {
    fetchMock.onPaged(/\/api\/v1\/workspaces(\?|$)/, "GET", [
      { id: "W1", name: "Acme Inc" },
    ]);
    const api = new TodoistAPI("t");
    const server = createServer(api);
    const result = await callTool(server, "list-workspaces");
    assert.equal(fetchMock.calls.length, 1);
    const url = fetchMock.calls[0].url;
    assert.match(url, /\/api\/v1\/workspaces(\?|$)/);
    assert.doesNotMatch(url, /\/user/);
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed[0].name, "Acme Inc");
  } finally {
    fetchMock.restore();
  }
});
