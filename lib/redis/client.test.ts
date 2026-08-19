import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  connect: vi.fn(),
  ping: vi.fn(),
  quit: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock("redis", () => ({ createClient: mocks.createClient }));

describe("sharedRedisClient", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("REDIS_URL", "redis://127.0.0.1:6379/0");
    const fakeClient = {
      isOpen: false,
      on: vi.fn(),
      connect: mocks.connect.mockImplementation(async function (this: { isOpen: boolean }) { fakeClient.isOpen = true; }),
      ping: mocks.ping.mockResolvedValue("PONG"),
      quit: mocks.quit.mockImplementation(async () => { fakeClient.isOpen = false; }),
      destroy: mocks.destroy,
    };
    mocks.createClient.mockReturnValue(fakeClient);
  });

  afterEach(async () => {
    const { closeSharedRedisClient } = await import("./client");
    await closeSharedRedisClient();
    vi.unstubAllEnvs();
  });

  it("réutilise une seule connexion pour des sondes répétées et concurrentes", async () => {
    const { sharedRedisClient } = await import("./client");
    const clients = await Promise.all([sharedRedisClient(), sharedRedisClient(), sharedRedisClient()]);
    await Promise.all(clients.map((client) => client?.ping()));
    expect(mocks.createClient).toHaveBeenCalledTimes(1);
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(mocks.ping).toHaveBeenCalledTimes(3);
    expect(mocks.quit).not.toHaveBeenCalled();
  });

  it("ferme explicitement le socket partagé au nettoyage", async () => {
    const { closeSharedRedisClient, sharedRedisClient } = await import("./client");
    await sharedRedisClient();
    await closeSharedRedisClient();
    expect(mocks.quit).toHaveBeenCalledTimes(1);
  });
});
