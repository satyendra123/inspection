// Model/index.js

import User from "./User.js";
import Role from "./Role.js";
import Permission from "./Permission.js";
import UserRole from "./UserRole.js";
import RolePermission from "./RolePermission.js";
import UserLog from "./Userlog.js";
import Category from "./Category.js";
import Items from "./Item.js";
import Vendor from "./Vendor.js";
import Test from "./Test.js";
import Stage from "./Stage.js";
import PurchaseOrder from "./PurchaseOrder.js";
import PurchaseOrderItem from "./PurchaseOrderItem.js";
import Inspection  from "./Inspection.js";
import InspectionItem from "./InspectionItem.js";
import PoStage from "./PoStage.js";
import StageTest from "./StageTest.js";
import Unit from "./Unit.js";
import InspectionBatch from "./InspectionBatch.js";
import InspectionEvent from "./InspectionEvent.js";

import InspectionCase from "./InspectionCase.js";
import InspectionAssignment from "./InspectionAssignment.js";
import InspectionAssignmentItem from "./InspectionAssignmentItem.js";
import Company from "./Company.js";
import Project from "./Project.js";
import UserCompany from "./UserCompany.js";
import PurchaseOrderCompany from "./PurchaseOrderCompany.js";
/* ---------------------------------------------------------
   ROLE — PERMISSION (Many → Many)
--------------------------------------------------------- */

Role.belongsToMany(Permission, {
  through: RolePermission,
  foreignKey: "role_id",
});

Permission.belongsToMany(Role, {
  through: RolePermission,
  foreignKey: "permission_id",
});

// For include() use
Role.hasMany(RolePermission, { foreignKey: "role_id" });
RolePermission.belongsTo(Role, { foreignKey: "role_id" });

Permission.hasMany(RolePermission, { foreignKey: "permission_id" });
RolePermission.belongsTo(Permission, { foreignKey: "permission_id" });

/* ---------------------------------------------------------
   USER — ROLE (Many → Many via UserRole)
--------------------------------------------------------- */
User.belongsToMany(Role, {
  through: UserRole,
  foreignKey: "user_id",
});
Role.belongsToMany(User, {
  through: UserRole,
  foreignKey: "role_id",
});

User.belongsToMany(Company, {
  through: UserCompany,
  foreignKey: "user_id",
  otherKey: "company_id",
});
Company.belongsToMany(User, {
  through: UserCompany,
  foreignKey: "company_id",
  otherKey: "user_id",
});
PurchaseOrderItem.belongsTo(Items, {
  foreignKey: "purchase_order_item_id",
});

// For include()
User.hasMany(UserRole, { foreignKey: "user_id" });
UserRole.belongsTo(User, { foreignKey: "user_id" });

Role.hasMany(UserRole, { foreignKey: "role_id" });
UserRole.belongsTo(Role, { foreignKey: "role_id" });

Items.belongsTo(Unit, { foreignKey: "unit_id" });

// CATEGORY — ITEM (One → Many)
Category.hasMany(Items, { foreignKey: "Category_id" });
Items.belongsTo(Category, { foreignKey: "Category_id" });
PurchaseOrder.hasMany(PurchaseOrderItem, {
    foreignKey: "po_id", // make sure this matches your column in POItem table                  // alias for include
});
Inspection.belongsToMany(PurchaseOrderItem, {
  through: InspectionItem,
  foreignKey: "inspection_id"
});
// Vendor → PurchaseOrder (One → Many)
Vendor.hasMany(PurchaseOrder, {
  foreignKey: "vendor_id",
});

PurchaseOrder.belongsTo(Vendor, {
  foreignKey: "vendor_id",
});

// Project ↔ PurchaseOrder
Project.hasMany(PurchaseOrder, { foreignKey: "project_id" });
PurchaseOrder.belongsTo(Project, { foreignKey: "project_id" });

PurchaseOrder.belongsToMany(Company, {
  through: PurchaseOrderCompany,
  foreignKey: "po_id",
  otherKey: "company_id",
  as: "Companies",
});
Company.belongsToMany(PurchaseOrder, {
  through: PurchaseOrderCompany,
  foreignKey: "company_id",
  otherKey: "po_id",
  as: "PurchaseOrders",
});

