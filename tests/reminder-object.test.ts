import { test } from "node:test";
import assert from "node:assert/strict";
import { TodoistAPI } from "../src/todoist-api.js";
import { createServer } from "../src/server.js";
import { FetchMock, callTool } from "./helpers.js";

test("fetch-object supports reminder type", async () => {
  const fetchMock = new FetchMock();
  fetchMock.install();
  try {
    fetchMock.on(/\/reminders\/R1$/, "GET", () => ({ body: { id: "R1", item_id: "T1" } }));
    const api = new TodoistAPI("t");
    const server = createServer(api);
    const result = await callTool(server, "fetch-object", { object_type: "reminder", id: "R1" });
    assert.equal(fetchMock.calls.length, 1);
    assert.match(fetchMock.calls[0].url, /\/reminders\/R1$/);
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.id, "R1");
  } finally {
    fetchMock.restore();
  }
});

test("delete-object supports reminder type", async () => {
  const fetchMock = new FetchMock();
  fetchMock.install();
  try {
    fetchMock.on(/\/reminders\/R1$/, "DELETE", () => ({ status: 204, body: { success: true } }));
    const api = new TodoistAPI("t");
    const server = createServer(api);
    const result = await callTool(server, "delete-object", { object_type: "reminder", id: "R1" });
    assert.equal(fetchMock.calls.length, 1);
    assert.equal(fetchMock.calls[0].method, "DELETE");
    assert.match(fetchMock.calls[0].url, /\/reminders\/R1$/);
    assert.match(result.content[0].text, /Deleted reminder R1/);
  } finally {
    fetchMock.restore();
  }
});
