import express from "express";
import multer from "multer";

// Controllers
import AdminController from "../Controller/AdminController.js";
import UserController from "../Controller/UserlogController.js";
import RollController from "../Controller/RollController.js";
import PermissionController from "../Controller/PermmissionController.js";
import CategoryController from "../Controller/CategoryController.js";
import TestController from "../Controller/TestController.js";
import ItemsController from "../Controller/ItemController.js";
import VendorController from "../Controller/VendorController.js";
import StageController from "../Controller/StageController.js";
// Middlewares
import authTokenMiddleware from "../middleware/auth_Admin.js";
import checkPermissionMiddleware, {
  verifyAdminPermission,
} from "../middleware/permission.js";
import PoController from "../Controller/PoController.js";
import inspectionsController from "../Controller/inspectionController.js";
import UnitController from "../Controller/UnitController.js";
import upload from "../middleware/upload.js"
import DashboardController from "../Controller/DashboardController.js";
import EnterpriseDashboardController from "../Controller/EnterpriseDashboardController.js";
import EnterpriseAdminInspectionController from "../Controller/EnterpriseAdminInspectionController.js";
import AdminReportController from "../Controller/AdminReportController.js";
import CompanyController from "../Controller/CompanyController.js";
import ProjectController from "../Controller/ProjectController.js";

const router = express.Router();

/* ===========================================================
   🟦 ADMIN & USER MANAGEMENT
=========================================================== */

router.post("/admin/login", AdminController.UserLogic);
router.get("/user/signout",authTokenMiddleware , AdminController.SignOut);
router.put("/admin/forgot-password", AdminController.changeUserPassword);
router.post(
  "/create/user",
  authTokenMiddleware,
  checkPermissionMiddleware("add_user"),
  AdminController.createUser
);
router.get("/inspectors", authTokenMiddleware, AdminController.getSingleInspectorById);

router.post(
  "/create/byexcel/user",
  authTokenMiddleware,
  checkPermissionMiddleware("create_userbyexcel"),
  AdminController.createByExcelUser
);

router.put(
  "/update-user",
  authTokenMiddleware,
  checkPermissionMiddleware("update_user"),
  AdminController.updateUser
);

router.delete(
  "/delete-user/:user_id",
  authTokenMiddleware,
  checkPermissionMiddleware("delete_user"),
  AdminController.deleteUser
);

router.get(
  "/admin/users",
  authTokenMiddleware,
  checkPermissionMiddleware(["getall_user", "view_user"]),
  AdminController.getAllUsers
);

router.post(
  "/admin/user/assign-role",
  authTokenMiddleware,
  checkPermissionMiddleware("assign_role"),
  AdminController.assignRoleToUser
);
router.get(
  "/get/assignrole/:id",
  authTokenMiddleware,
  checkPermissionMiddleware(["get_assign_role", "get_assignrole"]),
  RollController.getAssignedPermissions
);
router.post(
  "/admin/user/check-permission",
  authTokenMiddleware,
  checkPermissionMiddleware("check_permission"),
  AdminController.checkUserPermission
);

router.get(
  "/user/getUserSpecificList",
  authTokenMiddleware,
  checkPermissionMiddleware("getall_user"),
  AdminController.getAllUsers
);

router.get(
  "/user/getUserSpecificOffice/:officeid",
  authTokenMiddleware,
  AdminController.getAllUsersOfficeby
);
router.get(
  "/user/:id/companies",
  authTokenMiddleware,
  AdminController.getUserCompanies
);

/* ===========================================================
   🟩 ROLE MANAGEMENT
=========================================================== */

router.post(
  "/role/create",
  authTokenMiddleware,
  checkPermissionMiddleware("create_role"),
  RollController.createRole
);

router.put(
  "/role/update",
  authTokenMiddleware,
  checkPermissionMiddleware(["update_assign_role", "update_assignrole"]),
  RollController.updateRolePermissions
);

router.delete(
  "/role/delete/:id",
  authTokenMiddleware,
  checkPermissionMiddleware(["delete_assign_role", "delete_assignrole"]),
  RollController.deleteRole
);

router.get(
  "/role/:id",
  authTokenMiddleware,
  checkPermissionMiddleware(["get_assign_role", "get_assignrole"]),
  RollController.getAssignedPermissions
);

