import { Sequelize } from "sequelize";
import {
    Inspection,
    InspectionBatch,
    InspectionEvent,
    InspectionAssignmentItem,
    PoStage,
    Stage,
    StageTest,
    Test,
    PurchaseOrder,
    PurchaseOrderItem,
    Items,
    Vendor,
    User,
} from "../Model/index.js";

const { Op } = Sequelize;
const completedInspectionStatuses = ["completed"];

const assignmentItemStatusPriority = {
    active: 0,
    rescheduled: 1,
    assigned: 2,
    in_process: 3,
    completed: 4,
    reassigned: 5,
    cancelled: 6,
};

const getAssignmentItemPriority = (status) => {
    const key = String(status || "").trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(assignmentItemStatusPriority, key)
        ? assignmentItemStatusPriority[key]
        : 99;
};

const pickPreferredAssignmentItem = (rows = []) => {
    let best = null;
    for (const row of rows) {
        if (!row) continue;
        const poItemId = Number(row.purchase_order_item_id || 0) || null;
        if (!poItemId) continue;

        if (!best) {
            best = row;
            continue;
        }

        const bestPriority = getAssignmentItemPriority(best.status);
        const nextPriority = getAssignmentItemPriority(row.status);
        if (nextPriority < bestPriority) {
            best = row;
            continue;
        }

        if (nextPriority === bestPriority) {
            const bestUpdatedAt = best.updatedAt ? new Date(best.updatedAt).getTime() : 0;
            const rowUpdatedAt = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
            if (rowUpdatedAt > bestUpdatedAt) {
                best = row;
            }
        }
    }
    return best;
};

const getPoItemName = (poItem) => poItem?.Item?.item_name || poItem?.Items?.item_name || null;

const listStatusAliases = {
    pending: ["pending"],
    assigned: ["assigned", "active"],
    in_progress: ["in_progress", "in_process", "assigned", "active", "rescheduled"],
    in_process: ["in_process", "in_progress", "assigned", "active", "rescheduled"],
    rescheduled: ["rescheduled"],
    completed: completedInspectionStatuses,
    cancelled: ["cancelled"],
    rejected: ["rejected"],
    failed: ["failed"],
    rework: ["rework"],
};

const resolveInspectionStatuses = (rawStatus) => {
    const parts = String(rawStatus || "")
        .split(",")
        .map((x) => String(x || "").trim().toLowerCase())
        .filter(Boolean);
    if (!parts.length) return [];

    const resolved = new Set();
    for (const part of parts) {
        const mapped = listStatusAliases[part];
        if (Array.isArray(mapped) && mapped.length) {
            for (const item of mapped) resolved.add(item);
        } else {
            resolved.add(part);
        }
    }
    return [...resolved];
};

const normalizeResultValue = (value) => String(value || "").trim().toLowerCase();
const normalizeStatusValue = (value) => String(value || "").trim().toLowerCase();

const getInspectionResultKey = (inspectionId, poItemId) => {
    const normalizedInspectionId = Number(inspectionId || 0) || null;
    if (!normalizedInspectionId) return null;
    const normalizedPoItemId = Number(poItemId || 0) || 0;
    return `${normalizedInspectionId}:${normalizedPoItemId}`;
};

const summarizeStageTestResults = (stageTests = []) => {
    const byKey = new Map();
    const byInspectionId = new Map();

    for (const row of stageTests) {
        const inspectionId = Number(row.inspection_id || 0) || null;
        if (!inspectionId) continue;

        const poItemId = Number(row.item_id || 0) || 0;
        const key = getInspectionResultKey(inspectionId, poItemId);
        const normalizedResult = normalizeResultValue(row.result);
        const buildSummary = () => ({
            latest_result: normalizedResult || null,
            has_rejected_test: normalizedResult === "reject" || normalizedResult === "rejected",
            has_failed_test: normalizedResult === "fail" || normalizedResult === "failed",
        });

        if (key) {
            if (!byKey.has(key)) {
                byKey.set(key, buildSummary());
            } else if (normalizedResult) {
                const existing = byKey.get(key);
                if (!existing.latest_result) {
                    byKey.set(key, buildSummary());
                }
            }
        }

        if (!byInspectionId.has(inspectionId)) {
            byInspectionId.set(inspectionId, buildSummary());
        } else if (normalizedResult) {
            const existing = byInspectionId.get(inspectionId);
            if (!existing.latest_result) {
                byInspectionId.set(inspectionId, buildSummary());
            }
        }
    }

    return { byKey, byInspectionId };
};

