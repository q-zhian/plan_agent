# Future Android UI Prototype Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Build a static, fixed-data browser-display prototype for the future Android UI: Today timeline, inline task expansion, Agent conversation, in-conversation plan preview, and save-and-return.

**Architecture:** Keep every prototype asset in prototypes/future-android-ui, outside the production Vite/React MVP. A browser-native ES module owns deterministic interaction state, app.js renders it, and a Node built-in test covers the core flow.

**Tech Stack:** Static HTML, CSS, browser-native JavaScript modules, Node.js node:test and node:assert. No added dependency, API, service, Android build, or external data.

---

## Directory boundary

Create or change only:

- docs/superpowers/plans/2026-07-21-future-android-ui-prototype.md
- prototypes/future-android-ui/index.html
- prototypes/future-android-ui/styles.css
- prototypes/future-android-ui/state.js
- prototypes/future-android-ui/app.js
- prototypes/future-android-ui/tests/state.node.mjs
- prototypes/future-android-ui/README.md

Never modify src, server, server.mjs, dist, deployment scripts, root README, package files, or current tests. Fixed fictional content only: no Obsidian reads/writes and no network requests.

At 375 by 667, acceptance is:

1. Today opens to a flat graphite vertical timeline with a small actual-date header, no greeting, no task editing/completion/dragging controls, and a lower-right neutral speech-bubble entry.
2. A task expands in place to show one concise description and a 目标 line, without hiding the neighboring time rows.
3. Conversation is a distinct page with a back arrow, centered 对话 title, date separator, one neutral marker/avatar per contiguous speaker group, and a fixed composer.
4. A sparse hairline-separated plan preview occurs inside the conversation. The only high-emphasis action is the off-white 保存并回到今天 button; saving returns to an updated Today timeline.
5. The UI has no gradients, saturated colors, shadows, card stacks, robot/character art, dashboards, or project-management affordances. Reduced-motion CSS uses short opacity feedback.

### Task 1: Test and implement state transitions

**Files:**

- Create: prototypes/future-android-ui/tests/state.node.mjs
- Create: prototypes/future-android-ui/state.js

- [ ] **Step 1: Write the failing interaction-state test**

~~~js
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
});
~~~

- [ ] **Step 2: Verify RED**

Run: node --test prototypes/future-android-ui/tests/state.node.mjs

Expected: FAIL with ERR_MODULE_NOT_FOUND for state.js.

- [ ] **Step 3: Implement the smallest reducer**

~~~js
const originalTasks = [
  { id: "review", time: "09:30", title: "回顾今天的安排", description: "确认优先事项与时间边界。", goal: "带着清晰次序开始一天" },
  { id: "focus", time: "11:00", title: "整理方案并写入今日日记", description: "把讨论后的决定压缩成可执行的下一步。", goal: "留下一条可继续推进的记录" },
  { id: "walk", time: "16:30", title: "散步与留白", description: "离开屏幕，给思考留出空白。", goal: "恢复注意力" },
];

export function createPrototypeState() {
  return { screen: "today", expandedTaskId: null, showPreview: false, planSaved: false, tasks: originalTasks };
}

export function reducePrototypeState(state, action) {
  if (action.type === "toggle-task") return { ...state, expandedTaskId: state.expandedTaskId === action.id ? null : action.id };
  if (action.type === "open-conversation") return { ...state, screen: "conversation", showPreview: false };
  if (action.type === "show-preview") return { ...state, showPreview: true };
  if (action.type === "save-plan") return { ...state, screen: "today", showPreview: false, planSaved: true, expandedTaskId: null };
  if (action.type === "back-to-today") return { ...state, screen: "today", showPreview: false };
  return state;
}
~~~

- [ ] **Step 4: Verify GREEN**

Run: node --test prototypes/future-android-ui/tests/state.node.mjs

Expected: PASS with one passing test.

### Task 2: Create the isolated document and neutral mobile visual system

**Files:**

- Create: prototypes/future-android-ui/index.html
- Create: prototypes/future-android-ui/styles.css

- [ ] **Step 1: Add the standalone document shell**

~~~html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Future Android UI Prototype</title>
    <link rel="stylesheet" href="./styles.css">
  </head>
  <body>
    <main id="prototype" aria-live="polite"></main>
    <script type="module" src="./app.js"></script>
  </body>
</html>
~~~

- [ ] **Step 2: Implement mobile-first graphite styling**

