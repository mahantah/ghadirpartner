import { rm } from "node:fs/promises";
import { resolve } from "node:path";

class CleanScript {
  /**
   * Removes generated build output.
   *
   * @returns {Promise<void>} Resolves after the output directory is removed.
   */
  async run() {
    await rm(resolve("dist"), { recursive: true, force: true });
  }
}

await new CleanScript().run();