// Company ↔ Project
Company.hasMany(Project, { foreignKey: "company_id" });
Project.belongsTo(Company, { foreignKey: "company_id" });
// Item → PurchaseOrderItem
Items.hasMany(PurchaseOrderItem, {
  foreignKey: "item_id",
});

PurchaseOrderItem.belongsTo(Items, {
  foreignKey: "item_id",
});

PurchaseOrderItem.belongsToMany(Inspection, {
  through: InspectionItem,
  foreignKey: "item_id"
});
PurchaseOrder.hasMany(PurchaseOrderItem, {
  foreignKey: "po_id",
  as: "items",
});

PurchaseOrderItem.belongsTo(PurchaseOrder, {
  foreignKey: "po_id",
});
Inspection.hasMany(InspectionItem, {
  foreignKey: "inspection_id",
});

InspectionItem.belongsTo(Inspection, {
  foreignKey: "inspection_id",
});
PurchaseOrderItem.hasMany(InspectionItem, {
  foreignKey: "item_id",
});

InspectionItem.belongsTo(PurchaseOrderItem, {
  foreignKey: "item_id",
});

// ================= PURCHASE ORDER ↔ INSPECTION =================

// One PO can have many inspections
PurchaseOrder.hasMany(Inspection, {
  foreignKey: "po_id",
});

// Each inspection belongs to one PO
Inspection.belongsTo(PurchaseOrder, {
  foreignKey: "po_id",

});
Inspection.hasMany(PoStage, {
  foreignKey: "inspection_id",
});

PoStage.belongsTo(Inspection, {
  foreignKey: "inspection_id",
});

// Stage → PoStage
Stage.hasMany(PoStage, { foreignKey: "stage_id" });
PoStage.belongsTo(Stage, { foreignKey: "stage_id", onDelete: "RESTRICT", onUpdate: "CASCADE" });

// User → PoStage (Inspector)
User.hasMany(PoStage, { foreignKey: "inspector_id" });
PoStage.belongsTo(User, { foreignKey: "inspector_id", onDelete: "SET NULL", onUpdate: "CASCADE" });
// User → PoStage (Inspector)
User.hasMany(PoStage, {
  foreignKey: "inspector_id",
  as: "StageInspector",
});
InspectionAssignment.hasMany(InspectionEvent, {
  foreignKey: "assignment_id",
  as: "Events"
});
StageTest.belongsTo(Inspection, {
  foreignKey: "inspection_id"
});

StageTest.belongsTo(Stage, {
  foreignKey: "stage_id"
});

StageTest.belongsTo(Test, {
  foreignKey: "test_id"
});

InspectionEvent.belongsTo(InspectionAssignment, {
  foreignKey: "assignment_id"
});

PoStage.belongsTo(User, {
  foreignKey: "inspector_id",
  as: "StageInspector",
});

PoStage.hasMany(StageTest, { foreignKey: "po_stage_id" });
StageTest.belongsTo(PoStage, { foreignKey: "po_stage_id" });

PurchaseOrderItem.hasMany(StageTest, { foreignKey: "item_id" });
StageTest.belongsTo(PurchaseOrderItem, { foreignKey: "item_id" });

// StageTest ↔ Test (Many StageTests reference one Test)
Test.hasMany(StageTest, { foreignKey: "test_id" });
StageTest.belongsTo(Test, { foreignKey: "test_id" });

Inspection.hasMany(InspectionEvent, { foreignKey: "inspection_id" });
InspectionEvent.belongsTo(Inspection, { foreignKey: "inspection_id" });
// ✅ Batch belongs
// 🔥 User ↔ InspectionEvent (ACTOR)
InspectionEvent.belongsTo(User, {
  foreignKey: "actor_user_id",
  as: "Actor",
});

User.hasMany(InspectionEvent, {
  foreignKey: "actor_user_id",
  as: "Events",
});
// ❌ OLD
Inspection.belongsTo(PurchaseOrder, {
  foreignKey: "po_id",
});

// ✅ NEW (FINAL)
Inspection.belongsTo(PurchaseOrder, {
  foreignKey: "po_id",
  as: "PO",
});

PurchaseOrder.hasMany(Inspection, {
  foreignKey: "po_id",
  as: "Inspections",
});

