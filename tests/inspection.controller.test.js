import test from "node:test";
import assert from "node:assert/strict";

import inspectionsController from "../Controller/inspectionController.js";
import { Inspection, Stage, Test } from "../Model/index.js";
import { createMockRes } from "./helpers/mockExpress.js";
import { patchMethod } from "./helpers/patch.js";

test("inspectionController.getInspectorReportFilters includes status-aware filter tree", async (t) => {
  const restoreInspectionFindAll = patchMethod(Inspection, "findAll", async () => ([
    {
      id: 11,
      status: "assigned",
      purchase_order_item_id: 901,
      PurchaseOrder: {
        project_name: "Atlas",
        po_number: "PO-1001",
      },
      PoItem: {
        id: 901,
        Item: {
          item_name: "Valve",
        },
      },
    },
    {
      id: 12,
      status: "rejected",
      purchase_order_item_id: 902,
      PurchaseOrder: {
        project_name: "Atlas",
        po_number: "PO-1002",
      },
      PoItem: {
        id: 902,
        Item: {
          item_name: "Pipe",
        },
      },
    },
  ]));
  const restoreStageFindAll = patchMethod(Stage, "findAll", async () => ([
    { id: 1, stage_name: "Stage 1" },
    { id: 2, stage_name: "Stage 2" },
  ]));
  const restoreTestFindAll = patchMethod(Test, "findAll", async () => ([
    { id: 7, test_name: "Visual Test", stage_id: 1 },
    { id: 8, test_name: "Pressure Test", stage_id: 2 },
  ]));

  t.after(() => {
    restoreInspectionFindAll();
    restoreStageFindAll();
    restoreTestFindAll();
  });

  const req = {
    user: { id: 44 },
    headers: {},
    protocol: "http",
    get: () => "",
  };
  const res = createMockRes();

  await inspectionsController.getInspectorReportFilters(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.meta.filter_options.statuses, ["assigned", "rejected"]);
  assert.equal(res.body.meta.filter_tree.length, 2);
  assert.equal(res.body.meta.filter_tree[0].inspection_status, "assigned");
  assert.equal(res.body.meta.filter_tree[1].inspection_status, "rejected");
});

test("inspectionController.getInspectorReports defaults to all report statuses", async (t) => {
  const restoreInspectionFindAll = patchMethod(Inspection, "findAll", async () => []);
  t.after(() => restoreInspectionFindAll());

  const req = {
    user: { id: 52 },
    query: {},
    headers: {},
    protocol: "http",
    get: () => "",
  };
  const res = createMockRes();

  await inspectionsController.getInspectorReports(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.filters.statuses, [
    "assigned",
    "in_progress",
    "completed",
    "rejected",
    "failed",
    "rework",
    "rescheduled",
    "cancelled",
  ]);
});
