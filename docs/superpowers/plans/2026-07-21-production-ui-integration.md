# Production UI Integration Plan

**Goal:** Replace the old production interface with the approved Android UI while preserving the real Hermes planning request, local plan persistence, and long-text behavior.

**Scope:** Only the production React interface, its focused tests, generated `dist/`, and this plan. The Hermes API contract, server implementation, deployment workflow, and standalone prototype remain unchanged.

## Acceptance criteria

1. `/` opens the dark Today timeline built from the real saved `Plan`.
2. A task can expand inline without navigating away.
3. The floating conversation entry opens a dedicated Agent conversation screen.
4. Goal and supplementary answer remain multiline, auto-growing, and limited to 4000 UTF-16 code units.
5. Submitting calls the existing `/api/plan` client once, shows progress inside the conversation, then renders the returned plan preview there.
6. Failures stay in the conversation and can be retried without losing input.
7. Saving persists the returned plan, returns to Today, and survives remount/reload.
8. `npm test` and `npm run build` pass; the built `dist/` is committed for phone deployment.

## Execution

### 1. Lock the behavior with tests

- Update `src/App.test.tsx` for the approved Today/conversation/inline-preview flow.
- Update `src/mobile-layout.test.ts` for the dark, edge-to-edge mobile layout and fixed conversation controls.
- Run the focused tests and confirm they fail against the old production UI.

### 2. Integrate the approved UI

- Replace the production screen structure in `src/App.tsx` with Today and Conversation views.
- Use the existing `requestPlan`, `loadSavedPlan`, and `savePlanToStorage` functions unchanged.
- Keep long-text validation and textarea auto-growth.
- Replace `src/styles.css` with the approved dark visual system adapted for real textareas and plan data.

### 3. Verify and publish

- Run `npm test`.
- Run `npm run build` and include the regenerated `dist/`.
- Review the diff, commit only the scoped files, push `main`, then provide exact phone pull/restart/test commands.
