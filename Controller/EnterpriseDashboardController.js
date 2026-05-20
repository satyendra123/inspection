import { Sequelize, literal } from "sequelize";
import {
  Inspection,
  InspectionAssignment,
  InspectionAssignmentItem,
  InspectionCase,
  InspectionEvent,
  InspectionBatch,
  PurchaseOrder,
  Vendor,
  User,
} from "../Model/index.js";

const { Op } = Sequelize;
const completedInspectionStatuses = ["completed", "rejected"];

function parseMonthRange(monthStr) {
  // monthStr: "YYYY-MM" (optional)
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth(); // 0-based

  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    y = Number(monthStr.slice(0, 4));
    m = Number(monthStr.slice(5, 7)) - 1;
  }

  const start = new Date(y, m, 1, 0, 0, 0);
  const end = new Date(y, m + 1, 1, 0, 0, 0);
  return { start, end };
}

function titleFromEvent(ev) {
  const type = ev?.type || "activity";
  const note = ev?.note ? ` - ${ev.note}` : "";
  switch (type) {
    case "assign_inspector": return `Inspector assigned${note}`;
    case "reassign_inspector": return `Reassigned${note}`;
    case "start_inspection": return `Inspection started${note}`;
    case "submit_test": return `Test submitted${note}`;
    case "cancel_inspection": return `Inspection cancelled${note}`;
    case "reschedule_inspection": return `Inspection rescheduled${note}`;
    default: return `${type}${note}`;
  }
}

export default class EnterpriseDashboardController {