~~~css
:root { color-scheme: dark; font-family: Roboto, "Noto Sans SC", sans-serif; background: #111211; color: #f1f1ed; }
* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; background: #111211; }
button, input { font: inherit; }
.phone { min-height: 100dvh; max-width: 430px; margin: 0 auto; padding: 24px 20px 112px; background: #111211; }
.hairline { border-color: rgb(241 241 237 / 16%); }
.primary-action { min-height: 48px; border: 0; border-radius: 999px; padding: 0 18px; background: #f1f1ed; color: #181918; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition-duration: 120ms !important; animation-duration: 120ms !important; } }
~~~

- [ ] **Step 3: Serve the isolated directory and inspect viewport containment**

Run: npx --yes serve prototypes/future-android-ui -l 4173

Expected: localhost port 4173 renders at 375 by 667 without horizontal scroll.

### Task 3: Render UI states and wire interactions

**Files:**

- Create: prototypes/future-android-ui/app.js

- [ ] **Step 1: Render Today directly from the state**

The renderer must map each fixed task to its time, timeline node, title, chevron button, and conditional inline description/目标 block. It must render an actual-date header, plan-saved outcome text when applicable, and one lower-right data-action=open-conversation button.

- [ ] **Step 2: Render a separate conversation page**

The renderer must show a data-action=back-to-today control, centered 对话 title, current-date separator, sparse neutral Agent/user groups, a data-action=show-preview trigger, and a fixed inactive composer. When showPreview is true, replace the trigger with a hairline-separated plan preview that provides data-action=save-plan and a quiet secondary action.

- [ ] **Step 3: Use one delegated interaction listener**

~~~js
root.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  state = reducePrototypeState(state, { type: target.dataset.action, id: target.dataset.id });
  render();
});
~~~

- [ ] **Step 4: Re-run the reducer test after renderer integration**

Run: node --test prototypes/future-android-ui/tests/state.node.mjs

Expected: PASS with one passing test.

### Task 4: Document, verify, and make one scoped commit

**Files:**

- Create: prototypes/future-android-ui/README.md

- [ ] **Step 1: Document the isolation and launch command**

The README must call this a fixed-data UI/UX display prototype, state that it has no API, Hermes, Obsidian, Android, deployment, or persistence integration, and give:

~~~powershell
npx --yes serve prototypes/future-android-ui -l 4173
~~~

It must direct reviewers to open localhost port 4173 at a 375 by 667 mobile viewport.

- [ ] **Step 2: Run non-mutating automated verification**

Run: node --test prototypes/future-android-ui/tests/state.node.mjs; node --check prototypes/future-android-ui/app.js

Expected: the prototype state test passes and the browser module has no JavaScript syntax error. Do not run npm run build: it writes dist, which is outside this prototype boundary. Run npm test only when the pre-existing workspace dependencies are already installed; do not install or change production dependencies for this display prototype.

- [ ] **Step 3: Verify the required 375 by 667 interaction path**

1. Toggle 整理方案并写入今日日记 twice and observe in-place expand/collapse with adjacent rows visible.
2. Open the lower-right bubble, then use the visible back control to return.
3. Reopen conversation, select 生成计划预览, and confirm the sparse in-flow plan and off-white save action.
4. Select 保存并回到今天 and confirm Today displays the fixed fictional result line 已写入今日日记.
5. Inspect all screens for the neutral visual constraints and absence of product-management controls.

- [ ] **Step 4: Verify exact change boundary**

Run: git status --short; git diff --check; git diff -- docs/superpowers/plans/2026-07-21-future-android-ui-prototype.md prototypes/future-android-ui

Expected: only the plan and isolated prototype paths appear; no whitespace errors.

- [ ] **Step 5: Commit exactly the scoped files**

~~~bash
git add docs/superpowers/plans/2026-07-21-future-android-ui-prototype.md prototypes/future-android-ui
git commit -m "feat(prototype): add future android ui showcase"
~~~

## Plan self-review

- Spec coverage: Tasks 1 and 3 implement every required interaction state; Task 2 covers dark-neutral mobile visual requirements and reduced motion; Task 4 defines local run, mobile verification, diff boundary, and commit.
- Placeholder scan: no deferred implementation or unspecified commands remain.
- Consistency: toggle-task, open-conversation, show-preview, save-plan, and back-to-today are shared across test, reducer, and renderer.
