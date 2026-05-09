import { test } from "node:test";
import assert from "node:assert/strict";
import { TodoistAPI } from "../src/todoist-api.js";
import { createServer } from "../src/server.js";
import { FetchMock, callTool } from "./helpers.js";

test("find-filters hits GET /filters", async () => {
  const fetchMock = new FetchMock();
  fetchMock.install();
  try {
    fetchMock.onPaged(/\/api\/v1\/filters(\?|$)/, "GET", [
      { id: "F1", name: "Today", query: "today" },
    ]);
    const api = new TodoistAPI("t");
    const server = createServer(api);
    const result = await callTool(server, "find-filters");
    assert.equal(fetchMock.calls.length, 1);
    assert.match(fetchMock.calls[0].url, /\/api\/v1\/filters(\?|$)/);
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed[0].name, "Today");
  } finally {
    fetchMock.restore();
  }
});

test("add-filters POSTs each filter to /filters", async () => {
  const fetchMock = new FetchMock();
  fetchMock.install();
  try {
    let i = 0;
    fetchMock.on(/\/api\/v1\/filters$/, "POST", () => ({ body: { id: `F${++i}` } }));
    const api = new TodoistAPI("t");
    const server = createServer(api);
    const result = await callTool(server, "add-filters", {
      filters: [
        { name: "Today p1", query: "today & p1" },
        { name: "Inbox", query: "##Inbox", color: "blue", is_favorite: true },
      ],
    });
    assert.equal(fetchMock.calls.length, 2);
    assert.deepEqual(fetchMock.calls[0].body, { name: "Today p1", query: "today & p1" });
    assert.deepEqual(fetchMock.calls[1].body, { name: "Inbox", query: "##Inbox", color: "blue", is_favorite: true });
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.length, 2);
  } finally {
    fetchMock.restore();
  }
});

test("update-filters POSTs each filter to /filters/{id}", async () => {
  const fetchMock = new FetchMock();
  fetchMock.install();
  try {
    fetchMock.on(/\/filters\/F1$/, "POST", () => ({ body: { id: "F1", name: "Renamed" } }));
    const api = new TodoistAPI("t");
    const server = createServer(api);
    await callTool(server, "update-filters", {
      filters: [{ id: "F1", name: "Renamed", query: "today" }],
    });
    assert.equal(fetchMock.calls.length, 1);
    assert.match(fetchMock.calls[0].url, /\/filters\/F1$/);
    assert.deepEqual(fetchMock.calls[0].body, { name: "Renamed", query: "today" });
  } finally {
    fetchMock.restore();
  }
});

test("delete-object filter type DELETEs /filters/{id}", async () => {
  const fetchMock = new FetchMock();
  fetchMock.install();
  try {
    fetchMock.on(/\/filters\/F1$/, "DELETE", () => ({ status: 204, body: { success: true } }));
    const api = new TodoistAPI("t");
    const server = createServer(api);
    const result = await callTool(server, "delete-object", { object_type: "filter", id: "F1" });
    assert.equal(fetchMock.calls.length, 1);
    assert.equal(fetchMock.calls[0].method, "DELETE");
    assert.match(result.content[0].text, /Deleted filter F1/);
  } finally {
    fetchMock.restore();
  }
});
