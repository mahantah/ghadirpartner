import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

class BuildScript {
  /**
   * Bundles Electron entry points and copies static assets.
   *
   * @returns {Promise<void>} Resolves after the build is complete.
   */
  async run() {
    await mkdir(resolve("dist"), { recursive: true });

    await build({
      entryPoints: ["src/main/entry.ts"],
      outfile: "dist/main.cjs",
      bundle: true,
      platform: "node",
      format: "cjs",
      target: "node20",
      external: ["electron"],
      sourcemap: true
    });

    await build({
      entryPoints: ["src/preload/entry.ts"],
      outfile: "dist/preload.cjs",
      bundle: true,
      platform: "node",
      format: "cjs",
      target: "node20",
      external: ["electron"],
      sourcemap: true
    });

    await build({
      entryPoints: ["src/renderer/entry.ts"],
      outfile: "dist/renderer.js",
      bundle: true,
      platform: "browser",
      format: "iife",
      target: "chrome130",
      sourcemap: true
    });

    await cp("src/renderer/index.html", "dist/index.html");
    await cp("src/renderer/styles.css", "dist/styles.css");
  }
}

await new BuildScript().run();
