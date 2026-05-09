import { test } from "node:test";
import assert from "node:assert/strict";
import { TodoistAPI } from "../src/todoist-api.js";
import { createServer } from "../src/server.js";
import { FetchMock, callTool } from "./helpers.js";

test("find-tasks without query hits /tasks (container endpoint)", async () => {
  const fetchMock = new FetchMock();
  fetchMock.install();
  try {
    fetchMock.onPaged(/\/api\/v1\/tasks(\?|$)/, "GET", []);
    const api = new TodoistAPI("t");
    const server = createServer(api);
    await callTool(server, "find-tasks", { project_id: "p1" });
    assert.equal(fetchMock.calls.length, 1);
    assert.match(fetchMock.calls[0].url, /\/api\/v1\/tasks\?/);
    assert.doesNotMatch(fetchMock.calls[0].url, /\/tasks\/filter/);
  } finally {
    fetchMock.restore();
  }
});

test("find-tasks with filter_query hits /tasks/filter with query param", async () => {
  const fetchMock = new FetchMock();
  fetchMock.install();
  try {
    fetchMock.onPaged(/\/tasks\/filter/, "GET", [
      { id: "1", content: "Today task" },
    ]);
    const api = new TodoistAPI("t");
    const server = createServer(api);
    const result = await callTool(server, "find-tasks", { filter_query: "today & p1" });
    assert.equal(fetchMock.calls.length, 1);
    const url = fetchMock.calls[0].url;
    assert.match(url, /\/tasks\/filter\?/);
    assert.match(url, /query=today\+%26\+p1|query=today%20%26%20p1/);
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed[0].content, "Today task");
  } finally {
    fetchMock.restore();
  }
});

test("find-tasks with filter_query forwards lang", async () => {
  const fetchMock = new FetchMock();
  fetchMock.install();
  try {
    fetchMock.onPaged(/\/tasks\/filter/, "GET", []);
    const api = new TodoistAPI("t");
    const server = createServer(api);
    await callTool(server, "find-tasks", { filter_query: "demain", lang: "fr" });
    assert.match(fetchMock.calls[0].url, /lang=fr/);
  } finally {
    fetchMock.restore();
  }
});
