import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), university: vi.fn(), department: vi.fn(), transaction: vi.fn(), profileUpsert: vi.fn(), userUpdate: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/client", () => ({ db: {
  user: { findUnique: vi.fn() }, university: { findFirst: mocks.university }, department: { findFirst: mocks.department }, $transaction: mocks.transaction,
} }));
import { PATCH } from "./route";

describe("PATCH /api/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
    mocks.transaction.mockImplementation(async (callback) => callback({
      user: { update: mocks.userUpdate, findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "user-1" }) },
      profile: { upsert: mocks.profileUpsert },
      auditLog: { create: vi.fn() },
    }));
  });

  it("refuse les champs sensibles hors allowlist", async () => {
    const response = await PATCH(new Request("https://bicuni.online/api/profile", { method: "PATCH", body: JSON.stringify({ role: "SUPER_ADMIN" }) }));
    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("refuse un département sans institution", async () => {
    const response = await PATCH(new Request("https://bicuni.online/api/profile", { method: "PATCH", body: JSON.stringify({ departmentId: "cm12345678901234567890123" }) }));
    expect(response.status).toBe(400);
  });

  it("vérifie que le département appartient à l’institution", async () => {
    mocks.university.mockResolvedValue({ id: "cm12345678901234567890123" });
    mocks.department.mockResolvedValue(null);
    const response = await PATCH(new Request("https://bicuni.online/api/profile", { method: "PATCH", body: JSON.stringify({
      universityId: "cm12345678901234567890123", departmentId: "cm12345678901234567890124",
    }) }));
    expect(response.status).toBe(400);
    expect(mocks.department).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ faculty: { universityId: "cm12345678901234567890123" } }) }));
  });

  it("efface l’ancien département lorsque l’institution change seule", async () => {
    mocks.university.mockResolvedValue({ id: "cm12345678901234567890123" });
    const response = await PATCH(new Request("https://bicuni.online/api/profile", { method: "PATCH", body: JSON.stringify({
      universityId: "cm12345678901234567890123",
    }) }));
    expect(response.status).toBe(200);
    expect(mocks.profileUpsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ universityId: "cm12345678901234567890123", departmentId: null }),
    }));
  });

  it("persiste l’avatar HTTPS sans exposer les champs sensibles", async () => {
    const response = await PATCH(new Request("https://bicuni.online/api/profile", { method: "PATCH", body: JSON.stringify({
      image: "https://cdn.example/avatar.png",
    }) }));
    expect(response.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "user-1" }, data: { image: "https://cdn.example/avatar.png" },
    }));
  });

  it("applique la permission profile:write", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    const response = await PATCH(new Request("https://bicuni.online/api/profile", { method: "PATCH", body: JSON.stringify({ name: "Admin" }) }));
    expect(response.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