router.get(
  "/roles",
  authTokenMiddleware,
  checkPermissionMiddleware("view_role"),
  RollController.getAllRole
);

router.post(
  "/role/assign-permissions",
  authTokenMiddleware,
  checkPermissionMiddleware(["update_assign_role", "assign-permissions"]),
  RollController.assignPermissionsToRole
);

router.get("/role/users", authTokenMiddleware, RollController.getUserRoles);

router.get(
  "/role/permissions/:role_id",
  authTokenMiddleware,
  checkPermissionMiddleware("view_role"),
  RollController.getRollPermission
);

/* ===========================================================
   🟨 PERMISSION MANAGEMENT
=========================================================== */

router.post(
  "/permission/create",
  authTokenMiddleware,
  verifyAdminPermission,
  PermissionController.createPermission
);

router.get("/permission/all", authTokenMiddleware, PermissionController.getAllPermission);

router.put(
  "/permission/update",
  authTokenMiddleware,
  verifyAdminPermission,
  PermissionController.updatePermission
);

router.delete(
  "/permission/delete",
  authTokenMiddleware,
  verifyAdminPermission,
  PermissionController.deletePermission
);
router.put(
  "/update/assignrole",
  authTokenMiddleware,
  checkPermissionMiddleware(["update_assign_role", "update_assignrole"]),
  RollController.updateRolePermissions
);
router.delete(
  "/delete/assignrole/:id",
  authTokenMiddleware,
  checkPermissionMiddleware(["delete_assign_role", "delete_assignrole"]),
  RollController.deleteRole
);

/* ===========================================================
   🟧 USER LOGS
=========================================================== */

router.get(
  "/user/logs",
  authTokenMiddleware,
  checkPermissionMiddleware("user_log"),
  UserController.getalldata
);

/* ===========================================================
   🟩 CATEGORY CRUD
=========================================================== */

router.post(
  "/categories",
  authTokenMiddleware,
  checkPermissionMiddleware("create_category"),
  CategoryController.create
);
router.get(
  "/categories",
  authTokenMiddleware,
  checkPermissionMiddleware("view_category"),
  CategoryController.getAll
);
router.put(
  "/categories/:id",
  authTokenMiddleware,
  checkPermissionMiddleware("update_category"),
  CategoryController.update
);
router.delete(
  "/categories/:id",
  authTokenMiddleware,
  checkPermissionMiddleware("delete_category"),
  CategoryController.delete
);

/* ===========================================================
   COMPANY CRUD
=========================================================== */
router.post(
  "/companies",
  authTokenMiddleware,
  checkPermissionMiddleware("create_company"),
  upload.single("logo"),
  CompanyController.create
);
router.get(
  "/companies",
  authTokenMiddleware,
  checkPermissionMiddleware("view_company"),
  CompanyController.getAll
);
router.get(
  "/companies/:id",
  authTokenMiddleware,
  checkPermissionMiddleware("view_company"),
  CompanyController.getById
);
router.put(
  "/companies/:id",
  authTokenMiddleware,
  checkPermissionMiddleware("update_company"),
  upload.single("logo"),
  CompanyController.update
);
router.delete(
  "/companies/:id",
  authTokenMiddleware,
  checkPermissionMiddleware("delete_company"),
  CompanyController.delete
);

/* ===========================================================
   PROJECT CRUD
=========================================================== */
router.post(
  "/projects",
  authTokenMiddleware,
  checkPermissionMiddleware("create_project"),
  ProjectController.create
);
router.get(
  "/projects",
  authTokenMiddleware,
  checkPermissionMiddleware("view_project"),
  ProjectController.getAll
);
router.get(
  "/projects/:id",
  authTokenMiddleware,
  checkPermissionMiddleware("view_project"),
  ProjectController.getById
);
router.put(
  "/projects/:id",
  authTokenMiddleware,
  checkPermissionMiddleware("update_project"),
  ProjectController.update
);
router.delete(
  "/projects/:id",
  authTokenMiddleware,
  checkPermissionMiddleware("delete_project"),
  ProjectController.delete
);


/* ===========================================================
   🟪 ITEMS CRUD
=========================================================== */

