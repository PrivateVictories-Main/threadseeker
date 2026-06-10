// The palette's open-event name lives in its own tiny module so that the
// always-rendered topbar (which dispatches the event) never has to import
// the CommandPalette module itself — a static import there hoisted the
// whole palette into the first-paint chunk and silently defeated the
// dynamic() code-split in home-app.tsx.
export const COMMAND_PALETTE_OPEN_EVENT = "threadseeker:open-command-palette";
