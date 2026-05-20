import {
    PurchaseOrder,
    InspectionAssignment,
    InspectionAssignmentItem,
    PurchaseOrderItem,
    InspectionCase,
    Vendor,
    Items,
    Inspection,
    PoStage,
    User,
    Company,
    PurchaseOrderCompany,
    Project
} from "../Model/index.js";
import { Op } from "sequelize";

const normalizeIdArray = (value) => {
    if (Array.isArray(value)) {
        return value
            .map((entry) => {
                if (typeof entry === "object" && entry !== null) {
                    return Number(entry.value ?? entry.id ?? entry.company_id);
                }
                return Number(entry);
            })
            .filter(Boolean);
    }
    if (typeof value !== "string" || !value.trim()) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed)
            ? parsed
                .map((entry) => {
                    if (typeof entry === "object" && entry !== null) {
                        return Number(entry.value ?? entry.id ?? entry.company_id);
                    }
                    return Number(entry);
                })
                .filter(Boolean)
            : [];
    } catch (e) {
        return value.split(",").map((id) => Number(id.trim())).filter(Boolean);
    }
};

const pickCompanyInput = (body = {}) =>
    body.companyIds ??
    body.company_ids ??
    body.companies ??
    body.company ??
    body.company_id ??
    body.companyId ??
    body.selected_companies ??
    body.selectedCompanies;

const pickDesignRef = (body = {}) =>
    body.design_ref ??
    body.designRef ??
    body.design_reference ??
    body.designReference ??
    null;

const pickProjectName = (body = {}) =>
    body.project_name ??
    body.projectName ??
    body.project ??
    null;

const pickProjectId = (body = {}) =>
    body.project_id ??
    body.projectId ??
    body.project ??
    null;

const pickItemId = (item = {}) =>
    item.item_id ??
    item.item ??
    item.itemName ??
    item.value ??
    item.id ??
    null;

const parseStoredFiles = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((entry) => String(entry || "").trim()).filter(Boolean);

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return [];
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed.map((entry) => String(entry || "").trim()).filter(Boolean);
            }
        } catch (error) {
            // fall back to legacy single-path string
        }
        return [trimmed];
    }

    return [String(value).trim()].filter(Boolean);
};

const serializeStoredFiles = (files = []) => {
    const normalized = files.map((entry) => String(entry || "").trim()).filter(Boolean);
    if (normalized.length === 0) return null;
    if (normalized.length === 1) return normalized[0];
    return JSON.stringify(normalized);
};

const mergeStoredFiles = (...collections) => {
    const merged = [];
    const seen = new Set();

    collections.flat().forEach((entry) => {
        const normalized = String(entry || "").trim();
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        merged.push(normalized);
    });

    return merged;
};

const toPoUploadPath = (file) => (
    file?.filename ? `uploads/po/${file.filename}` : null
);

const normalizePoPayload = (poLike) => {
    const poData = typeof poLike?.toJSON === "function" ? poLike.toJSON() : { ...(poLike || {}) };
    const attachments = parseStoredFiles(poData.attachment);
    const designCopies = parseStoredFiles(poData.design_copy);

    return {
        ...poData,
        attachment: attachments[0] || null,
        attachments,
        design_copy: designCopies[0] || null,
        design_copies: designCopies,
    };
};

const resolveAppBaseUrl = (req) => {
    const envBase = String(process.env.APP_URL || "").trim().replace(/\/+$/, "");
    if (envBase) return envBase;

    if (!req) return "";

    const forwardedProto = String(req.headers?.["x-forwarded-proto"] || "")
        .split(",")[0]
        .trim();
    const protocol = forwardedProto || req.protocol || "http";
    const host = typeof req.get === "function" ? req.get("host") : req.headers?.host;
    if (!host) return "";
    return `${protocol}://${host}`.replace(/\/+$/, "");
};

const buildLogoUrl = (logoPath, req) => {
    if (!logoPath) return null;
    const clean = `/${String(logoPath).replace(/^\/+/, "")}`;
    const base = resolveAppBaseUrl(req);
    return base ? `${base}${clean}` : clean;
};