router.post(
  "/items",
  authTokenMiddleware,
  checkPermissionMiddleware("create_item"),
  ItemsController.create
);
router.get(
  "/items",
  authTokenMiddleware,
  checkPermissionMiddleware("view_items"),
  ItemsController.getAll
);
router.get(
  "/items/:id",
  authTokenMiddleware,
  checkPermissionMiddleware("view_items"),
  ItemsController.getById
);
router.put(
  "/items/:id",
  authTokenMiddleware,
  checkPermissionMiddleware("update_item"),
  ItemsController.update
);
router.delete(
  "/items/:id",
  authTokenMiddleware,
  checkPermissionMiddleware("delete_item"),
  ItemsController.delete
);

/* ===========================================================
   🟪 Unit CRUD
=========================================================== */

router.post(
  "/units",
  authTokenMiddleware,
  checkPermissionMiddleware("create_unit"),
  UnitController.createUnit
);
router.get(
  "/units",
  authTokenMiddleware,
  checkPermissionMiddleware("view_unit"),
  UnitController.getAllUnits
);
router.get(
  "/units/:id",
  authTokenMiddleware,
  checkPermissionMiddleware("view_unit"),
  UnitController.getUnitById
);
router.put(
  "/units/:id",
  authTokenMiddleware,
  checkPermissionMiddleware("update_unit"),
  UnitController.updateUnit
);
router.delete(
  "/units/:id",
  authTokenMiddleware,
  checkPermissionMiddleware("delete_unit"),
  UnitController.deleteUnit
);

/* ===========================================================
   🟦 TEST CRUD (file uploads)
=========================================================== */

router.post(
  "/tests",
  upload.fields([
    { name: "test_icon", maxCount: 1 },
    { name: "document", maxCount: 1 },
    { name: "attachment", maxCount: 10 },
  ]),
  authTokenMiddleware,
  checkPermissionMiddleware("create_teststep"),
  TestController.createTest
);

router.get(
  "/tests",
  authTokenMiddleware,
  checkPermissionMiddleware("view_teststep"),
  TestController.getAll
);
router.get(
  "/tests/:id",
  authTokenMiddleware,
  checkPermissionMiddleware("view_teststep"),
  TestController.getOne
);

router.put(
  "/tests/:id",
  upload.fields([
    { name: "test_icon", maxCount: 1 },
    { name: "document", maxCount: 1 },
    { name: "attachment", maxCount: 10 },
  ]),
  authTokenMiddleware,
  checkPermissionMiddleware("update_teststep"),
  TestController.update
);

router.delete(
  "/tests/:id",
  authTokenMiddleware,
  checkPermissionMiddleware("delete_teststep"),
  TestController.delete
);


/* ===========================================================
   🟫 VENDOR CRUD
=========================================================== */

router.post(
  "/vendors",
  authTokenMiddleware,
  checkPermissionMiddleware("create_vendor"),
  VendorController.create
);
router.get(
  "/vendors",
  authTokenMiddleware,
  checkPermissionMiddleware("view_vendor"),
  VendorController.getAll
);
router.get(
  "/vendors/:id",
  authTokenMiddleware,
  checkPermissionMiddleware("view_vendor"),
  VendorController.getById
);
router.put(
  "/vendors/:id",
  authTokenMiddleware,
  checkPermissionMiddleware("update_vendor"),
  VendorController.update
);
router.delete(
  "/vendors/:id",
  authTokenMiddleware,
  checkPermissionMiddleware("delete_vendor"),
  VendorController.delete
);

/* ===========================================================
   🟫 STAGE CRUD
=========================================================== */
router.post(
  "/stages",
  authTokenMiddleware,
  checkPermissionMiddleware("create_teststage"),
  upload.single("stage_icon"),
  StageController.create
);

// Read
router.get(
  "/stages",
  authTokenMiddleware,
  checkPermissionMiddleware("view_teststage"),
  StageController.getAll
);
router.get(
  "/stages/:id",
  authTokenMiddleware,
  checkPermissionMiddleware("view_teststage"),
  StageController.getById
);

// Update
router.put(
  "/stages/:id",
  authTokenMiddleware,
  checkPermissionMiddleware("update_teststage"),
  upload.single("stage_icon"),
  StageController.update
);

