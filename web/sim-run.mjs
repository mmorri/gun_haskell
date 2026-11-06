import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["sim.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "/tmp/pew-sim.cjs",
  logLevel: "error",
});
await import("/tmp/pew-sim.cjs");
