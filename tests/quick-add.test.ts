import { test } from "node:test";
import assert from "node:assert/strict";
import { TodoistAPI } from "../src/todoist-api.js";
import { createServer } from "../src/server.js";
import { FetchMock, callTool, listTools } from "./helpers.js";

test("quick-add-task is registered", () => {
  const api = new TodoistAPI("t");
  const server = createServer(api);
  assert.ok(listTools(server).includes("quick-add-task"));
});

test("quick-add-task POSTs to /tasks/quick_add with text", async () => {
  const fetchMock = new FetchMock();
  fetchMock.install();
  try {
    fetchMock.on("/api/v1/tasks/quick_add", "POST", () => ({
      body: { id: "111", content: "Buy milk tomorrow", due: { date: "2026-05-10" } },
    }));
    const api = new TodoistAPI("tk");
    const server = createServer(api);
    const result = await callTool(server, "quick-add-task", { text: "Buy milk tomorrow #Errands p1" });

    assert.equal(fetchMock.calls.length, 1);
    const call = fetchMock.calls[0];
    assert.match(call.url, /\/api\/v1\/tasks\/quick_add$/);
    assert.equal(call.method, "POST");
    assert.deepEqual(call.body, { text: "Buy milk tomorrow #Errands p1" });
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.id, "111");
  } finally {
    fetchMock.restore();
  }
});

test("quick-add-task forwards optional note and reminder", async () => {
  const fetchMock = new FetchMock();
  fetchMock.install();
  try {
    fetchMock.on("/quick_add", "POST", () => ({ body: { id: "222" } }));
    const api = new TodoistAPI("tk");
    const server = createServer(api);
    await callTool(server, "quick-add-task", { text: "Call dad", note: "ask about dinner", reminder: "tomorrow 9am" });
    assert.deepEqual(fetchMock.calls[0].body, { text: "Call dad", note: "ask about dinner", reminder: "tomorrow 9am" });
  } finally {
    fetchMock.restore();
  }
});
