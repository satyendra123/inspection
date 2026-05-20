import test from "node:test";
import assert from "node:assert/strict";

import AdminReportController from "../Controller/AdminReportController.js";
import {
  Inspection,
  InspectionAssignment,
  PoStage,
  StageTest,
} from "../Model/index.js";
import { createMockRes } from "./helpers/mockExpress.js";
import { patchMethod } from "./helpers/patch.js";

const createRequest = (query = {}) => ({
  query,
  headers: {},
  protocol: "http",
  get: () => "localhost:8060",
});

const buildMockData = () => {
  const inspections = [
    {
      id: 101,
      po_id: 11,
      assignment_id: 201,
      purchase_order_item_id: 301,
      schedule_datetime: new Date("2026-03-10T10:00:00Z"),
      status: "completed",
      remarks: "final ok",
      createdAt: new Date("2026-03-10T09:00:00Z"),
      updatedAt: new Date("2026-03-10T12:00:00Z"),
      PO: {
        id: 11,
        po_number: "PO-001",
        project_name: "Alpha",
        po_date: "2026-03-01",
        delivery_date: "2026-03-15",
        attachment: null,
        design_copy: null,
        Vendor: { vendor_name: "Vendor A" },
        Project: { project_name: "Alpha", Company: { company_name: "Company A" } },
        Companies: [],
      },
      Inspector: { name: "Inspector 1", email: "inspector1@example.com" },
      PoItem: {
        id: 301,
        quantity: 5,
        po_id: 11,
        Item: { item_name: "Valve" },
      },
    },
    {
      id: 102,
      po_id: 12,
      assignment_id: 202,
      purchase_order_item_id: 302,
      schedule_datetime: new Date("2026-03-12T11:00:00Z"),
      status: "rejected",
      remarks: "failed item",
      createdAt: new Date("2026-03-12T10:00:00Z"),
      updatedAt: new Date("2026-03-12T13:00:00Z"),
      PO: {
        id: 12,
        po_number: "PO-002",
        project_name: "Beta",
        po_date: "2026-03-05",
        delivery_date: "2026-03-18",
        attachment: null,
        design_copy: null,
        Vendor: { vendor_name: "Vendor B" },
        Project: { project_name: "Beta", Company: { company_name: "Company B" } },
        Companies: [],
      },
      Inspector: { name: "Inspector 2", email: "inspector2@example.com" },
      PoItem: {
        id: 302,
        quantity: 3,
        po_id: 12,
        Item: { item_name: "Pump" },
      },
    },
  ];

  const assignments = [
    {
      id: 201,
      scheduled_on: new Date("2026-03-10T10:00:00Z"),
      status: "completed",
      createdAt: new Date("2026-03-10T08:00:00Z"),
      updatedAt: new Date("2026-03-10T12:00:00Z"),
    },
    {
      id: 202,
      scheduled_on: new Date("2026-03-12T11:00:00Z"),
      status: "completed",
      createdAt: new Date("2026-03-12T09:00:00Z"),
      updatedAt: new Date("2026-03-12T13:00:00Z"),
    },
  ];

  const stages = [
    {
      id: 401,
      inspection_id: 101,
      item_id: 301,
      stage_id: 1,
      status: "completed",
      batch_id: 501,
      createdAt: new Date("2026-03-10T10:30:00Z"),
      updatedAt: new Date("2026-03-10T11:45:00Z"),
      Stage: { id: 1, stage_name: "Stage 1" },
      StageInspector: { name: "Stage Inspector 1", email: "stage1@example.com" },
    },
    {
      id: 402,
      inspection_id: 102,
      item_id: 302,
      stage_id: 2,
      status: "rework",
      batch_id: 502,
      createdAt: new Date("2026-03-12T11:15:00Z"),
      updatedAt: new Date("2026-03-12T12:40:00Z"),
      Stage: { id: 2, stage_name: "Stage 2" },
      StageInspector: { name: "Stage Inspector 2", email: "stage2@example.com" },
    },
  ];

  const stageTests = [
    {
      id: 601,
      po_stage_id: 401,
      inspection_id: 101,
      item_id: 301,
      test_id: 701,
      quantity: 5,
      result: "pass",
      status: "completed",
      remark: "ok",
      description: "",
      gps_location: "",
      documents: ["uploads/report/pass.jpg"],
      createdAt: new Date("2026-03-10T10:40:00Z"),
      updatedAt: new Date("2026-03-10T11:30:00Z"),
      Test: { id: 701, test_name: "Visual Test" },
    },
    {
      id: 602,
      po_stage_id: 402,
      inspection_id: 102,
      item_id: 302,
      test_id: 702,
      quantity: 3,
      result: "fail",
      status: "rework",
      remark: "surface crack",
      description: "crack found",
      gps_location: "plant area",
      documents: ["uploads/report/fail.jpg"],
      createdAt: new Date("2026-03-12T11:25:00Z"),
      updatedAt: new Date("2026-03-12T12:15:00Z"),
      Test: { id: 702, test_name: "Pressure Test" },
    },
  ];

  return { inspections, assignments, stages, stageTests };
};

test("AdminReportController.list returns completed and failed reports with stage history", async (t) => {
  const data = buildMockData();

  const restoreInspectionFindAll = patchMethod(Inspection, "findAll", async () => data.inspections);
  const restoreAssignmentFindAll = patchMethod(InspectionAssignment, "findAll", async () => data.assignments);
  const restorePoStageFindAll = patchMethod(PoStage, "findAll", async () => data.stages);
  const restoreStageTestFindAll = patchMethod(StageTest, "findAll", async () => data.stageTests);

  t.after(() => {
    restoreInspectionFindAll();
    restoreAssignmentFindAll();
    restorePoStageFindAll();
    restoreStageTestFindAll();
  });

  const req = createRequest();
  const res = createMockRes();

  await AdminReportController.list(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.length, 2);
  assert.equal(res.body.summary.completedReports, 1);
  assert.equal(res.body.summary.failedReports, 1);
  assert.equal(res.body.data[0].stages.length > 0, true);
  assert.equal(res.body.data.some((row) => row.report_bucket === "completed"), true);
  assert.equal(res.body.data.some((row) => row.report_bucket === "failed"), true);
});

test("AdminReportController.export supports detailed completed pdf for a selected item", async (t) => {
  const data = buildMockData();

  const restoreInspectionFindAll = patchMethod(Inspection, "findAll", async () => data.inspections);
  const restoreAssignmentFindAll = patchMethod(InspectionAssignment, "findAll", async () => data.assignments);
  const restorePoStageFindAll = patchMethod(PoStage, "findAll", async () => data.stages);
  const restoreStageTestFindAll = patchMethod(StageTest, "findAll", async () => data.stageTests);

  t.after(() => {
    restoreInspectionFindAll();
    restoreAssignmentFindAll();
    restorePoStageFindAll();
    restoreStageTestFindAll();
  });

  const req = createRequest({
    format: "pdf",
    scope: "detailed",
    inspection_id: "101",
    purchase_order_item_id: "301",
    project_name: "Alpha",
    date_from: "2026-03-10",
    date_to: "2026-03-10",
  });

  const headers = {};
  const res = {
    ...createMockRes(),
    setHeader(name, value) {
      headers[name] = value;
      return this;
    },
  };

  await AdminReportController.export(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(Buffer.isBuffer(res.body));
  assert.equal(String(headers["Content-Type"]), "application/pdf");
  assert.match(String(headers["Content-Disposition"]), /completed-report/i);
});
