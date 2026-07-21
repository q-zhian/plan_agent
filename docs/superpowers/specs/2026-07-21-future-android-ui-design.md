# Future Android UI design

## Status and scope

This is a product/UI handoff for the future Android application. It records the agreed interface direction only. It does not change the current browser MVP, Hermes prompts or protocol, Obsidian content, synchronization design, APK packaging, or deployment.

The current MVP remains a plan-only vertical slice. The broader Agent vision is preserved as product context, not an implementation requirement in this document.

This document is intentionally not an implementation plan or authorization to build a prototype. A future display prototype, implementation plan, or product-code change requires a separate user request and explicit scope confirmation.

## Product intent

The app is a calm, low-pressure personal planning assistant. Opening it should answer one question immediately: what is my day arranged like? It must not resemble a project-management dashboard or greet the user with motivational copy.

Hermes is the conversation subject; planning and future knowledge-base work are capabilities that may arise from a natural conversation. The app shell remains neutral. A future role template may change the Agent's written voice, but the UI must not invent, inspect, or encode that template.

## Visual direction

Use a dark, neutral, platform-native visual system guided by Apple Design principles: purpose, familiarity, simplicity, agency, craft, and restrained feedback. These principles guide behavior and hierarchy; this is not an Apple visual clone.

- Base surface: flat deep graphite/near-black. No wallpapers, gradients, textures, botanical motifs, illustrations, or decorative backgrounds.
- Color: no green, blue, beige, or brand accent color in the current direction. Hierarchy comes from off-white, neutral gray, opacity, spacing, weight, and thin separators.
- Primary action: an off-white solid button with graphite text. A primary action is emphasized by contrast and placement, never a saturated color.
- Typography: Android system sans-serif, with slightly tighter tracking and leading for large headings, neutral body tracking, and generous leading for task descriptions. Respect user text-size settings in future implementation.
- Surfaces: avoid card stacks and shadows. Use whitespace and hairline dividers to group information. A translucent surface is reserved only for a genuinely floating control, never for decoration.
- Iconography: use familiar simple line icons. No robot or character art. The Agent entry is a compact neutral speech-bubble icon.

## Core screens

### 1. Today timeline

The home screen opens directly to an already-created day plan.

- A small, secondary header shows `今天 · YYYY年M月D日 · 星期X`. The displayed date is always the actual current day.
- A vertical timeline is the screen's visual focus. Each row contains time, a timeline node, task title, and a modest chevron.
- The current task is distinguished only by a small brightness increase and a thin neutral-white timeline segment or ring. It is not a colored card.
- Tasks are view-only. There are no completion checkboxes, drag handles, analytics, metrics, or project-management controls.
- The lower-right speech-bubble icon opens the separate Agent conversation page. It has no label or prompt text.

### 2. Inline task expansion

Tapping a task expands it in place in the timeline; it never opens a task-details page.

- The opened row retains its original timeline position.
- Neighboring time blocks remain visible above and below, so the user retains chronological context.
- The expansion may reveal one concise description and one `目标` line, then a collapse chevron.
- Expansion is for reading only. Editing, rescheduling, completion, and dragging are intentionally absent.

### 3. Agent conversation

The Agent opens on a separate page with a back arrow, small centered `对话` title, and a low-emphasis date separator above the first message.

- The role is expressed through the Agent's written replies only. There is no fixed Agent name, portrait, or character visual in the interface.
- A small abstract monochrome Agent marker identifies an Agent message group. A small user avatar identifies a user message group; it may use a profile image later and falls back to a neutral user/initial placeholder.
- Show the marker/avatar once per contiguous message group, not beside every bubble.
- Speaker distinction relies primarily on alignment, typography, and whitespace, not colorful bubbles.
- Future knowledge-base writes appear only as a factual, low-emphasis outcome line (for example, `已写入今日日记`). They are not tabs, modes, or visible feature entries.
- The composer is a familiar fixed text input with one send icon. It should be visually active on touch, not permanently highlighted.

### 4. Plan preview and return

When a conversation creates a plan, keep its preview in the conversation flow rather than sending the user to a separate planning product page.

- The Agent provides a concise, role-appropriate introduction.
- A sparse plan preview contains a title and time/task rows separated by hairlines; it is not a colored card.
- `保存并回到今天` is the single off-white primary action.
- `继续调整` is a quiet secondary text action.
- Saving returns the user to the updated Today timeline.

## Interaction and motion

Motion is functional feedback, not decoration.

- Tap targets respond on press-down. Target hit areas should be comfortably touchable.
- Task expansion originates from the tapped row and returns through the same path. Future implementation should use a critically damped, interruptible spring for direct interactions; it must not lock input during the transition.
- The conversation page should enter from the Agent entry and return through the same spatial relationship. Back navigation always remains visible.
- Plan save should provide one clear completion response before returning to Today.
- With reduced motion enabled, replace spatial/spring movement with short opacity transitions while retaining state feedback.

## Decisions recorded

| Area | Decision |
| --- | --- |
| Home priority | Existing daily timeline; no greeting or inspirational text |
| Timeline behavior | View and inline expansion only |
| Agent entry | Compact lower-right neutral speech-bubble icon |
| Conversation structure | One natural conversation; no plan/knowledge-base mode selector |
| Agent identity | Role is text-only for now; future name/image is deferred |
| Message identity | User avatar plus abstract Agent marker, once per message group |
| Plan outcome | Preview in conversation, then save and return to Today |
| Theme | Dark, neutral, no saturated accent color |

## Deferred or outside UI scope

- The user's Hermes role template and its rules: private to the user; do not infer, modify, or document its content here.
- Hermes conversation protocol, tools, response schema, and API changes.
- Obsidian connection, synchronization, storage, conflict resolution, permission handling, and the user's personal knowledge-base rules.
- Android APK/WebView implementation, local-service lifecycle, Termux/PRoot configuration, and deployment.
- Profiles, Agent character artwork, role names, and any visual identity beyond the neutral markers described above.

## Handoff checks

Before any future UI implementation is accepted, verify that the rendered screens preserve the decisions above:

1. Today opens to the timeline with a small actual-date header and no motivational copy.
2. The timeline is readable at a glance; an expanded task keeps nearby time context visible.
3. The Agent page shows date context, neutral speaker identifiers, and no feature-mode menu.
4. Plan confirmation uses an off-white primary action and returns to Today on save.
5. No green, saturated blue, botanical decoration, robot imagery, colored dashboard cards, or project-management affordances have been introduced.
6. Touch feedback is immediate, reversible where applicable, and has a reduced-motion alternative.
