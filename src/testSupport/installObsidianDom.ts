import { installObsidianDom } from "./obsidianDom";

// A few suites ask for Node itself, in a docblock, and have no window.
if (typeof window !== "undefined") {
  installObsidianDom(window);
}
