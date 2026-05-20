import { Sequelize } from "sequelize";
import {
  Inspection,
  InspectionAssignment,
  InspectionCase,
  PurchaseOrder,
  Vendor,
  PoStage,
  Stage,
  InspectionBatch,
  InspectionEvent,
} from "../Model/index.js";

const { Op } = Sequelize;

function monthRange(monthStr) {
  if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) return null;
  const [y, m] = monthStr.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  return { start, end };
}

export default class DashboardController {
  // ✅ Summary counts (Assigned/InProcess/Completed/Failed/PO This Month + KPIs)
  static async summary(req, res) {
    try {
      const inspectorId = req.user.id;
      const range = monthRange(req.query.month);

      const assignments = await InspectionAssignment.findAll({
        where: {
          inspector_id: inspectorId,
          status: { [Op.in]: ["active", "rescheduled"] },
        },
        include: [{ model: InspectionCase, as: "Case", attributes: ["id", "po_id"] }],
      });

      const assignmentIds = assignments.map(a => a.id);

      const started = await Inspection.findAll({
        where: {
          assignment_id: { [Op.in]: assignmentIds.length ? assignmentIds : [0] },
          status: { [Op.in]: ["in_progress", "rescheduled", "completed"] },
        },
        attributes: ["assignment_id"],
        raw: true,
      });
      const startedSet = new Set(started.map(x => x.assignment_id));
      const assignedCount = assignments.filter(a => !startedSet.has(a.id)).length;

      const inProcessCount = await Inspection.count({
        where: { inspector_id: inspectorId, status: { [Op.in]: ["in_progress", "rescheduled"] } },
      });

      const completedCount = await Inspection.count({
        where: { inspector_id: inspectorId, status: "completed" },
      });

      const inspIds = (await Inspection.findAll({
        where: { inspector_id: inspectorId },
        attributes: ["id"],
        raw: true,
      })).map(x => x.id);

      const failedCount = await InspectionBatch.count({
        where: { inspection_id: { [Op.in]: inspIds.length ? inspIds : [0] }, result: "fail" },
      });

      const poIds = assignments.map(a => a.Case?.po_id).filter(Boolean);
      const poWhere = { id: { [Op.in]: poIds.length ? poIds : [0] } };
      if (range) poWhere.createdAt = { [Op.gte]: range.start, [Op.lt]: range.end };

      const poThisMonthCount = await PurchaseOrder.count({ where: poWhere });

      // KPIs
      const now = new Date();
      const next7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const upcoming7Count = await InspectionAssignment.count({
        where: {
          inspector_id: inspectorId,
          status: { [Op.in]: ["active", "rescheduled"] },
          scheduled_on: { [Op.gte]: now, [Op.lte]: next7 },
        },
      });

      const overdueCount = await InspectionAssignment.count({
        where: {
          inspector_id: inspectorId,
          status: { [Op.in]: ["active", "rescheduled"] },
          scheduled_on: { [Op.lt]: now },
        },
      });

      return res.json({
        success: true,
        month: req.query.month ?? null,
        counts: {
          assigned: assignedCount,
          in_process: inProcessCount,
          completed: completedCount,
          failed: failedCount,
          po_this_month: poThisMonthCount,
          upcoming_7_days: upcoming7Count,
          overdue: overdueCount,
        },
      });
    } catch (e) {
      console.error("dashboard summary:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  // ✅ Upcoming (slider)
  static async upcoming(req, res) {
    try {
      const inspectorId = req.user.id;
      const days = Math.min(Number(req.query.days || 7), 30);
      const now = new Date();
      const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      const rows = await InspectionAssignment.findAll({
        where: {
          inspector_id: inspectorId,
          status: { [Op.in]: ["active", "rescheduled"] },
          scheduled_on: { [Op.gte]: now, [Op.lte]: end },
        },
        include: [
          {
            model: InspectionCase,
            as: "Case",
            include: [
              {
                association: "PurchaseOrder",
                attributes: ["id", "po_number"],
                include: [{ model: Vendor, attributes: ["vendor_name"] }],
              },
            ],
          },
        ],
        order: [["scheduled_on", "ASC"]],
        limit: 20,
      });

      const data = rows.map(r => ({
        assignment_id: r.id,
        po_id: r.Case?.PurchaseOrder?.id ?? null,
        po_number: r.Case?.PurchaseOrder?.po_number ?? "",
        vendor: r.Case?.PurchaseOrder?.Vendor?.vendor_name ?? "",
        scheduled_on: r.scheduled_on,
        status: r.status,
      }));

      return res.json({ success: true, data });
    } catch (e) {
      console.error("dashboard upcoming:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  // ✅ In-process PO list
  static async inProcessPos(req, res) {
    return DashboardController._poListByInspectionStatus(req, res, ["in_progress", "rescheduled"]);
  }

  // ✅ Completed PO list
  static async completedPos(req, res) {
    return DashboardController._poListByInspectionStatus(req, res, ["completed"]);
  }

  // ✅ Failed PO list (by failed batches)
  static async failedPos(req, res) {
    try {
      const inspectorId = req.user.id;

      const myInsps = await Inspection.findAll({
        where: { inspector_id: inspectorId },
        include: [
          {
            model: PurchaseOrder,
            attributes: ["id", "po_number"],
            include: [{ model: Vendor, attributes: ["vendor_name"] }],
          },
          {
            model: InspectionBatch,
            where: { result: "fail" },
            required: true,
            attributes: ["id", "result"],
          },
        ],
        order: [["updatedAt", "DESC"]],
        limit: 100,
      });

      const data = myInsps.map(ins => ({
        inspection_id: ins.id,
        po_id: ins.PurchaseOrder?.id ?? null,
        po_number: ins.PurchaseOrder?.po_number ?? "",
        vendor: ins.PurchaseOrder?.Vendor?.vendor_name ?? "",
        updated_at: ins.updatedAt,
      }));

      return res.json({ success: true, data });
    } catch (e) {
      console.error("dashboard failedPos:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  static async _poListByInspectionStatus(req, res, statuses) {
    try {
      const inspectorId = req.user.id;

      const inspections = await Inspection.findAll({
        where: { inspector_id: inspectorId, status: { [Op.in]: statuses } },
        include: [
          {
            model: PurchaseOrder,
            attributes: ["id", "po_number"],
            include: [{ model: Vendor, attributes: ["vendor_name"] }],
          },
        ],
        order: [["updatedAt", "DESC"]],
        limit: 100,
      });

      const inspectionIds = inspections.map(i => i.id);

      const stages = await PoStage.findAll({
        where: { inspection_id: { [Op.in]: inspectionIds.length ? inspectionIds : [0] } },
        include: [{ model: Stage, attributes: ["id", "stage_name"] }],
        attributes: ["inspection_id", "status"],
        raw: false,
      });

      const map = new Map();
      for (const s of stages) {
        const k = s.inspection_id;
        const obj = map.get(k) || { total: 0, completed: 0 };
        obj.total += 1;
        if (s.status === "completed") obj.completed += 1;
        map.set(k, obj);
      }

      const data = inspections.map(ins => {
        const p = map.get(ins.id) || { total: 0, completed: 0 };
        const progress = p.total ? Math.round((p.completed / p.total) * 100) : 0;
        return {
          inspection_id: ins.id,
          po_id: ins.PurchaseOrder?.id ?? null,
          po_number: ins.PurchaseOrder?.po_number ?? "",
          vendor: ins.PurchaseOrder?.Vendor?.vendor_name ?? "",
          progress_percent: progress,
          updated_at: ins.updatedAt,
        };
      });

      return res.json({ success: true, data });
    } catch (e) {
      console.error("dashboard _poListByInspectionStatus:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  // ✅ PO-wise steps/stages
  static async poSteps(req, res) {
    try {
      const poId = Number(req.params.poId);
      if (!poId) return res.status(400).json({ success: false, message: "Invalid poId" });

      const latest = await Inspection.findOne({
        where: { po_id: poId },
        include: [{ model: PoStage, include: [{ model: Stage, attributes: ["stage_name"] }] }],
        order: [["createdAt", "DESC"]],
      });

      if (!latest) return res.json({ success: true, inspection_id: null, data: [] });

      const list = (latest.PoStages || latest.po_stages || []).map(ps => ({
        po_stage_id: ps.id,
        stage_name: ps.Stage?.stage_name ?? "",
        status: ps.status,
        result: ps.result ?? null,
        updated_at: ps.updatedAt,
      }));

      return res.json({ success: true, inspection_id: latest.id, data: list });
    } catch (e) {
      console.error("dashboard poSteps:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  // ✅ Recent Activity
  static async activityLog(req, res) {
    try {
      const inspectorId = req.user.id;
      const limit = Math.min(Number(req.query.limit || 15), 50);

      const events = await InspectionEvent.findAll({
        where: { actor_user_id: inspectorId },
        order: [["createdAt", "DESC"]],
        limit,
      });

      const data = events.map(e => ({
        id: e.id,
        type: e.type,
        title: e.note || e.type,
        inspection_id: e.inspection_id,
        assignment_id: e.assignment_id,
        po_id: e.po_id,
        created_at: e.createdAt,
      }));

      return res.json({ success: true, activities: data });
    } catch (e) {
      console.error("activityLog:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
}
