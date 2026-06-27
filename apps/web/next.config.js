import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a self-contained production server (.next/standalone) with only the
  // files this app actually uses — the basis of a small Docker image.
  output: "standalone",
  // We're in a monorepo, so tracing must start at the repo root to include
  // the workspace's hoisted node_modules and the @repo/ui package.
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