const summarizeBatchStatuses = (batches = []) => {
    const byKey = new Map();
    const byInspectionId = new Map();

    for (const row of batches) {
        const inspectionId = Number(row.inspection_id || 0) || null;
        if (!inspectionId) continue;

        const status = normalizeStatusValue(row.status) || null;
        const poItemId = Number(row.purchase_order_item_id || 0) || 0;
        const key = getInspectionResultKey(inspectionId, poItemId);

        if (key && !byKey.has(key)) {
            byKey.set(key, status);
        }

        if (!byInspectionId.has(inspectionId)) {
            byInspectionId.set(inspectionId, status);
        }
    }

    return { byKey, byInspectionId };
};

export default class EnterpriseAdminInspectionController {

    // GET /admin/inspections
    static async list(req, res) {
        try {
            const page = Math.max(Number(req.query.page || 1), 1);
            const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
            const offset = (page - 1) * limit;

            const status = req.query.status || null;
            const inspector_id = req.query.inspector_id ? Number(req.query.inspector_id) : null;
            const vendor_id = req.query.vendor_id ? Number(req.query.vendor_id) : null;
            const search = (req.query.search || "").trim(); // po_number search
            const from = req.query.from ? new Date(req.query.from) : null;
            const to = req.query.to ? new Date(req.query.to) : null;

            const where = {};
            const resolvedStatuses = resolveInspectionStatuses(status);
            if (resolvedStatuses.length === 1) {
                where.status = resolvedStatuses[0];
            } else if (resolvedStatuses.length > 1) {
                where.status = { [Op.in]: resolvedStatuses };
            }
            if (inspector_id) where.inspector_id = inspector_id;
            if (from || to) {
                where.schedule_datetime = {};
                if (from) where.schedule_datetime[Op.gte] = from;
                if (to) where.schedule_datetime[Op.lte] = to;
            }

            const poWhere = {};
            if (search) poWhere.po_number = { [Op.like]: `%${search}%` };
            if (vendor_id) poWhere.vendor_id = vendor_id;

            const include = [
                {
                    model: PurchaseOrder,
                    as: "PO",    // ✅ NO as
                    attributes: ["id", "po_number"],
                    where: Object.keys(poWhere).length ? poWhere : undefined,
                    required: Object.keys(poWhere).length > 0,
                    include: [
                        {
                            model: Vendor,
                            attributes: ["id", "vendor_name"],
                        },
                    ],
                },
                {
                    model: User,
                    as: "Inspector",        // ✅ this one is correct (index.js me hai)
                    attributes: ["id", "name", "email"],
                },
                {
                    model: PurchaseOrderItem,
                    as: "PoItem",           // ✅ this one is also defined in index.js
                    attributes: ["id", "quantity"],
                    include: [
                        {
                            model: Items,
                            attributes: ["id", "item_name"],
                        },
                    ],
                },
            ];
            console.log("AdminInspection list - where:", where, "poWhere:", include[0]);
            const result = await Inspection.findAndCountAll({
                where,
                include,
                order: [["updatedAt", "DESC"]],
                limit,
                offset,
            });
            console.log("AdminInspection list - result count:", result.count);

            const rows = Array.isArray(result.rows) ? result.rows : [];
            const cancelReasonInspectionIds = [
                ...new Set(
                    rows
                        .filter((row) => ["cancelled", "rejected"].includes(String(row?.status || "").toLowerCase()))
                        .map((row) => Number(row.id))
                        .filter(Boolean)
                ),
            ];

            const latestCancelReasonByInspectionId = new Map();
            if (cancelReasonInspectionIds.length > 0) {
                const cancelEvents = await InspectionEvent.findAll({
                    where: {
                        inspection_id: { [Op.in]: cancelReasonInspectionIds },
                        type: { [Op.in]: ["cancel_item", "reject_item", "cancel"] },
                    },
                    attributes: ["inspection_id", "note", "createdAt"],
                    order: [["createdAt", "DESC"]],
                    raw: true,
                });

                for (const event of cancelEvents) {
                    const inspectionId = Number(event.inspection_id || 0);
                    if (!inspectionId || latestCancelReasonByInspectionId.has(inspectionId)) continue;
                    latestCancelReasonByInspectionId.set(inspectionId, event);
                }
            }

            const missingItemAssignmentIds = [
                ...new Set(
                    rows
                        .filter((row) => !row?.PoItem && Number(row?.assignment_id || 0) > 0)
                        .map((row) => Number(row.assignment_id))
                ),
            ];

            const fallbackPoItemByAssignmentId = new Map();
            if (missingItemAssignmentIds.length > 0) {
                const assignmentItems = await InspectionAssignmentItem.findAll({
                    where: { assignment_id: { [Op.in]: missingItemAssignmentIds } },
                    attributes: ["assignment_id", "purchase_order_item_id", "status", "updatedAt"],
                });

                const groupedByAssignment = new Map();
                for (const ai of assignmentItems) {
                    const assignmentId = Number(ai.assignment_id || 0);
                    if (!assignmentId) continue;
                    if (!groupedByAssignment.has(assignmentId)) groupedByAssignment.set(assignmentId, []);
                    groupedByAssignment.get(assignmentId).push(ai);
                }

                const preferredByAssignmentId = new Map();
                const preferredPoItemIds = [];
                for (const assignmentId of missingItemAssignmentIds) {
                    const preferred = pickPreferredAssignmentItem(groupedByAssignment.get(assignmentId) || []);
                    const poItemId = Number(preferred?.purchase_order_item_id || 0) || null;
                    if (!poItemId) continue;
                    preferredByAssignmentId.set(assignmentId, poItemId);
                    preferredPoItemIds.push(poItemId);
                }

                if (preferredPoItemIds.length > 0) {
                    const fallbackPoItems = await PurchaseOrderItem.findAll({
                        where: { id: { [Op.in]: [...new Set(preferredPoItemIds)] } },
                        attributes: ["id", "quantity"],
                        include: [
                            {
                                model: Items,
                                attributes: ["id", "item_name"],
                                required: false,
                            },
                        ],
                    });

                    const fallbackPoItemById = new Map(
                        fallbackPoItems.map((poItem) => [Number(poItem.id), poItem])
                    );

                    for (const [assignmentId, poItemId] of preferredByAssignmentId.entries()) {
                        const resolvedPoItem = fallbackPoItemById.get(Number(poItemId));
                        if (resolvedPoItem) {
                            fallbackPoItemByAssignmentId.set(Number(assignmentId), resolvedPoItem);
                        }
                    }
                }
            }

            const resolvedRowMeta = rows.map((r) => {
                const assignmentId = Number(r.assignment_id || 0) || null;
                const resolvedPoItem =
                    r.PoItem || fallbackPoItemByAssignmentId.get(Number(assignmentId || 0)) || null;
                const resolvedPoItemId =
                    Number(r.purchase_order_item_id || resolvedPoItem?.id || 0) || null;

                return {
                    assignmentId,
                    resolvedPoItem,
                    resolvedPoItemId,
                    resolvedItemName: getPoItemName(resolvedPoItem),
                };
            });

            const inspectionIds = [
                ...new Set(
                    rows
                        .map((row) => Number(row.id || 0) || null)
                        .filter(Boolean)
                ),
            ];

            let stageResultSummaryByKey = new Map();
            let stageResultSummaryByInspectionId = new Map();
            let batchStatusByKey = new Map();
            let batchStatusByInspectionId = new Map();

            if (inspectionIds.length > 0) {
                const latestStageTests = await StageTest.findAll({
                    where: {
                        inspection_id: { [Op.in]: inspectionIds },
                    },
                    attributes: ["id", "inspection_id", "item_id", "result", "updatedAt", "createdAt"],
                    order: [["updatedAt", "DESC"], ["id", "DESC"]],
                    raw: true,
                });

                const stageTestSummaries = summarizeStageTestResults(latestStageTests);
                stageResultSummaryByKey = stageTestSummaries.byKey;
                stageResultSummaryByInspectionId = stageTestSummaries.byInspectionId;

                const latestBatches = await InspectionBatch.findAll({
                    where: {
                        inspection_id: { [Op.in]: inspectionIds },
                    },
                    attributes: ["id", "inspection_id", "purchase_order_item_id", "status", "updatedAt", "createdAt"],
                    order: [["updatedAt", "DESC"], ["id", "DESC"]],
                    raw: true,
                });

                const batchSummaries = summarizeBatchStatuses(latestBatches);
                batchStatusByKey = batchSummaries.byKey;
                batchStatusByInspectionId = batchSummaries.byInspectionId;
            }

            return res.json({
                success: true,
                page,
                limit,
                total: result.count,
                data: rows.map((r, index) => {
                    const meta = resolvedRowMeta[index] || {};
                    const assignmentId = meta.assignmentId || null;
                    const resolvedPoItemId = meta.resolvedPoItemId || null;
                    const resolvedPoItem = meta.resolvedPoItem || null;
                    const resolvedItemName = meta.resolvedItemName || null;
                    const normalizedStatus = String(r.status || "").toLowerCase();
                    const latestCancelEvent = latestCancelReasonByInspectionId.get(Number(r.id)) || null;
                    const cancelReason =
                        normalizedStatus === "cancelled" || normalizedStatus === "rejected"
                            ? (latestCancelEvent?.note || r.remarks || (normalizedStatus === "rejected" ? "Item rejected" : "Item cancelled"))
                            : null;
                    const resultKey = getInspectionResultKey(r.id, resolvedPoItemId);
                    const resultSummary =
                        (resultKey ? stageResultSummaryByKey.get(resultKey) : null) ||
                        stageResultSummaryByInspectionId.get(Number(r.id)) ||
                        null;
                    const latestResult = resultSummary?.latest_result || null;
                    const batchStatusKey = getInspectionResultKey(r.id, resolvedPoItemId);
                    const latestBatchStatus =
                        (batchStatusKey ? batchStatusByKey.get(batchStatusKey) : null) ||
                        batchStatusByInspectionId.get(Number(r.id)) ||
                        null;

                    return {
                        id: r.id,
                        status: r.status,
                        batch_status: latestBatchStatus,
                        schedule_datetime: r.schedule_datetime,
                        inspection_location: r.inspection_location,
                        remarks: r.remarks || null,
                        cancel_reason: cancelReason,
                        assignment_id: assignmentId,
                        purchase_order_item_id: resolvedPoItemId,
                        result: latestResult,
                        latest_result: latestResult,
                        has_rejected_test: resultSummary?.has_rejected_test === true,
                        has_failed_test: resultSummary?.has_failed_test === true,
                        po: r.PO
                            ? {
                                id: r.PO.id,
                                po_number: r.PO.po_number,
                                vendor_name: r.PO.Vendor?.vendor_name || null,
                            }
                            : null,
                        inspector: r.Inspector
                            ? {
                                id: r.Inspector.id,
                                name: r.Inspector.name || r.Inspector.email,
                            }
                            : null,
                        item: resolvedPoItemId
                            ? {
                                id: resolvedPoItemId,
                                item_name: resolvedItemName || `Item #${resolvedPoItemId}`,
                                quantity: resolvedPoItem?.quantity ?? null,
                            }
                            : null,
                    };
                })

            });
        } catch (e) {
            console.error("AdminInspection list:", e);
            return res.status(500).json({ success: false, message: "Server error" });
        }
    }

