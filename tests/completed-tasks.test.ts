import { test } from "node:test";
import assert from "node:assert/strict";
import { TodoistAPI } from "../src/todoist-api.js";
import { createServer } from "../src/server.js";
import { FetchMock, callTool } from "./helpers.js";

test("find-completed-tasks defaults to legacy /tasks/completed", async () => {
  const fetchMock = new FetchMock();
  fetchMock.install();
  try {
    fetchMock.on(/\/tasks\/completed(\?|$)/, "GET", () => ({ body: { items: [] } }));
    const api = new TodoistAPI("t");
    const server = createServer(api);
    await callTool(server, "find-completed-tasks", { limit: 5 });
    assert.equal(fetchMock.calls.length, 1);
    assert.match(fetchMock.calls[0].url, /\/tasks\/completed\?/);
    assert.doesNotMatch(fetchMock.calls[0].url, /by_completion_date|by_due_date/);
  } finally {
    fetchMock.restore();
  }
});

test("find-completed-tasks by completion_date hits /tasks/completed/by_completion_date", async () => {
  const fetchMock = new FetchMock();
  fetchMock.install();
  try {
    fetchMock.on(/by_completion_date/, "GET", () => ({ body: { results: [], next_cursor: null } }));
    const api = new TodoistAPI("t");
    const server = createServer(api);
    await callTool(server, "find-completed-tasks", {
      by: "completion_date",
      since: "2026-05-01T00:00:00",
      until: "2026-05-09T00:00:00",
    });
    assert.equal(fetchMock.calls.length, 1);
    const url = fetchMock.calls[0].url;
    assert.match(url, /\/tasks\/completed\/by_completion_date\?/);
    assert.match(url, /since=2026-05-01T00%3A00%3A00/);
    assert.match(url, /until=2026-05-09T00%3A00%3A00/);
  } finally {
    fetchMock.restore();
  }
});

test("find-completed-tasks by due_date hits /tasks/completed/by_due_date", async () => {
  const fetchMock = new FetchMock();
  fetchMock.install();
  try {
    fetchMock.on(/by_due_date/, "GET", () => ({ body: { results: [], next_cursor: null } }));
    const api = new TodoistAPI("t");
    const server = createServer(api);
    await callTool(server, "find-completed-tasks", {
      by: "due_date",
      since: "2026-05-01T00:00:00",
      until: "2026-05-09T00:00:00",
      project_id: "p1",
    });
    assert.equal(fetchMock.calls.length, 1);
    const url = fetchMock.calls[0].url;
    assert.match(url, /\/tasks\/completed\/by_due_date\?/);
    assert.match(url, /project_id=p1/);
  } finally {
    fetchMock.restore();
  }
});