const serializeCompanyProfile = (company, req) => {
    if (!company) return null;

    const data = typeof company.toJSON === "function" ? company.toJSON() : { ...company };
    const full_address = [
        data.registered_address,
        data.city,
        data.state,
        data.pin,
    ]
        .filter((value) => value && String(value).trim())
        .join(", ");

    return {
        ...data,
        logo_url: buildLogoUrl(data.logo, req),
        full_address,
    };
};

const normalizePoItems = (items = []) =>
    items
        .map((item) => {
            const itemId = Number(pickItemId(item));
            const quantity = Number(item.quantity);
            if (!itemId || !Number.isFinite(quantity) || quantity <= 0) return null;
            return { item_id: itemId, quantity };
        })
        .filter(Boolean);

const validateItemIds = async (normalizedItems) => {
    const itemIds = [...new Set(normalizedItems.map((x) => x.item_id))];
    if (itemIds.length === 0) return { ok: false, missing: [] };

    const existing = await Items.findAll({
        where: { id: { [Op.in]: itemIds } },
        attributes: ["id"],
    });
    const existingIds = new Set(existing.map((x) => Number(x.id)));
    const missing = itemIds.filter((id) => !existingIds.has(Number(id)));
    return { ok: missing.length === 0, missing };
};

const resolvePoItemIdsForEdit = async (normalizedItems, poId, transaction) => {
    const itemIds = [...new Set(normalizedItems.map((x) => Number(x.item_id)))];
    if (itemIds.length === 0) return normalizedItems;

    const existingMasterItems = await Items.findAll({
        where: { id: { [Op.in]: itemIds } },
        attributes: ["id"],
        transaction,
    });
    const existingMasterIds = new Set(existingMasterItems.map((x) => Number(x.id)));
    const missingFromMaster = itemIds.filter((id) => !existingMasterIds.has(id));
    if (missingFromMaster.length === 0) return normalizedItems;

    // Frontend may send purchase_order_items.id in item_id while editing.
    const poItems = await PurchaseOrderItem.findAll({
        where: {
            po_id: poId,
            id: { [Op.in]: missingFromMaster },
        },
        attributes: ["id", "item_id"],
        transaction,
    });
    const poItemMap = new Map(poItems.map((x) => [Number(x.id), Number(x.item_id)]));

    return normalizedItems.map((x) => ({
        ...x,
        item_id: poItemMap.get(Number(x.item_id)) || Number(x.item_id),
    }));
};
/**
 * CREATE PO (Create Page)
 */
class PoController {
    static createPO = async (req, res) => {
        const t = await PurchaseOrder.sequelize.transaction();
        try {
            const {
                po_number,
                po_date,
                vendor,
                delivery_date,
                items,
                companyIds
            } = req.body;
            console.log(items)
            const parsedItems = Array.isArray(items) ? items : JSON.parse(items || "[]");
            const normalizedItems = normalizePoItems(parsedItems);
            const parsedCompanyIds = [...new Set(
                normalizeIdArray(pickCompanyInput({ ...req.body, companyIds }))
            )];
            const projectId = Number(pickProjectId(req.body) || 0) || null;

            const selectedCompanyId = parsedCompanyIds.length ? parsedCompanyIds[0] : null;

            if (!selectedCompanyId) {
                await t.rollback();
                return res.status(400).json({ status: "failed", msg: "At least one company is required" });
            }
            if (normalizedItems.length === 0) {
                await t.rollback();
                return res.status(400).json({ status: "failed", msg: "At least one valid PO item is required" });
            }
            const itemCheck = await validateItemIds(normalizedItems);
            if (!itemCheck.ok) {
                await t.rollback();
                return res.status(400).json({
                    status: "failed",
                    msg: "Invalid item_id(s) in items payload",
                    missing_item_ids: itemCheck.missing,
                });
            }

            let projectName = pickProjectName(req.body);
            if (projectId) {
                const project = await Project.findByPk(projectId, { transaction: t });
                if (!project) {
                    await t.rollback();
                    return res.status(400).json({ status: "failed", msg: "Invalid project_id" });
                }
                if (!parsedCompanyIds.includes(Number(project.company_id))) {
                    await t.rollback();
                    return res.status(400).json({ status: "failed", msg: "Project does not belong to selected companies" });
                }
                projectName = project.project_name;
            }

            const po = await PurchaseOrder.create({
                po_number,
                vendor_id: vendor,
                po_date,
                delivery_date,
                attachment: serializeStoredFiles(
                    (req.files?.attachment || []).map(toPoUploadPath).filter(Boolean)
                ),

                design_copy: serializeStoredFiles(
                    (req.files?.design_copy || []).map(toPoUploadPath).filter(Boolean)
                ),
                design_ref: pickDesignRef(req.body),
                project_name: projectName,
                project_id: projectId,
                created_by: req.user.id,
                created_by_name: req.user.name,
                updated_by: req.user.id,
                updated_by_name: req.user.name,
                }, { transaction: t });

            for (const item of normalizedItems) {
                await PurchaseOrderItem.create({
                    po_id: po.id,
                    item_id: item.item_id,
                    quantity: item.quantity
                }, { transaction: t });
            }

            if (parsedCompanyIds.length > 0) {
                await PurchaseOrderCompany.bulkCreate(
                    parsedCompanyIds.map((company_id) => ({
                        po_id: po.id,
                        company_id,
                    })),
                    { transaction: t }
                );
            }

            const selectedCompanies = parsedCompanyIds.length
                ? await Company.findAll({
                    where: { id: { [Op.in]: parsedCompanyIds } },
                    attributes: ["id", "company_name"],
                    transaction: t,
                })
                : [];

            await t.commit();
            const poData = normalizePoPayload(po);
            res.status(201).json({
                status: "success",
                data: {
                    ...poData,
                    company_id: selectedCompanyId || null,
                    company_name: selectedCompanies[0]?.company_name || "",
                    company_ids: parsedCompanyIds,
                    company_names: selectedCompanies.map((c) => c.company_name).join(", "),
                    companies: selectedCompanies,
                },
            });

        } catch (err) {
            await t.rollback();
            res.status(500).json({ message: err.message });
        }
    };

