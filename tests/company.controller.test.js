import test from "node:test";
import assert from "node:assert/strict";

import CompanyController from "../Controller/CompanyController.js";
import { Company } from "../Model/index.js";
import { createMockRes } from "./helpers/mockExpress.js";
import { patchMethod } from "./helpers/patch.js";

test("CompanyController.create returns 400 when company_name is missing", async (t) => {
  const req = { body: {} };
  const res = createMockRes();

  await CompanyController.create(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.status, "failed");
});

test("CompanyController.create saves company and logo path", async (t) => {
  const restoreFindOne = patchMethod(Company, "findOne", async () => null);
  const restoreCreate = patchMethod(Company, "create", async (payload) => ({ id: 11, ...payload }));
  t.after(() => {
    restoreFindOne();
    restoreCreate();
  });

  const req = {
    body: {
      company_name: "Acme Pvt Ltd",
      city: "Noida",
      state: "UP",
    },
    file: { filename: "logo-1.png" },
  };
  const res = createMockRes();

  await CompanyController.create(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.status, "success");
  assert.equal(res.body.data.logo, "uploads/company/logo-1.png");
});

test("CompanyController.getAll returns list", async (t) => {
  const rows = [{ id: 1, company_name: "A" }, { id: 2, company_name: "B" }];
  const restoreFindAll = patchMethod(Company, "findAll", async () => rows);
  t.after(() => restoreFindAll());

  const res = createMockRes();
  await CompanyController.getAll({}, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, [
    { ...rows[0], logo_url: null },
    { ...rows[1], logo_url: null },
  ]);
});

test("CompanyController.update returns 404 for unknown company", async (t) => {
  const restoreFindByPk = patchMethod(Company, "findByPk", async () => null);
  t.after(() => restoreFindByPk());

  const req = { params: { id: 999 }, body: {} };
  const res = createMockRes();

  await CompanyController.update(req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.msg, "Company not found");
});
