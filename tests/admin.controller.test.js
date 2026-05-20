import test from "node:test";
import assert from "node:assert/strict";
import bcryptjs from "bcryptjs";

import AdminController from "../Controller/AdminController.js";
import { User, Role, UserRole, UserCompany } from "../Model/index.js";
import { createMockRes } from "./helpers/mockExpress.js";
import { patchMethod } from "./helpers/patch.js";

test("AdminController.createUser assigns role and multiple companies", async (t) => {
  const restoreHash = patchMethod(bcryptjs, "hash", async () => "hashed-pass");
  const restoreFindOneUser = patchMethod(User, "findOne", async () => null);
  const restoreCreateUser = patchMethod(User, "create", async (payload) => ({ id: 7, ...payload }));
  const restoreFindRole = patchMethod(Role, "findOne", async () => ({ id: 2 }));

  let userRolePayload;
  const restoreUserRoleCreate = patchMethod(UserRole, "create", async (payload) => {
    userRolePayload = payload;
    return payload;
  });

  let userCompanyPayload = [];
  const restoreUserCompanyBulk = patchMethod(UserCompany, "bulkCreate", async (payload) => {
    userCompanyPayload = payload;
    return payload;
  });

  t.after(() => {
    restoreHash();
    restoreFindOneUser();
    restoreCreateUser();
    restoreFindRole();
    restoreUserRoleCreate();
    restoreUserCompanyBulk();
  });

  const req = {
    body: {
      name: "Demo User",
      username: "demo.user",
      password: "123456",
      roleName: 2,
      companyIds: "[1,2,5]",
    },
  };
  const res = createMockRes();

  await AdminController.createUser(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(userRolePayload.role_id, 2);
  assert.deepEqual(
    userCompanyPayload,
    [
      { user_id: 7, company_id: 1 },
      { user_id: 7, company_id: 2 },
      { user_id: 7, company_id: 5 },
    ]
  );
});

test("AdminController.updateUser replaces company mappings", async (t) => {
  const user = { update: async () => {} };
  const restoreFindByPk = patchMethod(User, "findByPk", async () => user);
  const restoreUserRoleFindOne = patchMethod(UserRole, "findOne", async () => ({ user_id: 5, role_id: 2 }));
  const restoreUserRoleUpdate = patchMethod(UserRole, "update", async () => [1]);

  let destroyWhere;
  const restoreDestroy = patchMethod(UserCompany, "destroy", async (args) => {
    destroyWhere = args.where;
    return 1;
  });
  let bulkPayload = [];
  const restoreBulk = patchMethod(UserCompany, "bulkCreate", async (payload) => {
    bulkPayload = payload;
    return payload;
  });

  t.after(() => {
    restoreFindByPk();
    restoreUserRoleFindOne();
    restoreUserRoleUpdate();
    restoreDestroy();
    restoreBulk();
  });

  const req = {
    body: {
      id: 5,
      roleName: "3",
      companyIds: "2,4,6",
      name: "Updated",
    },
  };
  const res = createMockRes();
  await AdminController.updateUser(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(destroyWhere, { user_id: 5 });
  assert.deepEqual(
    bulkPayload,
    [
      { user_id: 5, company_id: 2 },
      { user_id: 5, company_id: 4 },
      { user_id: 5, company_id: 6 },
    ]
  );
});

test("AdminController.getUserCompanies returns selected companies", async (t) => {
  const restoreFindByPk = patchMethod(User, "findByPk", async () => ({
    Companies: [
      { id: 1, company_name: "A" },
      { id: 2, company_name: "B" },
    ],
  }));
  t.after(() => restoreFindByPk());

  const req = { params: { id: 10 } };
  const res = createMockRes();
  await AdminController.getUserCompanies(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, "success");
  assert.equal(res.body.data.length, 2);
});