InspectionBatch.belongsTo(PurchaseOrderItem, { foreignKey: "purchase_order_item_id" });
PurchaseOrderItem.hasMany(InspectionBatch, { foreignKey: "purchase_order_item_id" });
// Batch → Stage
InspectionBatch.hasMany(PoStage, { foreignKey: "batch_id" });
PoStage.belongsTo(InspectionBatch, { foreignKey: "batch_id" });

// Stage → Tests
PoStage.hasMany(StageTest, { foreignKey: "po_stage_id" });
StageTest.belongsTo(PoStage, { foreignKey: "po_stage_id" });

// Batch → Tests (optional but useful)
InspectionBatch.hasMany(StageTest, { foreignKey: "batch_id" });
StageTest.belongsTo(InspectionBatch, { foreignKey: "batch_id" });

// ✅ StageTest belongs to batch
StageTest.belongsTo(InspectionBatch, { foreignKey: "batch_id" });
InspectionBatch.hasMany(StageTest, { foreignKey: "batch_id" });



/* ---------------------------------------------------------
   INSPECTION ↔ USER (Inspector & Assigned By)
--------------------------------------------------------- */

// Inspector who performs inspection
// 🔥 Inspector (actual assigned inspector)
Inspection.belongsTo(User, {
  foreignKey: "inspector_id",
  as: "Inspector",
});

// (Optional) Assigned by admin
Inspection.belongsTo(User, {
  foreignKey: "assigned_by",
  as: "AssignedBy",
});
;

User.hasMany(Inspection, {
  foreignKey: "inspector_id",
});

// User who assigned the inspection (admin / manager)
Inspection.belongsTo(User, {
  foreignKey: "assigned_by",
});

User.hasMany(Inspection, {
  foreignKey: "assigned_by",
});
// after sequelize init:

// Associations
InspectionCase.belongsTo(PurchaseOrder, { foreignKey: "po_id", as: "PurchaseOrder" });
PurchaseOrder.hasMany(InspectionCase, {
  foreignKey: "po_id",
  as: "InspectionCases",
});

InspectionAssignment.belongsTo(InspectionCase, { foreignKey: "case_id", as: "Case" });
InspectionCase.hasMany(InspectionAssignment, { foreignKey: "case_id", as: "Assignments" });

InspectionAssignment.belongsTo(User, { foreignKey: "inspector_id", as: "Inspector" });
User.hasMany(InspectionAssignment, { foreignKey: "inspector_id", as: "Assignments" });

InspectionAssignmentItem.belongsTo(InspectionAssignment, { foreignKey: "assignment_id", as: "Assignment" });
InspectionAssignment.hasMany(InspectionAssignmentItem, { foreignKey: "assignment_id", as: "AssignmentItems" });
// ✅ Inspection ↔ Batch
Inspection.hasMany(InspectionBatch, { foreignKey: "inspection_id" });
InspectionBatch.belongsTo(Inspection, { foreignKey: "inspection_id" });
InspectionAssignmentItem.belongsTo(PurchaseOrderItem, { foreignKey: "purchase_order_item_id", as: "PoItem" });
PurchaseOrderItem.hasMany(InspectionAssignmentItem, { foreignKey: "purchase_order_item_id", as: "AssignmentItems" });

// ✅ Inspection ↔ PurchaseOrderItem (direct) for admin dashboard/reports/current-inspections
Inspection.belongsTo(PurchaseOrderItem, {
  foreignKey: "purchase_order_item_id",
  as: "PoItem",
});
PurchaseOrderItem.hasMany(Inspection, {
  foreignKey: "purchase_order_item_id",
  as: "Inspections",
});

/* ---------------------------------------------------------
   EXPORT ALL MODELS
--------------------------------------------------------- */
export {
  User,
  Role,
  InspectionBatch,
  InspectionEvent,
  Permission,
  Company,
  Project,
  UserRole,
  UserCompany,
  PurchaseOrderCompany,
  RolePermission,
  UserLog,
  Category,
  Items,
  Unit,
  Vendor,
  Test,
  Stage,
  PurchaseOrder,
  PurchaseOrderItem,
  Inspection,
  InspectionItem,
  InspectionAssignment,
  InspectionCase,
  InspectionAssignmentItem,
  PoStage,
  StageTest
};
