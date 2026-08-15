import { describe, expect, it } from "vitest";
import { consumeAuthAttempt } from "./rate-limit";

describe("consumeAuthAttempt", () => {
  it("applique la limite locale lorsque Redis n’est pas configuré", async () => {
    const key = `test:${crypto.randomUUID()}`;
    await expect(consumeAuthAttempt(key, 2, 60_000)).resolves.toBe(true);
    await expect(consumeAuthAttempt(key, 2, 60_000)).resolves.toBe(true);
    await expect(consumeAuthAttempt(key, 2, 60_000)).resolves.toBe(false);
  });
});