  // =========================
  // INSPECTOR DASHBOARD
  // =========================
static async inspectorSummary(req, res) {
  try {
    const inspectorId = req.user.id;
    const permissions = req.user.permissions || [];
    const { month } = req.query;
    const { start, end } = parseMonthRange(month);

    /* ---------------- ACTIVE ASSIGNMENTS ---------------- */
    const assignments = await InspectionAssignment.findAll({
      where: {
        inspector_id: inspectorId,
        status: { [Op.in]: ["active", "rescheduled"] },
      },
      attributes: ["id", "case_id"],
      include: [
        {
          model: InspectionCase,
          as: "Case",
          attributes: ["id"],
          include: [
            {
              model: PurchaseOrder,
              as: "PurchaseOrder",
              attributes: ["id", "createdAt"],
            },
          ],
        },
      ],
    });

    const assignmentIds = assignments.map(a => a.id);

    /* ---------------- ASSIGNED ITEMS ---------------- */
    const assignedItems = assignmentIds.length
      ? await InspectionAssignmentItem.findAll({
          where: {
            assignment_id: { [Op.in]: assignmentIds },
            status: "active",
          },
          attributes: ["purchase_order_item_id"],
          raw: true,
        })
      : [];

    const itemIds = [...new Set(assignedItems.map(i => i.purchase_order_item_id))];

    /* ---------------- INSPECTIONS ---------------- */
    const inspections = (assignmentIds.length && itemIds.length)
      ? await Inspection.findAll({
          where: {
            assignment_id: { [Op.in]: assignmentIds },
            purchase_order_item_id: { [Op.in]: itemIds },
          },
          attributes: ["id", "status"],
          raw: true,
        })
      : [];

    const statusCount = {
      in_process: 0,
      completed: 0,
      cancelled: 0,
    };

    inspections.forEach(i => {
      if (["in_progress", "rescheduled"].includes(i.status)) statusCount.in_process++;
      else if (i.status === "completed") statusCount.completed++;
      else if (i.status === "cancelled") statusCount.cancelled++;
    });

    const assignedNotStarted =
      itemIds.length - (statusCount.in_process + statusCount.completed + statusCount.cancelled);

    /* ---------------- FAILED INSPECTIONS ---------------- */
    const inspIds = inspections.map(i => i.id);

    const failed = inspIds.length
      ? await InspectionBatch.count({
          distinct: true,
          col: "inspection_id",
          where: {
            inspection_id: { [Op.in]: inspIds },
            result: "fail",
          },
        })
      : 0;

    /* ---------------- PO THIS MONTH ---------------- */
    const poThisMonth = new Set();
    assignments.forEach(a => {
      const createdAt = a?.Case?.PurchaseOrder?.createdAt;
      if (createdAt && createdAt >= start && createdAt < end) {
        poThisMonth.add(a.Case.PurchaseOrder.id);
      }
    });

    /* ---------------- RESPONSE ---------------- */
    return res.json({
      success: true,
      cards: [
        {
          key: "assigned",
          title: "Assigned Items",
          value: Math.max(assignedNotStarted, 0),
          permission: "VIEW_ASSIGNMENTS",
          redirect: "/inspector/assignments",
        },
        {
          key: "in_process",
          title: "In Progress",
          value: statusCount.in_process,
          permission: "VIEW_INSPECTION",
          redirect: "/inspector/current-inspections",
        },
        {
          key: "completed",
          title: "Completed",
          value: statusCount.completed,
          permission: "VIEW_INSPECTION",
          redirect: "/inspector/completed-inspections",
        },
        {
          key: "failed",
          title: "Failed Inspections",
          value: failed,
          permission: "VIEW_REPORTS",
          redirect: "/inspector/reports?filter=failed",
        },
        {
          key: "po_this_month",
          title: "POs This Month",
          value: poThisMonth.size,
          permission: "VIEW_PO",
          redirect: "/purchase-orders?month=current",
        },
      ],
    });

  } catch (e) {
    console.error("inspectorSummary:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}


  static async inspectorUpcoming(req, res) {
    try {
      const inspectorId = req.user.id;

      const limit = Math.min(
        Math.max(parseInt(req.query.limit || "7", 10), 1),
        20
      );

      // TODAY 00:00:00 (important for upcoming)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const upcoming = await InspectionAssignment.findAll({
        where: {
          inspector_id: inspectorId,
          status: { [Op.in]: ["active", "rescheduled"] },
          [Op.and]: [
            literal("DATE(inspection_assignments.scheduled_on) >= CURDATE()")
          ]
        },
        attributes: [
          "id",
          "case_id",
          "scheduled_on",
          "inspection_location",
          "status",
        ],
        include: [
          {
            model: InspectionCase,
            as: "Case",
            required: true,
            attributes: ["id", "po_id"],
            include: [
              {
                model: PurchaseOrder,
                as: "PurchaseOrder",
                required: true,
                attributes: ["id", "po_number"],
                include: [
                  {
                    model: Vendor,
                    required: false,
                    attributes: ["vendor_name"],
                  },
                ],
              },
            ],
          },
        ],
        logging: console.log,
        order: [["scheduled_on", "ASC"]],
        limit,
      });

      const data = upcoming.map(a => ({
        assignment_id: a.id,
        case_id: a.case_id,
        po_id: a.Case?.po_id ?? null,
        po_number: a.Case?.PurchaseOrder?.po_number ?? null,
        vendor_name: a.Case?.PurchaseOrder?.Vendor?.vendor_name ?? "-",
        scheduled_on: a.scheduled_on,
        inspection_location: a.inspection_location,
        status: a.status,
      }));

      return res.json({
        success: true,
        count: data.length,
        data,
      });

    } catch (e) {
      console.error("inspectorUpcoming:", e);
      return res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
  static async inspectorActivity(req, res) {
    try {
      const inspectorId = req.user.id;
      const limit = Math.min(Number(req.query.limit || 15), 100);

      const events = await InspectionEvent.findAll({
        where: { actor_user_id: inspectorId },
        order: [["createdAt", "DESC"]],
        limit,
      });

      return res.json({
        success: true,
        activities: events.map(ev => ({
          id: ev.id,
          type: ev.type,
          title: titleFromEvent(ev),
          note: ev.note || null,
          createdAt: ev.createdAt,
        })),
      });
    } catch (e) {
      console.error("inspectorActivity:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  // =========================
  // ADMIN DASHBOARD
  // =========================
  static async adminSummary(req, res) {
    try {
      const { month } = req.query;
      const { start, end } = parseMonthRange(month);
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const totalPOs = await PurchaseOrder.count();
      const thisMonthPOs = await PurchaseOrder.count({
        where: { createdAt: { [Op.gte]: start, [Op.lt]: end } },
      });

      const activeAssignments = await InspectionAssignment.count({
        where: { status: { [Op.in]: ["active", "rescheduled"] } },
      });

      const inProcess = await Inspection.count({
        where: { status: { [Op.in]: ["in_progress", "rescheduled"] } },
      });

      const completed = await Inspection.count({
        where: { status: { [Op.in]: completedInspectionStatuses } },
      });

      const failedBatches = await InspectionBatch.count({ where: { result: "fail" } });

      const cancelledOrRejected = await Inspection.count({
        where: { status: { [Op.in]: ["cancelled", "rejected"] } },
      });

      const missedSchedule = await Inspection.count({
        where: {
          status: { [Op.in]: ["assigned", "in_progress", "in_process", "rescheduled", "rework", "failed"] },
          schedule_datetime: { [Op.lt]: startOfToday },
        },
      });

      const needsReschedule = Number(cancelledOrRejected || 0) + Number(missedSchedule || 0);

      const recent = await InspectionEvent.findAll({
        order: [["createdAt", "DESC"]],
        limit: 10,
        include: [
          {
            model: User,
            as: "Actor",   // 🔥 THIS IS THE FIX
            attributes: ["id", "name", "email"]
          }
        ]
      });


      return res.json({
        success: true,
        counts: {
          total_pos: totalPOs,
          pos_this_month: thisMonthPOs,
          active_assignments: activeAssignments,
          inspections_in_process: inProcess,
          inspections_completed: completed,
          failed_batches: failedBatches,
          needs_reschedule: needsReschedule,
        },
        recent_activity: recent.map(r => ({
          id: r.id,
          type: r.type,
          title: titleFromEvent(r),
          createdAt: r.createdAt,
          actor: r?.User ? (r.User.name || r.User.email) : null,
        })),
      });
    } catch (e) {
      console.error("adminSummary:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
}
