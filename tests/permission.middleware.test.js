import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

import checkPermission from "../middleware/permission.js";
import { Permission, RolePermission, UserRole } from "../Model/index.js";
import { createMockRes } from "./helpers/mockExpress.js";
import { patchMethod } from "./helpers/patch.js";

const withJwtSecret = (t) => {
  const previous = process.env.JWT_SECRET_KEY;
  process.env.JWT_SECRET_KEY = "test-secret-key";
  t.after(() => {
    if (previous === undefined) {
      delete process.env.JWT_SECRET_KEY;
      return;
    }

    process.env.JWT_SECRET_KEY = previous;
  });
};

test("checkPermission allows admin users without DB permission lookup", async (t) => {
  withJwtSecret(t);

  let userRoleLookupCount = 0;
  const restoreUserRoles = patchMethod(UserRole, "findAll", async () => {
    userRoleLookupCount += 1;
    return [];
  });
  t.after(() => restoreUserRoles());

  const token = jwt.sign(
    { userID: 7, role: "Super Admin", permissions: [] },
    process.env.JWT_SECRET_KEY,
  );

  const req = {
    headers: { authorization: `Bearer ${token}` },
    user: { id: 7, role: "Super Admin", permissions: [] },
  };
  const res = createMockRes();
  let nextCalled = false;

  await checkPermission("view_company")(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(userRoleLookupCount, 0);
  assert.equal(res.body, undefined);
});

test("checkPermission skips token validation when TEST_BYPASS_AUTH is enabled", async (t) => {
  const previous = process.env.TEST_BYPASS_AUTH;
  process.env.TEST_BYPASS_AUTH = "true";
  t.after(() => {
    if (previous === undefined) {
      delete process.env.TEST_BYPASS_AUTH;
      return;
    }

    process.env.TEST_BYPASS_AUTH = previous;
  });

  const req = { headers: {}, user: { id: 1, role: "Admin" } };
  const res = createMockRes();
  let nextCalled = false;

  await checkPermission("view_company")(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.body, undefined);
});

test("checkPermission allows requests when signed token already contains the required permission", async (t) => {
  withJwtSecret(t);

  let userRoleLookupCount = 0;
  const restoreUserRoles = patchMethod(UserRole, "findAll", async () => {
    userRoleLookupCount += 1;
    return [];
  });
  t.after(() => restoreUserRoles());

  const token = jwt.sign(
    { userID: 11, role: "Manager", permissions: ["view_company"] },
    process.env.JWT_SECRET_KEY,
  );

  const req = {
    headers: { authorization: `Bearer ${token}` },
    user: { id: 11, role: "Manager", permissions: ["view_company"] },
  };
  const res = createMockRes();
  let nextCalled = false;

  await checkPermission("view_company")(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(userRoleLookupCount, 0);
  assert.equal(res.body, undefined);
});

test("checkPermission still denies non-admin users when the DB has no matching role permission", async (t) => {
  withJwtSecret(t);

  const restoreUserRoles = patchMethod(UserRole, "findAll", async () => [{ role_id: 3 }]);
  const restorePermissions = patchMethod(Permission, "findAll", async () => [
    { id: 9, permission_key: "view_company" },
  ]);
  const restoreRolePermission = patchMethod(RolePermission, "findOne", async () => null);

  t.after(() => {
    restoreUserRoles();
    restorePermissions();
    restoreRolePermission();
  });

  const token = jwt.sign(
    { userID: 19, role: "Inspector", permissions: [] },
    process.env.JWT_SECRET_KEY,
  );

  const req = {
    headers: { authorization: `Bearer ${token}` },
    user: { id: 19, role: "Inspector", permissions: [] },
  };
  const res = createMockRes();
  let nextCalled = false;

  await checkPermission("view_company")(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { message: "Access denied: Insufficient permissions" });
});
