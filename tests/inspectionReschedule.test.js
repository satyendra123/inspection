import test from "node:test";
import assert from "node:assert/strict";

import inspectionsController from "../Controller/inspectionController.js";
import {
  Inspection,
  InspectionAssignment,
  InspectionAssignmentItem,
  InspectionBatch,
  InspectionEvent,
} from "../Model/index.js";
import { createMockRes } from "./helpers/mockExpress.js";
import { patchMethod } from "./helpers/patch.js";

const createTransactionStub = () => ({
  committed: false,
  rolledBack: false,
  async commit() {
    this.committed = true;
  },
  async rollback() {
    this.rolledBack = true;
  },
});

const createMutableRow = (seed) => ({
  ...seed,
  async update(payload) {
    Object.assign(this, payload);
    return this;
  },
});

test("rescheduleInspection keeps inspection and assignment schedule in sync", async (t) => {
  const tx = createTransactionStub();
  const restoreTransaction = patchMethod(Inspection.sequelize, "transaction", async () => tx);

  const currentSchedule = new Date("2026-03-09T09:00:00.000Z");
  const nextScheduleIso = "2026-03-12T14:30:00.000Z";

  const inspectionRow = createMutableRow({
    id: 101,
    po_id: 77,
    case_id: 501,
    assignment_id: 202,
    purchase_order_item_id: 303,
    inspector_id: 19,
    status: "assigned",
    schedule_datetime: currentSchedule,
    remarks: "Old schedule",
  });

  const assignmentRow = createMutableRow({
    id: 202,
    case_id: 501,
    inspector_id: 19,
    status: "assigned",
    scheduled_on: currentSchedule,
    remarks: "Old schedule",
    ended_at: new Date("2026-03-01T00:00:00.000Z"),
    ended_by: 9,
  });

  const restoreInspectionFindByPk = patchMethod(Inspection, "findByPk", async () => inspectionRow);
  const restoreAssignmentFindByPk = patchMethod(InspectionAssignment, "findByPk", async () => assignmentRow);
  const restoreAssignmentItemUpdate = patchMethod(InspectionAssignmentItem, "update", async () => [1]);
  const restoreInspectionBatchUpdate = patchMethod(InspectionBatch, "update", async () => [0]);

  let loggedEvent = null;
  const restoreInspectionEventCreate = patchMethod(InspectionEvent, "create", async (payload) => {
    loggedEvent = payload;
    return payload;
  });

  t.after(() => {
    restoreTransaction();
    restoreInspectionFindByPk();
    restoreAssignmentFindByPk();
    restoreAssignmentItemUpdate();
    restoreInspectionBatchUpdate();
    restoreInspectionEventCreate();
  });

  const req = {
    body: {
      inspection_id: 101,
      schedule_datetime: nextScheduleIso,
      reason: "Vendor requested a new slot",
    },
    user: { id: 44 },
  };
  const res = createMockRes();

  await inspectionsController.rescheduleInspection(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, "success");
  assert.equal(tx.committed, true);
  assert.equal(tx.rolledBack, false);
  assert.equal(inspectionRow.status, "rescheduled");
  assert.equal(new Date(inspectionRow.schedule_datetime).toISOString(), nextScheduleIso);
  assert.equal(assignmentRow.status, "rescheduled");
  assert.equal(new Date(assignmentRow.scheduled_on).toISOString(), nextScheduleIso);
  assert.equal(assignmentRow.ended_at, null);
  assert.equal(assignmentRow.ended_by, null);
  assert.equal(loggedEvent.type, "reschedule_item");
  assert.equal(new Date(loggedEvent.after.schedule_datetime).toISOString(), nextScheduleIso);
});

test("reschedulePageInspection updates assignment and linked inspections to the same schedule", async (t) => {
  const tx = createTransactionStub();
  const restoreTransaction = patchMethod(InspectionAssignment.sequelize, "transaction", async () => tx);

  const currentSchedule = new Date("2026-03-10T08:00:00.000Z");
  const nextScheduleIso = "2026-03-18T16:45:00.000Z";

  const assignmentRow = createMutableRow({
    id: 902,
    case_id: 12,
    inspector_id: 66,
    status: "assigned",
    scheduled_on: currentSchedule,
    remarks: "Keep vendor informed",
    ended_at: new Date("2026-03-05T00:00:00.000Z"),
    ended_by: 5,
  });

  const linkedInspections = [
    createMutableRow({
      id: 801,
      assignment_id: 902,
      inspector_id: 11,
      status: "assigned",
      schedule_datetime: currentSchedule,
      remarks: null,
    }),
    createMutableRow({
      id: 802,
      assignment_id: 902,
      inspector_id: 11,
      status: "in_progress",
      schedule_datetime: currentSchedule,
      remarks: "Existing note",
    }),
  ];

  const restoreAssignmentFindByPk = patchMethod(InspectionAssignment, "findByPk", async () => assignmentRow);
  const restoreInspectionFindAll = patchMethod(Inspection, "findAll", async () => linkedInspections);
  const restoreAssignmentItemUpdate = patchMethod(InspectionAssignmentItem, "update", async () => [2]);

  let eventPayload = null;
  const restoreInspectionEventCreate = patchMethod(InspectionEvent, "create", async (payload) => {
    eventPayload = payload;
    return payload;
  });

  t.after(() => {
    restoreTransaction();
    restoreAssignmentFindByPk();
    restoreInspectionFindAll();
    restoreAssignmentItemUpdate();
    restoreInspectionEventCreate();
  });

  const req = {
    body: {
      assignment_id: 902,
      schedule_datetime: nextScheduleIso,
      reason: "Site team requested postponement",
    },
    user: { id: 101 },
  };
  const res = createMockRes();

  await inspectionsController.reschedulePageInspection(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(tx.committed, true);
  assert.equal(assignmentRow.status, "rescheduled");
  assert.equal(new Date(assignmentRow.scheduled_on).toISOString(), nextScheduleIso);
  assert.equal(assignmentRow.ended_at, null);
  assert.equal(assignmentRow.ended_by, null);

  for (const inspectionRow of linkedInspections) {
    assert.equal(inspectionRow.status, "rescheduled");
    assert.equal(new Date(inspectionRow.schedule_datetime).toISOString(), nextScheduleIso);
    assert.equal(inspectionRow.inspector_id, assignmentRow.inspector_id);
    assert.equal(inspectionRow.assignment_id, assignmentRow.id);
  }

  assert.equal(eventPayload.type, "reschedule");
  assert.equal(new Date(eventPayload.after.scheduled_on).toISOString(), nextScheduleIso);
});
