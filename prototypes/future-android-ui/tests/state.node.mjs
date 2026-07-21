import assert from "node:assert/strict";
import test from "node:test";
import { createPrototypeState, reducePrototypeState } from "../state.js";

test("moves through expand, conversation preview, save, and return", () => {
  let state = createPrototypeState();

  state = reducePrototypeState(state, { type: "toggle-task", id: "focus" });
  assert.equal(state.expandedTaskId, "focus");

  state = reducePrototypeState(state, { type: "open-conversation" });
  state = reducePrototypeState(state, { type: "show-preview" });
  assert.equal(state.showPreview, true);

  state = reducePrototypeState(state, { type: "save-plan" });
  assert.equal(state.screen, "today");
  assert.equal(state.planSaved, true);
  assert.equal(state.tasks[1].title, "整理方案并写入今日日记");
  assert.equal(state.tasks[2].title, "发送行动摘要");
});
