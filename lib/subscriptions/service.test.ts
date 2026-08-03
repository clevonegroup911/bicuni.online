import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ db: { subscription: { findFirst } } }));

import { getCurrentSubscription, hasActiveSubscription } from "./service";

describe("accès par abonnement", () => {
  beforeEach(() => findFirst.mockReset());

  it("demande exclusivement un abonnement actif non expiré", async () => {
    findFirst.mockResolvedValue({ id: "subscription-active" });
    await expect(hasActiveSubscription("user-1")).resolves.toBe(true);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: "user-1", status: { in: ["ACTIVE"] } }),
    }));
  });

  it("refuse l’absence, l’inactivité ou l’expiration renvoyée par la requête", async () => {
    findFirst.mockResolvedValue(null);
    await expect(hasActiveSubscription("user-2")).resolves.toBe(false);
  });

  it("charge le plan afin de permettre les restrictions applicatives", async () => {
    findFirst.mockResolvedValue({ id: "subscription", plan: { slug: "researcher" } });
    await expect(getCurrentSubscription("researcher-1")).resolves.toMatchObject({ plan: { slug: "researcher" } });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ include: { plan: true } }));
  });
});