    // GET /admin/inspections/:id
    static async detail(req, res) {
        try {
            const inspectionId = Number(req.params.id);
            if (!inspectionId) {
                return res.status(400).json({ success: false, message: "Invalid id" });
            }

            const inspection = await Inspection.findByPk(inspectionId, {
                include: [
                    {
                        model: PurchaseOrder,
                        as: "PO",   // ✅ MUST MATCH index.js
                        attributes: ["id", "po_number"],
                        include: [
                            {
                                model: Vendor,
                                attributes: ["id", "vendor_name"],
                            },
                        ],
                    },
                    {
                        model: User,
                        as: "Inspector",
                        attributes: ["id", "name", "email"],
                    },
                    {
                        model: PurchaseOrderItem,
                        as: "PoItem",
                        attributes: ["id", "quantity"],
                        include: [
                            {
                                model: Items,
                                attributes: ["id", "item_name"],
                            },
                        ],
                    },
                ],
            });

            if (!inspection) {
                return res.status(404).json({ success: false, message: "Not found" });
            }

            let resolvedPoItem = inspection.PoItem || null;
            let resolvedPoItemId =
                Number(inspection.purchase_order_item_id || resolvedPoItem?.id || 0) || null;

            if (!resolvedPoItemId && Number(inspection.assignment_id || 0) > 0) {
                const assignmentItems = await InspectionAssignmentItem.findAll({
                    where: { assignment_id: Number(inspection.assignment_id) },
                    attributes: ["assignment_id", "purchase_order_item_id", "status", "updatedAt"],
                });
                const preferred = pickPreferredAssignmentItem(assignmentItems);
                resolvedPoItemId = Number(preferred?.purchase_order_item_id || 0) || null;
            }

            if (!resolvedPoItem && resolvedPoItemId) {
                resolvedPoItem = await PurchaseOrderItem.findByPk(resolvedPoItemId, {
                    attributes: ["id", "quantity"],
                    include: [
                        {
                            model: Items,
                            attributes: ["id", "item_name"],
                            required: false,
                        },
                    ],
                });
            }
            const resolvedItemName = getPoItemName(resolvedPoItem);
            const normalizedInspectionStatus = String(inspection.status || "").toLowerCase();
            let cancelReason = null;
            if (["cancelled", "rejected"].includes(normalizedInspectionStatus)) {
                const latestCancelEvent = await InspectionEvent.findOne({
                    where: {
                        inspection_id: Number(inspection.id),
                        type: { [Op.in]: ["cancel_item", "reject_item", "cancel"] },
                    },
                    attributes: ["note"],
                    order: [["createdAt", "DESC"]],
                });

                cancelReason =
                    latestCancelEvent?.note ||
                    inspection.remarks ||
                    (normalizedInspectionStatus === "rejected" ? "Item rejected" : "Item cancelled");
            }

            const batches = await InspectionBatch.findAll({
                where: { inspection_id: inspectionId },
                order: [["id", "DESC"]],
            });
            const stages = await PoStage.findAll({
                where: { inspection_id: inspectionId },
                include: [
                    {
                        model: Stage,
                        attributes: ["id", "stage_name"],
                    },
                    {
                        model: User,
                        as: "StageInspector",
                        attributes: ["id", "name", "email"],
                    },
                ],
                order: [["id", "ASC"]],
            });



            const tests = await StageTest.findAll({
                where: { inspection_id: inspectionId },
                include: [
                    {
                        model: Test,
                        attributes: ["id", "test_name"],
                    },
                    {
                        model: PoStage,
                        attributes: ["id", "stage_id"],
                        include: [
                            {
                                model: User,
                                as: "StageInspector",
                                attributes: ["id", "name"],
                            },
                            {
                                model: Stage,
                                attributes: ["id", "stage_name"],
                            },
                        ],
                    },
                ],
                order: [["id", "ASC"]],
            });


            const events = await InspectionEvent.findAll({
                where: { inspection_id: inspectionId },
                order: [["createdAt", "DESC"]],
            });

            return res.json({
                success: true,
                inspection: {
                    id: inspection.id,
                    status: inspection.status,
                    schedule_datetime: inspection.schedule_datetime,
                    inspection_location: inspection.inspection_location,
                    remarks: inspection.remarks || null,
                    cancel_reason: cancelReason,
                    assignment_id: Number(inspection.assignment_id || 0) || null,
                    purchase_order_item_id: resolvedPoItemId,

                    po: inspection.PO
                        ? {
                            id: inspection.PO.id,
                            po_number: inspection.PO.po_number,
                            vendor_name: inspection.PO.Vendor?.vendor_name || null,
                        }
                        : null,

                    inspector: inspection.Inspector
                        ? {
                            id: inspection.Inspector.id,
                            name: inspection.Inspector.name || inspection.Inspector.email,
                        }
                        : null,

                    item: resolvedPoItemId
                        ? {
                            id: resolvedPoItemId,
                            item_name: resolvedItemName || `Item #${resolvedPoItemId}`,
                            quantity: resolvedPoItem?.quantity ?? null,
                        }
                        : null,
                },
                batches,
                stages,
                tests,
                events,
            });

        } catch (e) {
            console.error("AdminInspection detail:", e);
            return res.status(500).json({ success: false, message: "Server error" });
        }
    }

}
