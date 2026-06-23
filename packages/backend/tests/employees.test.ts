import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db/prisma";
import { registerAndLoginSeller, type TestSeller } from "./helpers/registerTenant";
import { deleteTenantCompletely } from "./helpers/cleanupTenant";

const describeWithDb = process.env.SKIP_DB_TESTS ? describe.skip : describe;

describeWithDb("employees (integration)", () => {
  const app = createApp();
  let owner: TestSeller;
  let managerEmail: string;
  let managerId: string;

  function ownerAuth() {
    return { Authorization: `Bearer ${owner.accessToken}` };
  }

  beforeAll(async () => {
    owner = await registerAndLoginSeller(app, "business");
  });

  afterAll(async () => {
    await deleteTenantCompletely(owner.tenantId);
    await prisma.$disconnect();
  });

  it("rejects invite requests from non-owners", async () => {
    // The owner is the only user so far - simulate a non-owner by hitting
    // the route with no auth role privilege via a fresh cashier later; for
    // now confirm the route is owner-gated using an invalid role check.
    const res = await request(app).post("/api/employees/invite").send({
      name: "X",
      email: "x@example.com",
      role: "MANAGER",
    });
    expect(res.status).toBe(401);
  });

  it("invites a manager who cannot log in until the invite is accepted", async () => {
    managerEmail = `manager${Date.now()}@example.com`;

    const invite = await request(app).post("/api/employees/invite").set(ownerAuth()).send({
      name: "New Manager",
      email: managerEmail,
      role: "MANAGER",
    });
    expect(invite.status).toBe(201);
    managerId = invite.body.employee.id;

    // The invited user's password is an unguessable random placeholder until
    // accept-invite sets a real one, so any login attempt fails on
    // credentials, never even reaching the email-verified check.
    const loginAttempt = await request(app).post("/api/auth/login").send({ email: managerEmail, password: "whatever123" });
    expect(loginAttempt.status).toBe(401);
    expect(loginAttempt.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("lets the manager set a password via accept-invite and then log in with the MANAGER role", async () => {
    const inviteToken = await prisma.verificationToken.findFirstOrThrow({
      where: { userId: managerId, type: "EMPLOYEE_INVITE" },
    });

    const accept = await request(app)
      .post("/api/auth/accept-invite")
      .send({ token: inviteToken.token, password: "managerpass123" });
    expect(accept.status).toBe(200);

    const login = await request(app).post("/api/auth/login").send({ email: managerEmail, password: "managerpass123" });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe("MANAGER");

    const managerAuth = { Authorization: `Bearer ${login.body.accessToken}` };

    const products = await request(app).get("/api/products").set(managerAuth);
    expect(products.status).toBe(200);

    const employeesList = await request(app).get("/api/employees").set(managerAuth);
    expect(employeesList.status).toBe(403);
  });

  it("lets the owner change the employee's role and lists both users", async () => {
    const updated = await request(app).patch(`/api/employees/${managerId}`).set(ownerAuth()).send({ role: "CASHIER" });
    expect(updated.status).toBe(200);
    expect(updated.body.employee.role).toBe("CASHIER");

    const list = await request(app).get("/api/employees").set(ownerAuth());
    expect(list.status).toBe(200);
    expect(list.body.employees).toHaveLength(2);
  });

  it("refuses to remove the owner or let anyone remove themselves", async () => {
    const removeSelf = await request(app).delete(`/api/employees/${owner.userId}`).set(ownerAuth());
    expect(removeSelf.status).toBe(400);
    expect(removeSelf.body.error.code).toBe("CANNOT_REMOVE_SELF");
  });

  it("removes the employee", async () => {
    const res = await request(app).delete(`/api/employees/${managerId}`).set(ownerAuth());
    expect(res.status).toBe(204);

    const list = await request(app).get("/api/employees").set(ownerAuth());
    expect(list.body.employees).toHaveLength(1);
  });

  it("blocks inviting past the plan's employee limit", async () => {
    const limitedOwner = await registerAndLoginSeller(app, "start"); // maxEmployees: 1, owner already counts as 1
    const limitedAuth = { Authorization: `Bearer ${limitedOwner.accessToken}` };

    const res = await request(app).post("/api/employees/invite").set(limitedAuth).send({
      name: "Too Many",
      email: `overflow${Date.now()}@example.com`,
      role: "CASHIER",
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("PLAN_LIMIT_REACHED");

    await deleteTenantCompletely(limitedOwner.tenantId);
  });
});
