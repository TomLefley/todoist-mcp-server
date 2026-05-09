import { test } from "node:test";
import assert from "node:assert/strict";
import { TodoistAPI } from "../src/todoist-api.js";
import { createServer } from "../src/server.js";
import { FetchMock, callTool, listTools } from "./helpers.js";

test("update-labels is registered", () => {
  const api = new TodoistAPI("t");
  const server = createServer(api);
  assert.ok(listTools(server).includes("update-labels"));
});

test("update-labels POSTs each label to /labels/{id}", async () => {
  const fetchMock = new FetchMock();
  fetchMock.install();
  try {
    fetchMock.on(/\/labels\/L1$/, "POST", () => ({ body: { id: "L1", name: "renamed" } }));
    fetchMock.on(/\/labels\/L2$/, "POST", () => ({ body: { id: "L2", color: "blue" } }));
    const api = new TodoistAPI("t");
    const server = createServer(api);
    const result = await callTool(server, "update-labels", {
      labels: [
        { id: "L1", name: "renamed" },
        { id: "L2", color: "blue", is_favorite: true },
      ],
    });
    assert.equal(fetchMock.calls.length, 2);
    assert.equal(fetchMock.calls[0].method, "POST");
    assert.match(fetchMock.calls[0].url, /\/labels\/L1$/);
    assert.deepEqual(fetchMock.calls[0].body, { name: "renamed" });
    assert.match(fetchMock.calls[1].url, /\/labels\/L2$/);
    assert.deepEqual(fetchMock.calls[1].body, { color: "blue", is_favorite: true });
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed[0].name, "renamed");
  } finally {
    fetchMock.restore();
  }
});
