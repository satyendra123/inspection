import test from "node:test";
import assert from "node:assert/strict";

import PoController from "../Controller/PoController.js";
import {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderCompany,
  Inspection,
  Items,
  Company,
} from "../Model/index.js";
import { createMockRes } from "./helpers/mockExpress.js";
import { patchMethod } from "./helpers/patch.js";

test("PoController.createPO stores items and selected companies", async (t) => {
  const tx = {
    committed: false,
    rolledBack: false,
    async commit() {
      this.committed = true;
    },
    async rollback() {
      this.rolledBack = true;
    },
  };

  const restoreTransaction = patchMethod(
    PurchaseOrder.sequelize,
    "transaction",
    async () => tx
  );
  let createdPoPayload;
  const restoreCreatePO = patchMethod(PurchaseOrder, "create", async (payload) => {
    createdPoPayload = payload;
    return { id: 101 };
  });
  const restoreItemsFindAll = patchMethod(Items, "findAll", async () => [{ id: 10 }, { id: 11 }]);

  const createdItems = [];
  const restoreCreateItem = patchMethod(PurchaseOrderItem, "create", async (payload) => {
    createdItems.push(payload);
    return payload;
  });

  let companyBulkPayload = [];
  const restoreBulkCompany = patchMethod(PurchaseOrderCompany, "bulkCreate", async (payload) => {
    companyBulkPayload = payload;
    return payload;
  });
  const restoreCompanyFindAll = patchMethod(Company, "findAll", async () => [
    { id: 4, company_name: "C4" },
    { id: 8, company_name: "C8" },
  ]);
  const restorePoCompanyFindAll = patchMethod(PurchaseOrderCompany, "findAll", async () => [
    { company_id: 4 },
    { company_id: 8 },
  ]);

  t.after(() => {
    restoreTransaction();
    restoreCreatePO();
    restoreItemsFindAll();
    restoreCreateItem();
    restoreBulkCompany();
    restoreCompanyFindAll();
    restorePoCompanyFindAll();
  });

  const req = {
    body: {
      po_number: "PO-01",
      project_name: "Project Atlas",
      po_date: "2026-02-10",
      vendor: 3,
      delivery_date: "2026-02-18",
      items: JSON.stringify([
        { item: 10, quantity: 5 },
        { item: 11, quantity: 7 },
      ]),
      companyIds: "[4,8]",
    },
    files: {},
    user: { id: 1, name: "Admin" },
  };
  const res = createMockRes();

  await PoController.createPO(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(createdPoPayload.project_name, "Project Atlas");
  assert.equal(createdItems.length, 2);
  assert.deepEqual(companyBulkPayload, [
    { po_id: 101, company_id: 4 },
    { po_id: 101, company_id: 8 },
  ]);
  assert.equal(tx.committed, true);
});

test("PoController.editPO refreshes item and company mappings", async (t) => {
  const tx = {
    committed: false,
    rolledBack: false,
    async commit() {
      this.committed = true;
    },
    async rollback() {
      this.rolledBack = true;
    },
  };

  const restoreTransaction = patchMethod(
    PurchaseOrder.sequelize,
    "transaction",
    async () => tx
  );

  let updatedPoPayload;
  const poRow = {
    id: 12,
    attachment: null,
    design_copy: null,
    async update(payload) {
      updatedPoPayload = payload;
    },
  };
  const restoreFindByPk = patchMethod(PurchaseOrder, "findByPk", async () => poRow);
  const restoreItemsFindAll = patchMethod(Items, "findAll", async () => [{ id: 9 }]);
  const restoreDestroyItems = patchMethod(PurchaseOrderItem, "destroy", async () => 1);

  const createdItems = [];
  const restoreCreateItem = patchMethod(PurchaseOrderItem, "create", async (payload) => {
    createdItems.push(payload);
    return payload;
  });

  let destroyCompanyWhere;
  const restoreDestroyCompanies = patchMethod(PurchaseOrderCompany, "destroy", async (args) => {
    destroyCompanyWhere = args.where;
    return 1;
  });
  const restorePoCompanyFindAll = patchMethod(PurchaseOrderCompany, "findAll", async () => [
    { company_id: 1 },
    { company_id: 5 },
  ]);
  let bulkCompanyPayload = [];
  const restoreBulkCompanies = patchMethod(PurchaseOrderCompany, "bulkCreate", async (payload) => {
    bulkCompanyPayload = payload;
    return payload;
  });
  const restoreCompanyFindAll = patchMethod(Company, "findAll", async () => [
    { id: 1, company_name: "C1" },
    { id: 5, company_name: "C5" },
  ]);

  t.after(() => {
    restoreTransaction();
    restoreFindByPk();
    restoreItemsFindAll();
    restoreDestroyItems();
    restoreCreateItem();
    restoreDestroyCompanies();
    restorePoCompanyFindAll();
    restoreBulkCompanies();
    restoreCompanyFindAll();
  });

  const req = {
    params: { id: 12 },
    body: {
      po_number: "PO-12",
      project_name: "Project Nova",
      vendor_name: 2,
      po_date: "2026-02-15",
      delivery_date: "2026-02-20",
      items: JSON.stringify([{ itemName: 9, quantity: 22 }]),
      companyIds: "1,5",
    },
    files: {},
  };
  const res = createMockRes();

  await PoController.editPO(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(updatedPoPayload.project_name, "Project Nova");
  assert.equal(createdItems.length, 1);
  assert.deepEqual(destroyCompanyWhere, { po_id: 12 });
  assert.deepEqual(bulkCompanyPayload, [
    { po_id: 12, company_id: 1 },
    { po_id: 12, company_id: 5 },
  ]);
  assert.equal(tx.committed, true);
});

test("PoController.deletePO also clears po-company mappings", async (t) => {
  const tx = {
    committed: false,
    rolledBack: false,
    async commit() {
      this.committed = true;
    },
    async rollback() {
      this.rolledBack = true;
    },
  };

  const restoreTransaction = patchMethod(
    PurchaseOrder.sequelize,
    "transaction",
    async () => tx
  );
  const restoreInspectionFindOne = patchMethod(Inspection, "findOne", async () => null);

  const poRow = { InspectorAssignments: [], async destroy() {} };
  const restoreFindByPk = patchMethod(PurchaseOrder, "findByPk", async () => poRow);
  const restoreDestroyItems = patchMethod(PurchaseOrderItem, "destroy", async () => 1);

  let companyDestroyCalled = false;
  const restoreDestroyCompanies = patchMethod(PurchaseOrderCompany, "destroy", async () => {
    companyDestroyCalled = true;
    return 1;
  });

  t.after(() => {
    restoreTransaction();
    restoreInspectionFindOne();
    restoreFindByPk();
    restoreDestroyItems();
    restoreDestroyCompanies();
  });

  const req = { params: { id: 15 } };
  const res = createMockRes();
  await PoController.deletePO(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(companyDestroyCalled, true);
  assert.equal(tx.committed, true);
});
