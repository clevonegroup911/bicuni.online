import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { logger } from "../observability/logger";
import { logPidResolverMiss, resetPidMissLogForTests } from "./miss-log";

describe("journalisation des misses PID", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPidMissLogForTests();
  });

  it("déduplique les misses répétés du même identifiant", () => {
    logPidResolverMiss("PID_NOT_FOUND", "bcu/2026.art.01K2R8M7H7YV5A0000000000");
    logPidResolverMiss("PID_NOT_FOUND", "bcu/2026.art.01K2R8M7H7YV5A0000000000");
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