    /**
     * PO LIST (Table Page)
     */
    // Assuming:
    // PurchaseOrder hasMany POItem
    static getPOList = async (req, res) => {
        try {
            const data = await PurchaseOrder.findAll({
                attributes: {
                    exclude: ["project_id"],
                },
                order: [["createdAt", "DESC"]],
                include: [
                    {
                        model: PurchaseOrderItem,
                        attributes: ["id", "quantity"],
                        include: [
                            { model: Items, attributes: ["id", "item_name"] }
                        ]
                    },
                    {
                        model: Inspection,     // inspector assignment table
                        attributes: ["id"],
                        required: false,       // LEFT JOIN
                    },
                    {
                        model: Vendor,
                    },
                    {
                        model: Company,
                        as: "Companies",
                        through: { attributes: [] },
                        attributes: ["id", "company_name"],
                    },
                ],
            });

            const result = data.map((po) => {
                const poJson = normalizePoPayload(po);
                const companies = poJson.Companies || [];
                return {
                    ...poJson,
                    company_id: companies[0]?.id || null,
                    company_name: companies[0]?.company_name || "",
                    company_ids: companies.map((c) => c.id),
                    company_names: companies.map((c) => c.company_name).join(", "),
                    companies,
                    project_id: null,
                    project_name: poJson.project_name || "",
                    isInspectorAssigned: poJson.Inspections && poJson.Inspections.length > 0,
                };
            });

            res.json(result);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Failed to fetch purchase orders" });
        }
    };

