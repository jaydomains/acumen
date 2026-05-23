import type { Config } from "tailwindcss";

// Tailwind v4 reads configuration primarily from the CSS file via
// `@theme` directives. This file is kept as the canonical content-glob
// declaration so editor tooling and the IDE extension pick up the
// right files; v4-specific theme tokens live in `src/app/globals.css`.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
};

export default config;