// Delete
router.delete(
  "/stages/:id",
  authTokenMiddleware,
  checkPermissionMiddleware("delete_teststage"),
  StageController.delete
);

/* ===========================================================
   🟫 PO CRUD
=========================================================== */

router.post(
  "/create-po",
  authTokenMiddleware,
  checkPermissionMiddleware("create_po"),
  upload.fields([
    { name: "attachment", maxCount: 10 },
    { name: "design_copy", maxCount: 10 }
  ]),
  PoController.createPO
);

/* ================= PO LIST ================= */
router.get(
  "/po-list",
  authTokenMiddleware,
  checkPermissionMiddleware("view_po"),
  PoController.getPOList
);
router.get(
  "/po-inspectiolist",
  authTokenMiddleware,
  checkPermissionMiddleware(["view_po", "assigninspection_po"]),
  inspectionsController.getPOListForInspector
);

/* ================= PO VIEW ================= */
router.get(
  "/po-view/:id",
  authTokenMiddleware,
  checkPermissionMiddleware(["view_po", "assigninspection_po", "view_items_po", "viewitems_po"]),
  PoController.getPOView
);
router.get(
  "/po-company-profile/:poId",
  authTokenMiddleware,
  PoController.getPOCompanyProfile
);
router.delete(
  "/po-delete/:id",
  authTokenMiddleware,
  checkPermissionMiddleware("delete_po"),
  PoController.deletePO
);
/* ================= EDIT PO ================= */
router.put(
  "/edit-po/:id",
  authTokenMiddleware,
  checkPermissionMiddleware("update_po"),
  upload.fields([
    { name: "attachment", maxCount: 10 },
    { name: "design_copy", maxCount: 10 }
  ]),
  PoController.editPO
);
router.post(
  "/assign-inspector",
  authTokenMiddleware,
  checkPermissionMiddleware("assigninspection_po"),
  inspectionsController.assignInspector
);
router.get(
  "/assign-inspector",
  authTokenMiddleware,
  checkPermissionMiddleware(["assigninspection_po", "view_items_po", "viewitems_po"]),
  inspectionsController.getAssignedPoList
);
router.get(
  "/inspector/report-filters",
  authTokenMiddleware,
  checkPermissionMiddleware(["view_report", "view_inspection"]),
  inspectionsController.getInspectorReportFilters
);
router.get(
  "/inspector/report-pos",
  authTokenMiddleware,
  checkPermissionMiddleware(["view_report", "view_inspection"]),
  inspectionsController.getInspectorReportPoOptions
);
router.get(
  "/inspector/report-pos/:poId/items",
  authTokenMiddleware,
  checkPermissionMiddleware(["view_report", "view_inspection"]),
  inspectionsController.getInspectorReportItemOptions
);
router.get(
  "/inspector/reports",
  authTokenMiddleware,
  checkPermissionMiddleware(["view_report", "view_inspection"]),
  inspectionsController.getInspectorReports
);
router.post(
  "/start-inspection",
  authTokenMiddleware,
  checkPermissionMiddleware("view_inspection"),
  inspectionsController.startInspection
);
router.get(
  "/po-testitemlist",
  authTokenMiddleware,
  inspectionsController.getPoItemDetails
);
router.get(
  "/po-testitemlist/:poId",
  authTokenMiddleware,
  inspectionsController.getPoItemDetails
);
router.get(
  "/po-stages/:poId",
  authTokenMiddleware,
  checkPermissionMiddleware("view_inspection"),
  inspectionsController.getStagesCount
);

// routes.js (example)
router.get(
  "/inspections/:inspection_id/stages",
  authTokenMiddleware,
  checkPermissionMiddleware("view_inspection"),
  inspectionsController.getStagesWorkspace
);

router.get(
  "/inspections/:inspection_id/po-tests-status",
  authTokenMiddleware,
  checkPermissionMiddleware("view_inspection"),
  inspectionsController.getPoTestsStatus
);
router.get(
  "/inspections/:inspection_id/progress-overview",
  authTokenMiddleware,
  checkPermissionMiddleware("view_inspection"),
  inspectionsController.getProgressOverview
);