    static getPOView = async (req, res) => {
        try {
            const poId = Number(req.params.id);

            const po = await PurchaseOrder.findByPk(poId, {
                include: [
                    { model: Vendor, attributes: ["id", "vendor_name"] },
                    {
                        model: Company,
                        as: "Companies",
                        through: { attributes: [] },
                        attributes: ["id", "company_name"],
                    },
                    {
                        model: Project,
                        attributes: ["id", "project_name"],
                    },
                ],
            });

            if (!po) {
                return res.status(404).json({ message: "PO not found" });
            }

            const items = await PurchaseOrderItem.findAll({
                where: { po_id: poId },
                include: [{ model: Items }],
                order: [["id", "ASC"]],
            });

            // ✅ Case + active assignments + active assignment items
            const caseRow = await InspectionCase.findOne({
                where: { po_id: poId },
                include: [
                    {
                        model: InspectionAssignment,
                        as: "Assignments",
                        required: false,
                        where: { status: { [Op.in]: ["active", "rescheduled", "assigned"] } }, // show only active-like
                        include: [
                            { model: User, as: "Inspector", attributes: ["id", "name", "email"] },
                            {
                                model: InspectionAssignmentItem,
                                as: "AssignmentItems",
                                required: false,
                                where: { status: "active" },
                                attributes: ["purchase_order_item_id"],
                            },
                        ],
                    },
                ],
                order: [[{ model: InspectionAssignment, as: "Assignments" }, "createdAt", "DESC"]],
            });

            // ✅ Flatten normalized assignments for frontend map
            const poItemIds = items.map((item) => Number(item.id)).filter(Boolean);
            const latestInspectionByItemId = new Map();
            if (poItemIds.length > 0) {
                const inspectionWhere = {
                    purchase_order_item_id: { [Op.in]: poItemIds },
                    ...(caseRow?.id ? { case_id: caseRow.id } : { po_id: poId }),
                };
                const latestInspections = await Inspection.findAll({
                    where: inspectionWhere,
                    include: [
                        {
                            model: User,
                            as: "Inspector",
                            required: false,
                            attributes: ["id", "name", "email"],
                        },
                    ],
                    order: [["updatedAt", "DESC"], ["id", "DESC"]],
                });

                for (const inspectionRow of latestInspections) {
                    const poItemId = Number(inspectionRow.purchase_order_item_id || 0);
                    if (!poItemId || latestInspectionByItemId.has(poItemId)) continue;
                    latestInspectionByItemId.set(poItemId, inspectionRow);
                }
            }

            const assignments = [];
            const assList = caseRow?.Assignments || [];

            for (const a of assList) {
                const inspectorName =
                    a?.Inspector?.name || a?.Inspector?.email || `Inspector #${a.inspector_id}`;

                const ai = a.AssignmentItems || [];
                for (const row of ai) {
                    const poItemId = Number(row.purchase_order_item_id);
                    if (!poItemId) continue;
                    const latestInspection = latestInspectionByItemId.get(poItemId) || null;
                    const latestInspectorName =
                        latestInspection?.Inspector?.name ||
                        latestInspection?.Inspector?.email ||
                        (Number(latestInspection?.inspector_id || 0) > 0
                            ? `Inspector #${latestInspection.inspector_id}`
                            : "");

                    assignments.push({
                        assignment_id: a.id,
                        inspection_id: Number(latestInspection?.id || 0) || undefined,
                        case_id: a.case_id,
                        item_id: poItemId, // ✅ IMPORTANT: keep key name item_id for old frontend compatibility
                        inspector_id: Number(latestInspection?.inspector_id || a.inspector_id),
                        inspector_name: latestInspectorName || inspectorName,
                        schedule_datetime: latestInspection?.schedule_datetime || a.scheduled_on,
                        inspection_location: latestInspection?.inspection_location || a.inspection_location,
                        remarks: latestInspection?.remarks || a.remarks,
                        status: latestInspection?.status || a.status,
                    });
                }
            }

            return res.json({
                po: {
                    ...normalizePoPayload(po),
                    company_id: (po.Companies || [])[0]?.id || null,
                    company_name: (po.Companies || [])[0]?.company_name || "",
                    company_ids: (po.Companies || []).map((c) => c.id),
                    company_names: (po.Companies || []).map((c) => c.company_name).join(", "),
                    companies: po.Companies || [],
                    project_id: po.Project?.id || null,
                    project_name: po.Project?.project_name || po.project_name || null,
                },
                items,
                assignments,
            });
        } catch (err) {
            console.error("getPOView error:", err);
            return res.status(500).json({ message: "Failed to fetch PO view" });
        }
    };

