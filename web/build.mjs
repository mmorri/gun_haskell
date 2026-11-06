import * as esbuild from "esbuild";
import { cpSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const dist = resolve(root, "dist");
const serve = process.argv.includes("--serve");
const minify = process.argv.includes("--minify") || !serve;

function copyStatic() {
  mkdirSync(dist, { recursive: true });
  for (const file of ["index.html", "style.css"]) {
    cpSync(resolve(root, file), resolve(dist, file));
  }
  const assets = resolve(root, "assets");
  if (existsSync(assets)) {
    cpSync(assets, resolve(dist, "assets"), { recursive: true });
  }
  // Kenney sprites live in the parent repo so both builds share one copy.
  const kenney = resolve(root, "..", "assets", "kenney");
  if (existsSync(kenney)) {
    cpSync(kenney, resolve(dist, "assets", "kenney"), { recursive: true });
  }
}

const options = {
  entryPoints: [resolve(root, "src", "main.ts")],
  bundle: true,
  outfile: resolve(dist, "game.js"),
  format: "iife",
  target: ["es2020"],
  minify,
  sourcemap: serve ? "inline" : false,
  logLevel: "info",
};

if (serve) {
  copyStatic();
  const ctx = await esbuild.context({
    ...options,
    plugins: [
      {
        name: "copy-static",
        setup(build) {
          build.onEnd(() => copyStatic());
        },
      },
    ],
  });
  await ctx.watch();
  const { host, port } = await ctx.serve({ servedir: dist, port: 5173 });
  console.log(`\n  Pew-Pew Defense running at http://${host}:${port}\n`);
} else {
  if (serve) rmSync(dist, { recursive: true, force: true });
  copyStatic();
  await esbuild.build(options);
  console.log("Built to dist/ - zip the contents of dist/ for itch.io.");
}
