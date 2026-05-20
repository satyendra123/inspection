import auth_Admin from "../middleware/auth_Admin.js";
import Permission from "../Model/Permission.js";

class PermissionController {
    static createPermission = async (req, res) => {
        const { permission_name, permission_key } = req.body; // permissions is an array of permission names and their respective keys

        try {
            const getpermission = await Permission.findOne({ where: { permission_name } });
            if (getpermission) {
                return res.status(409).send({ status: "failed", msg: "Permission already created" });
            }

            // Create the permission with both permission_name and permission_key
            const permissionname = await Permission.create({ permission_name, permission_key });

            return res.status(201).json({ status: 'success', msg: 'Permission created successfully', permissionname });
        } catch (error) {
            return res.status(500).json({ status: 'failed', msg: 'Server error', error: error.message });
        }
    };

    static getAllPermission = async (req, res) => {
        try {
            const allpermission = await Permission.findAll();
            return res.status(200).send({ status: "success", msg: "All Permission List", allpermission });
        } catch (error) {
            return res.status(500).send({ status: "failed", msg: "Server error", error });
        }
    };

    static deletePermission = async (req, res) => {
        const { id } = req.params; // permission ID passed in URL

        try {
            const permission = await Permission.findByPk(id);
            if (!permission) {
                return res.status(404).send({ status: "failed", msg: "Permission not found" });
            }

            await permission.destroy();
            return res.status(200).send({ status: "success", msg: "Permission deleted successfully" });
        } catch (error) {
            return res.status(500).send({ status: "failed", msg: "Server error", error: error.message });
        }
    };

    static updatePermission = async (req, res) => {
        const { id } = req.params; // permission ID passed in URL
        const { permission_name, permission_key } = req.body; // new permission name or other fields from request body

        try {
            const permission = await Permission.findByPk(id);
            if (!permission) {
                return res.status(404).send({ status: "failed", msg: "Permission not found" });
            }

            permission.permission_name = permission_name || permission.permission_name;
            permission.permission_key = permission_key || permission.permission_key; // Update the permission_key if provided
            await permission.save();

            return res.status(200).send({ status: "success", msg: "Permission updated successfully", permission });
        } catch (error) {
            return res.status(500).send({ status: "failed", msg: "Server error", error: error.message });
        }
    };
}

export default PermissionController;