    static getPOCompanyProfile = async (req, res) => {
        try {
            const poId = Number(req.params.poId);
            if (!poId) {
                return res.status(400).json({ status: "failed", msg: "Invalid poId" });
            }

            const companyAttributes = [
                "id",
                "company_name",
                "registered_address",
                "city",
                "state",
                "pin",
                "cin_no",
                "gstin_no",
                "contact_no",
                "email_id",
                "website",
                "logo",
                "status",
            ];

            const po = await PurchaseOrder.findByPk(poId, {
                attributes: ["id", "po_number", "project_name", "po_date", "delivery_date"],
                include: [
                    {
                        model: Company,
                        as: "Companies",
                        through: { attributes: [] },
                        attributes: companyAttributes,
                    },
                    {
                        model: Project,
                        attributes: ["id", "project_name", "company_id"],
                        include: [
                            {
                                model: Company,
                                attributes: companyAttributes,
                            },
                        ],
                    },
                ],
            });

            if (!po) {
                return res.status(404).json({ status: "failed", msg: "PO not found" });
            }

            const companyCandidates = [];
            if (po.Project?.Company) {
                companyCandidates.push(po.Project.Company);
            }
            if (Array.isArray(po.Companies)) {
                companyCandidates.push(...po.Companies);
            }

            const seenCompanyIds = new Set();
            const companies = companyCandidates
                .map((company) => serializeCompanyProfile(company, req))
                .filter((company) => {
                    if (!company) return false;
                    const key = Number(company.id || 0) || company.company_name || company.logo || JSON.stringify(company);
                    if (seenCompanyIds.has(key)) return false;
                    seenCompanyIds.add(key);
                    return true;
                });

            return res.status(200).json({
                status: "success",
                data: {
                    po_id: po.id,
                    po_number: po.po_number,
                    project_name: po.Project?.project_name || po.project_name || null,
                    po_date: po.po_date,
                    delivery_date: po.delivery_date,
                    company: companies[0] || null,
                    companies,
                },
            });
        } catch (error) {
            return res.status(500).json({
                status: "failed",
                msg: "Server error",
                error: error.message,
            });
        }
    };

