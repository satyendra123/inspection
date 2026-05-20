import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import bcryptjs from "bcryptjs";

import { patchMethod } from "./helpers/patch.js";
import {
  Company,
  User,
  Role,
  UserRole,
  UserCompany,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderCompany,
  Items,
} from "../Model/index.js";

process.env.NODE_ENV = "test";
process.env.TEST_BYPASS_AUTH = "true";

let server;
let baseUrl;

before(async () => {
  const { default: app } = await import("../app.js");
  server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

const jsonFetch = async (path, options = {}) => {
  const res = await fetch(`${baseUrl}${path}`, options);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (e) {
    body = text;
  }
  return { status: res.status, body };
};

test("GET /api/companies returns company list", async (t) => {
  const restoreFindAll = patchMethod(Company, "findAll", async () => [
    { id: 1, company_name: "Acme" },
    { id: 2, company_name: "Globex" },
  ]);
  t.after(() => restoreFindAll());

  const result = await jsonFetch("/api/companies");

  assert.equal(result.status, 200);
  assert.equal(result.body.status, "success");
  assert.equal(result.body.data.length, 2);
});

test("POST /api/companies validates required company_name", async () => {
  const result = await jsonFetch("/api/companies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ city: "Noida" }),
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.status, "failed");
});

test("POST /api/create/user creates user with company mappings", async (t) => {
  const restoreHash = patchMethod(bcryptjs, "hash", async () => "hashed-password");
  const restoreUserFindOne = patchMethod(User, "findOne", async () => null);
  const restoreUserCreate = patchMethod(User, "create", async (payload) => ({ id: 101, ...payload }));
  const restoreRoleFindOne = patchMethod(Role, "findOne", async () => ({ id: 5 }));
  const restoreUserRoleCreate = patchMethod(UserRole, "create", async () => ({}));

  let mappingPayload = [];
  const restoreUserCompanyBulk = patchMethod(UserCompany, "bulkCreate", async (payload) => {
    mappingPayload = payload;
    return payload;
  });

  t.after(() => {
    restoreHash();
    restoreUserFindOne();
    restoreUserCreate();
    restoreRoleFindOne();
    restoreUserRoleCreate();
    restoreUserCompanyBulk();
  });

  const result = await jsonFetch("/api/create/user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "API User",
      username: "api.user",
      password: "123456",
      roleName: 5,
      companyIds: [7, 8],
    }),
  });

  assert.equal(result.status, 201);
  assert.equal(result.body.status, "success");
  assert.deepEqual(mappingPayload, [
    { user_id: 101, company_id: 7 },
    { user_id: 101, company_id: 8 },
  ]);
});

test("GET /api/user/:id/companies returns selected companies", async (t) => {
  const restoreFindByPk = patchMethod(User, "findByPk", async () => ({
    Companies: [{ id: 11, company_name: "One" }],
  }));
  t.after(() => restoreFindByPk());

  const result = await jsonFetch("/api/user/55/companies");

  assert.equal(result.status, 200);
  assert.equal(result.body.status, "success");
  assert.equal(result.body.data[0].id, 11);
});

test("POST /api/create-po stores po-company mapping", async (t) => {
  const tx = {
    async commit() {},
    async rollback() {},
  };

  const restoreTransaction = patchMethod(
    PurchaseOrder.sequelize,
    "transaction",
    async () => tx
  );
  let createdPoPayload;
  const restorePoCreate = patchMethod(PurchaseOrder, "create", async (payload) => {
    createdPoPayload = payload;
    return { id: 33 };
  });
  const restoreItemsFindAll = patchMethod(Items, "findAll", async () => [{ id: 9 }]);
  const restorePoItemCreate = patchMethod(PurchaseOrderItem, "create", async () => ({}));

  let mappingPayload = [];
  const restorePoCompanyBulk = patchMethod(PurchaseOrderCompany, "bulkCreate", async (payload) => {
    mappingPayload = payload;
    return payload;
  });
  const restoreCompanyFindAll = patchMethod(Company, "findAll", async () => [
    { id: 2, company_name: "C2" },
    { id: 9, company_name: "C9" },
  ]);
  const restorePoCompanyFindAll = patchMethod(PurchaseOrderCompany, "findAll", async () => [
    { company_id: 2 },
    { company_id: 9 },
  ]);

  t.after(() => {
    restoreTransaction();
    restorePoCreate();
    restoreItemsFindAll();
    restorePoItemCreate();
    restorePoCompanyBulk();
    restoreCompanyFindAll();
    restorePoCompanyFindAll();
  });

  const result = await jsonFetch("/api/create-po", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      po_number: "PO-INT-1",
      project_name: "Project Integration",
      po_date: "2026-02-18",
      vendor: 3,
      delivery_date: "2026-02-22",
      items: JSON.stringify([{ item: 9, quantity: 4 }]),
      companyIds: "2,9",
    }),
  });

  assert.equal(result.status, 201);
  assert.equal(result.body.status, "success");
  assert.equal(createdPoPayload.project_name, "Project Integration");
  assert.deepEqual(mappingPayload, [
    { po_id: 33, company_id: 2 },
    { po_id: 33, company_id: 9 },
  ]);
});
