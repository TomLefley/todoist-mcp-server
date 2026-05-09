import { test } from "node:test";
import assert from "node:assert/strict";
import { TodoistAPI } from "../src/todoist-api.js";
import { createServer } from "../src/server.js";
import { FetchMock, callTool } from "./helpers.js";

test("get-productivity-stats hits /user/productivity_stats", async () => {
  const fetchMock = new FetchMock();
  fetchMock.install();
  try {
    fetchMock.on(/\/user\/productivity_stats/, "GET", () => ({
      body: { karma: 5000, karma_trend: "up", days_items: [], week_items: [] },
    }));
    const api = new TodoistAPI("t");
    const server = createServer(api);
    const result = await callTool(server, "get-productivity-stats");
    assert.equal(fetchMock.calls.length, 1);
    const url = fetchMock.calls[0].url;
    assert.match(url, /\/user\/productivity_stats$/);
    assert.doesNotMatch(url, /\/tasks\/completed\/stats/);
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.karma, 5000);
  } finally {
    fetchMock.restore();
  }
});
