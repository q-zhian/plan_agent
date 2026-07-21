# Future Android UI Prototype

This is a fixed-data UI/UX display prototype, isolated from the production MVP. It has no API, Hermes, Obsidian, Android, deployment, or persistence integration.

## Run locally

```powershell
npx --yes serve prototypes/future-android-ui -l 4173
```

Open `http://localhost:4173` in a 375 x 667 mobile viewport.

## Interaction path

1. Expand and collapse a Today task in place.
2. Open the lower-right conversation entry and return with the back control.
3. Generate the static plan preview in the conversation.
4. Save the plan and return to the updated fixed-data Today timeline.
