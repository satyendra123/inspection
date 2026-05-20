import Permission from "../Model/Permission.js";

export const REQUIRED_PERMISSIONS = [
  { permission_name: "Create User by Excel", permission_key: "create_userbyexcel" },
  { permission_name: "Check User Permission", permission_key: "check_permission" },

  { permission_name: "View Company", permission_key: "view_company" },
  { permission_name: "Create Company", permission_key: "create_company" },
  { permission_name: "Update Company", permission_key: "update_company" },
  { permission_name: "Delete Company", permission_key: "delete_company" },

  { permission_name: "View Project", permission_key: "view_project" },
  { permission_name: "Create Project", permission_key: "create_project" },
  { permission_name: "Update Project", permission_key: "update_project" },
  { permission_name: "Delete Project", permission_key: "delete_project" },

  { permission_name: "View PO Items", permission_key: "view_items_po" },
  { permission_name: "View Reports", permission_key: "view_report" },

  { permission_name: "Reschedule Inspection", permission_key: "reschedule_inspection" },
  { permission_name: "Cancel Inspection", permission_key: "cancel_inspection" },
  { permission_name: "Reschedule Inspection Item", permission_key: "reschedule_inspection_item" },
  { permission_name: "Cancel Inspection Item", permission_key: "cancel_inspection_item" },
  { permission_name: "Manage Inspection", permission_key: "manage_inspection" },
  { permission_name: "Manage All Inspections", permission_key: "manage_all_inspections" },
  { permission_name: "Reassign Inspection Items", permission_key: "reassign_inspection_items" },
];

export const ensureRequiredPermissions = async () => {
  const created = [];

  for (const permission of REQUIRED_PERMISSIONS) {
    const [, wasCreated] = await Permission.findOrCreate({
      where: { permission_key: permission.permission_key },
      defaults: permission,
    });

    if (wasCreated) created.push(permission.permission_key);
  }

  return created;
};