    static editPO = async (req, res) => {
        const t = await PurchaseOrder.sequelize.transaction();
        try {
            const poId = req.params.id;
            const {
                po_number,
                vendor_name,
                vendor,
                po_date,
                delivery_date,
                items, // [{ itemName, quantity }]
                companyIds
            } = req.body;
            const incomingProjectId = Number(pickProjectId(req.body) || 0) || null;

            // Find existing PO
            const po = await PurchaseOrder.findByPk(poId);
            if (!po) {
                return res.status(404).json({ status: "fail", message: "PO not found" });
            }

            // Use old file if new one not uploaded
            const existingAttachments = parseStoredFiles(req.body.existing_attachments);
            const incomingAttachments = (req.files?.attachment || [])
                .map(toPoUploadPath)
                .filter(Boolean);
            const attachmentFile = serializeStoredFiles(
                mergeStoredFiles(
                    existingAttachments.length > 0 ? existingAttachments : parseStoredFiles(po.attachment),
                    incomingAttachments,
                )
            );
            const existingDesignCopies = parseStoredFiles(req.body.existing_design_copies);
            const incomingDesignCopies = (req.files?.design_copy || [])
                .map(toPoUploadPath)
                .filter(Boolean);
            const normalizedDesignCopyFile = serializeStoredFiles(
                mergeStoredFiles(
                    existingDesignCopies.length > 0 ? existingDesignCopies : parseStoredFiles(po.design_copy),
                    incomingDesignCopies,
                )
            );

            // Update PO fields
            await po.update(
                {
                    po_number,
                    vendor_id: vendor_name ?? vendor ?? po.vendor_id,
                    po_date,
                    delivery_date,
                    attachment: attachmentFile,
                    design_copy: normalizedDesignCopyFile,
                    design_ref: pickDesignRef(req.body) ?? po.design_ref,
                    project_name: pickProjectName(req.body) ?? po.project_name,
                    project_id: incomingProjectId || po.project_id || null,
                },
                { transaction: t }
            );

            // Update items
            const parsedItems = Array.isArray(items) ? items : (() => {
                if (typeof items === "string" && items.trim()) {
                    try {
                        return JSON.parse(items);
                    } catch (e) {
                        return [];
                    }
                }
                return [];
            })();
            let normalizedItems = normalizePoItems(parsedItems);
            normalizedItems = await resolvePoItemIdsForEdit(normalizedItems, poId, t);

            if (normalizedItems.length > 0) {
                const itemCheck = await validateItemIds(normalizedItems);
                if (!itemCheck.ok) {
                    await t.rollback();
                    return res.status(400).json({
                        status: "failed",
                        msg: "Invalid item_id(s) in items payload",
                        missing_item_ids: itemCheck.missing,
                    });
                }
                // Remove existing items
                await PurchaseOrderItem.destroy({ where: { po_id: poId }, transaction: t });

                // Add new/updated items
                for (const item of normalizedItems) {
                    await PurchaseOrderItem.create(
                        {
                            po_id: po.id,
                            item_id: item.item_id,
                            quantity: item.quantity,
                        },
                        { transaction: t }
                    );
                }
            }

            const selectedCompanyInput = pickCompanyInput({ ...req.body, companyIds });
            if (selectedCompanyInput !== undefined) {
                const parsedCompanyIds = [...new Set(normalizeIdArray(selectedCompanyInput))];
                const selectedCompanyId = parsedCompanyIds.length ? parsedCompanyIds[0] : null;

                const projectId = Number(pickProjectId(req.body) || 0) || null;
                if (projectId) {
                    const project = await Project.findByPk(projectId, { transaction: t });
                    if (!project) {
                        await t.rollback();
                        return res.status(400).json({ status: "failed", msg: "Invalid project_id" });
                    }
                    if (
                        parsedCompanyIds.length > 0 &&
                        !parsedCompanyIds.includes(Number(project.company_id))
                    ) {
                        await t.rollback();
                        return res.status(400).json({ status: "failed", msg: "Project does not belong to selected companies" });
                    }
                    await po.update(
                        { project_name: project.project_name, project_id: project.id },
                        { transaction: t }
                    );
                }

                await PurchaseOrderCompany.destroy({ where: { po_id: poId }, transaction: t });
                if (parsedCompanyIds.length > 0) {
                    await PurchaseOrderCompany.bulkCreate(
                        parsedCompanyIds.map((company_id) => ({
                            po_id: poId,
                            company_id,
                        })),
                        { transaction: t }
                    );
                }
            }

            const poCompanyRows = await PurchaseOrderCompany.findAll({
                where: { po_id: poId },
                attributes: ["company_id"],
                transaction: t,
            });
            const finalCompanyIds = poCompanyRows.map((x) => Number(x.company_id));
            const selectedCompanies = finalCompanyIds.length
                ? await Company.findAll({
                    where: { id: { [Op.in]: finalCompanyIds } },
                    attributes: ["id", "company_name"],
                    transaction: t,
                })
                : [];

            await t.commit();
            const poData = normalizePoPayload(po);
            return res.status(200).json({
                status: "success",
                data: {
                    ...poData,
                    company_id: finalCompanyIds[0] || null,
                    company_name: selectedCompanies[0]?.company_name || "",
                    company_ids: finalCompanyIds,
                    company_names: selectedCompanies.map((c) => c.company_name).join(", "),
                    companies: selectedCompanies,
                },
            });
        } catch (err) {
            await t.rollback();
            console.error(err);
            return res.status(500).json({ status: "error", message: err.message });
        }
    };
    static deletePO = async (req, res) => {
        const t = await PurchaseOrder.sequelize.transaction();
        try {
            const { id } = req.params;
            const assigned = await Inspection.findOne({ where: { po_id: id } });

            if (assigned) {
                return res.status(400).json({
                    message: "PO already assigned to inspector, cannot delete",
                });
            }
            // 1️⃣ Find the PO
            const po = await PurchaseOrder.findByPk(id, {
                include: [
                    {
                        model: PurchaseOrderItem,
                    },
                    {
                        model: Inspection, // Assuming you have this table
                        where: { po_id: id },
                        required: false, // include even if no assignment
                    },
                ],
                transaction: t,
            });

            if (!po) {
                await t.rollback();
                return res.status(404).json({ status: "error", message: "PO not found" });
            }

            // 2️⃣ Check if inspector is assigned
            if (po.InspectorAssignments && po.InspectorAssignments.length > 0) {
                await t.rollback();
                return res.status(400).json({
                    status: "error",
                    message: "Cannot delete PO. Inspector(s) already assigned.",
                });
            }

            // 3️⃣ Delete PO items first
            await PurchaseOrderItem.destroy({ where: { po_id: id }, transaction: t });
            await PurchaseOrderCompany.destroy({ where: { po_id: id }, transaction: t });

            // 4️⃣ Delete PO itself
            await po.destroy({ transaction: t });

            await t.commit();
            res.status(200).json({ status: "success", message: "PO deleted successfully" });

        } catch (err) {
            await t.rollback();
            console.error("Delete PO Error:", err);
            res.status(500).json({ status: "error", message: err.message });
        }
    };

    // controllers/poController.js
}
export default PoController;
