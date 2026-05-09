import { test } from "node:test";
import assert from "node:assert/strict";
import { TodoistAPI } from "../src/todoist-api.js";
import { createServer } from "../src/server.js";
import { FetchMock, callTool } from "./helpers.js";

test("find-activity hits GET /activity/logs", async () => {
  const fetchMock = new FetchMock();
  fetchMock.install();
  try {
    fetchMock.onPaged(/\/activity\/logs/, "GET", [
      { id: "1", event_type: "completed", object_type: "item" },
    ]);
    const api = new TodoistAPI("t");
    const server = createServer(api);
    const result = await callTool(server, "find-activity");
    assert.equal(fetchMock.calls.length, 1);
    const url = fetchMock.calls[0].url;
    assert.match(url, /\/activity\/logs(\?|$)/);
    assert.doesNotMatch(url, /\/tasks\/completed/);
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed[0].event_type, "completed");
  } finally {
    fetchMock.restore();
  }
});

test("find-activity forwards filter params", async () => {
  const fetchMock = new FetchMock();
  fetchMock.install();
  try {
    fetchMock.onPaged(/\/activity\/logs/, "GET", []);
    const api = new TodoistAPI("t");
    const server = createServer(api);
    await callTool(server, "find-activity", {
      object_type: "item",
      event_type: "completed",
      project_id: "P1",
      limit: 50,
    });
    const url = fetchMock.calls[0].url;
    assert.match(url, /object_type=item/);
    assert.match(url, /event_type=completed/);
    assert.match(url, /project_id=P1/);
    assert.match(url, /limit=50/);
  } finally {
    fetchMock.restore();
  }
});