router.post(
  "/submit-report",
  authTokenMiddleware,
  checkPermissionMiddleware("view_inspection"),
  upload.array("docs", 10),   // ✅ max 10 files
  inspectionsController.PostPoTestsStatus
);
router.post(
  "/start-or-resume-batch",
  authTokenMiddleware,
  checkPermissionMiddleware("view_inspection"),
  inspectionsController.startOrResumeBatch
);
router.post(
  "/inspection/cancel",
  authTokenMiddleware,
  inspectionsController.cancelInspection
);
router.post(
  "/inspection/cancel-item",
  authTokenMiddleware,
  inspectionsController.cancelInspectionItem
);
router.post(
  "/inspection/reschedule-item",
  authTokenMiddleware,
  checkPermissionMiddleware(["reschedule_inspection_item", "reschedule_inspection", "manage_inspection", "manage_all_inspections"]),
  inspectionsController.rescheduleInspectionItem
);
router.post(
  "/inspection/reschedule",
  authTokenMiddleware,
  checkPermissionMiddleware(["reschedule_inspection", "manage_inspection", "manage_all_inspections"]),
  inspectionsController.rescheduleInspection
);
router.post(
  "/reassign-items",
  authTokenMiddleware,
  checkPermissionMiddleware(["reassign_inspection_items", "assigninspection_po", "manage_all_inspections"]),
  inspectionsController.reassignItems
);
router.get(
  "/inspections/cancelled",
  authTokenMiddleware,
  checkPermissionMiddleware("view_inspection"),
  inspectionsController.getCancelledInspections
);
router.post(
  "/inspections/reschedule-page",
  authTokenMiddleware,
  checkPermissionMiddleware(["reschedule_inspection", "manage_inspection", "manage_all_inspections"]),
  inspectionsController.reschedulePageInspection
);

// ===================== INSPECTOR DASHBOARD (Android) =====================
router.get(
  "/summary",
  authTokenMiddleware,
  checkPermissionMiddleware("view_dashboard"),
  EnterpriseDashboardController.inspectorSummary
); // backward compatible
router.get(
  "/dashboard/summary",
  authTokenMiddleware,
  checkPermissionMiddleware("view_dashboard"),
  EnterpriseDashboardController.inspectorSummary
);
router.get(
  "/dashboard/upcoming",
  authTokenMiddleware,
  checkPermissionMiddleware("view_dashboard"),
  EnterpriseDashboardController.inspectorUpcoming
);
router.get(
  "/activity-log",
  authTokenMiddleware,
  checkPermissionMiddleware("view_dashboard"),
  EnterpriseDashboardController.inspectorActivity
);

// ===================== ADMIN DASHBOARD (Web) =====================
router.get(
  "/admin/dashboard/summary",
  authTokenMiddleware,
  checkPermissionMiddleware("view_dashboard"),
  EnterpriseDashboardController.adminSummary
);
router.get(
  "/inspections/upcoming",
  authTokenMiddleware,
  checkPermissionMiddleware("view_inspection"),
  inspectionsController.getUpcomingInspections
);
router.get(
  "/inspections/recent",
  authTokenMiddleware,
  checkPermissionMiddleware("view_inspection"),
  inspectionsController.getRecentActivity
);
router.get(
  "/inspector/last-inspection",
  authTokenMiddleware,
  checkPermissionMiddleware("view_inspection"),
  inspectionsController.getLastInspectionDetails
);

// ===================== ADMIN REPORTING =====================
router.get(
  "/admin/reports",
  authTokenMiddleware,
  checkPermissionMiddleware(["view_report", "view_inspection"]),
  AdminReportController.list
);
router.get(
  "/admin/reports/export",
  authTokenMiddleware,
  checkPermissionMiddleware(["view_report", "view_inspection"]),
  AdminReportController.export
);
// ===================== ADMIN INSPECTION MANAGEMENT =====================
router.get(
  "/admin/inspections",
  authTokenMiddleware,
  checkPermissionMiddleware("view_inspection"),
  EnterpriseAdminInspectionController.list
);
router.get(
  "/admin/inspections/:id",
  authTokenMiddleware,
  checkPermissionMiddleware("view_inspection"),
  EnterpriseAdminInspectionController.detail
);

export default router;
