// ─── Shared Custom Hooks ──────────────────────────────────────────────────────
// Re-export every shared hook from this barrel file so consumers can write:
//   import { useLocalStorage } from "@/shared/lib/hooks"
//
// Feature-specific hooks (e.g. useChat) live inside their feature folder and
// are NOT exported here – they are only imported by that feature's components.
//
// Add new app-wide hooks below as the project grows.

export {};
// Example future export:
// export { useLocalStorage } from "./useLocalStorage";
