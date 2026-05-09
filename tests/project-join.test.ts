import { test } from "node:test";
import assert from "node:assert/strict";
import { TodoistAPI } from "../src/todoist-api.js";
import { createServer } from "../src/server.js";
import { FetchMock, callTool } from "./helpers.js";

test("project-management join action POSTs /projects/{id}/join", async () => {
  const fetchMock = new FetchMock();
  fetchMock.install();
  try {
    fetchMock.on(/\/projects\/p1\/join/, "POST", () => ({ body: { id: "p1", joined: true } }));
    const api = new TodoistAPI("t");
    const server = createServer(api);
    const result = await callTool(server, "project-management", {
      operations: [{ project_id: "p1", action: "join" }],
    });
    assert.equal(fetchMock.calls.length, 1);
    const call = fetchMock.calls[0];
    assert.match(call.url, /\/projects\/p1\/join$/);
    assert.equal(call.method, "POST");
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed[0].joined, true);
  } finally {
    fetchMock.restore();
  }
});

test("project-management still supports update and delete", async () => {
  const fetchMock = new FetchMock();
  fetchMock.install();
  try {
    fetchMock.on(/\/projects\/p1$/, "POST", () => ({ body: { id: "p1", name: "X" } }));
    fetchMock.on(/\/projects\/p2$/, "DELETE", () => ({ status: 204, body: { success: true } }));
    const api = new TodoistAPI("t");
    const server = createServer(api);
    await callTool(server, "project-management", {
      operations: [
        { project_id: "p1", action: "update", data: { name: "X" } },
        { project_id: "p2", action: "delete" },
      ],
    });
    assert.equal(fetchMock.calls.length, 2);
    assert.equal(fetchMock.calls[0].method, "POST");
    assert.equal(fetchMock.calls[1].method, "DELETE");
  } finally {
    fetchMock.restore();
  }
});
