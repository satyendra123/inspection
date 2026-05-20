import { where ,Op} from "sequelize";
import { Role, Permission, RolePermission, User } from "../Model/index.js"
import getUserIDFromToken from "./AdminController.js"

class RollController {
  static createRole = async (req, res) => {
    const { name, permissionIds } = req.body; // permissionIds should be an array of permission IDs

    try {
        // Validate required fields
        if (!name || !Array.isArray(permissionIds)) {
            return res.status(400).json({ status: "failed", msg: "Missing required fields or invalid permissions" });
        }

        // Check if the role already exists
        const existingRole = await Role.findOne({ where: { role_name:name } });
        if (existingRole) {
            return res.status(409).json({ status: "failed", msg: "Role already exists" });
        }

        // Create the new role
        const role = await Role.create({ role_name:name });

        // Assign permissions to role by inserting into RolePermission table
        if (permissionIds.length > 0) {
            await RolePermission.bulkCreate(
                permissionIds.map((permission_id) => ({
                    role_id: role.id,
                    permission_id,
                }))
            );
        }

        return res.status(201).json({ status: "success", msg: "Role created successfully", role });
    } catch (error) {
        return res.status(500).json({ status: "failed", msg: "Server error", error: error.message });
    }
};


  static updateRolePermissions = async (req, res) => {
    const { role_id, permissionIds } = req.body; // permissionIds should be an array

    try {
        if (!role_id || !Array.isArray(permissionIds)) {
            return res.status(400).json({ status: "failed", msg: "Missing required fields or invalid permissions" });
        }

        const role = await Role.findByPk(role_id);
        if (!role) {
            return res.status(404).json({ status: "failed", msg: "Role not found" });
        }

        // Remove old permissions
        await RolePermission.destroy({ where: { role_id } });

        // Assign new permissions
        if (permissionIds.length > 0) {
            await RolePermission.bulkCreate(
                permissionIds.map((permission_id) => ({
                    role_id,
                    permission_id,
                }))
            );
        }

        return res.status(200).json({ status: "success", msg: "Permissions updated successfully" });
    } catch (error) {
        return res.status(500).json({ status: "failed", msg: "Server error", error: error.message });
    }
};
static deleteRole = async (req, res) => {
  const roleId = req.params.id; // Role ID from URL parameter

  try {
    // Find the role by ID
    const role = await Role.findByPk(roleId);

    // If role doesn't exist, return 404
    if (!role) {
      return res.status(404).send({ status: "failed", msg: "Role not found" });
    }

    // Delete the role from the database
    await role.destroy();

    return res.status(200).send({ status: "success", msg: "Role deleted successfully" });
  } catch (error) {
    return res.status(500).send({ status: "failed", msg: "Server error", error: error.message });
  }
};
static getAssignedPermissions = async (req, res) => {
    const  role_id  = req.params.id;
    console.log("gggggggggggggggggggggggggggggggggggggggggggggggggggg",role_id)

    try {
      const role = await Role.findByPk(role_id, {
        include: {
            model: Permission, // Assuming Permission model is associated
            through: { attributes: [] }, // Exclude join table attributes
        },
        logging: console.log // Correct placement of logging
    });


        if (!role) {
            return res.status(404).json({ status: "failed", msg: "Role not found" });
        }

        // Extract assigned permission IDs
        const assignedPermissionIds = role.Permissions.map(p => p.id);

        // Get unassigned permissions
        const unassignedPermissions = await Permission.findAll({
            where: assignedPermissionIds.length > 0
                ? { id: { [Op.notIn]: assignedPermissionIds } }
                : {} // Fetch all permissions if none are assigned
        });

        return res.status(200).json({
            status: "success",
            role_name: role.role_name,
            assigned_permissions: role.Permissions,
            unassigned_permissions: unassignedPermissions
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", msg: "Server error", error: error.message });
    }
  };

  static getAllPermissions = async (req, res) => {
    try {
        const permissions = await Permission.findAll({
            attributes: ['id', 'permission_name'] // Select only id and name
        });

        return res.status(200).json({
            status: "success",
            permissions
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", msg: "Server error", error: error.message });
    }
};
static assignPermissionsToRole = async (req, res) => {
  const { roleId, permissionIds } = req.body;

  try {
    // Find the role
    const role = await Role.findByPk(roleId);
    if (!role) {
      return res.status(404).send({ status: 'failed', msg: 'Role not found' });
    }



    if (permissions.length !== permissionIds.length) {
      return res.status(400).send({
        status: 'failed',
        msg: 'Some permissions were not found'
      });
    }

    // Assign permissions to role by adding entries in the RolePermission table
    await role.addPermissions(permissions);

    return res.status(200).send({ status: 'success', msg: 'Permissions assigned to role successfully' });
  } catch (error) {
    return res.status(500).send({ status: 'failed', msg: 'Server error', error: error.message });
  }
};
  static getUserRoles = async (req, res) => {
    try {
      // Get the user ID from the token (you already have a method for this)
      const userID = await getUserIDFromToken.getUserIDFromToken(req);
      const getuser = await this.getUserSpecific(userID);
      // Fetch the user along with their roles and permissions

      res.status(200).json({
        status: 'success',
        data: getuser
      });
    } catch (error) {
      return res.status(500).json({
        status: "failed",
        msg: "Server error",
        error: error.message
      });
    }
  };
  static getUserSpecific = async (userID) => {
    try {
      console.log(`user id: ${userID}`)
      const userWithRoles = await User.findByPk(userID, {
        include: [
          {
            model: Role,
            through: { attributes: [] }, // exclude join table data
            include: [{
              model: Permission,
              through: { attributes: [] }, // exclude join table data
              attributes: ['permission_name'] // fetch only permission names
            }]
          }
        ]
      });

      if (!userWithRoles) {
        return res.status(404).json({ message: 'User not found' });
      }

      const filteredRoles = userWithRoles.Roles.map(async (role) => {
        const canAssignPermissions = role.Permissions.filter(permission =>
          permission.permission_name.startsWith('canAssign')
        );

        const roleNames = await Promise.all(canAssignPermissions.map(async (permission) => {
          const roleName = permission.permission_name.replace('canAssignRole', '').trim(); // Ensure trim
          console.log("Processing permission:", permission.permission_name);
          console.log("Looking up role for:", roleName);

          const assignedRole = await Role.findOne({
            where: { role_name: roleName }
          });

          if (!assignedRole) {
            console.warn(`No role found for ${roleName}`);
            return null;
          }
          console.warn(`role found for ${assignedRole.role_name}  ${assignedRole.id}`);
          return { role_name: assignedRole.role_name, role_id: assignedRole.id };
        }));

        return {
          role_name: role.role_name,
          assignableRoles: roleNames.filter(role => role !== null) // Filter out nulls
        };
      });

      const resolvedRoles = await Promise.all(filteredRoles);
      return resolvedRoles;
    } catch (error) {
      console.error("Error fetching user specific roles:", error);
      return { status: 500, message: "Server error", error: error.message };
    }
  }

  static updateRole = async (req, res) => {
    const roleId = req.params.id; // Role ID from URL parameter
    const { role_name } = req.body; // New role name from request body

    try {
      // Find the role by ID
      const role = await Role.findByPk(roleId);

      // If role doesn't exist, return 404
      if (!role) {
        return res.status(404).send({ status: "failed", msg: "Role not found" });
      }

      // Update the role's name
      role.role_name = role_name;

      // Save the updated role to the database
      await role.save();

      return res.status(200).send({ status: "success", msg: "Role updated successfully", role });
    } catch (error) {
      return res.status(500).send({ status: "failed", msg: "Server error", error: error.message });
    }
  };
  static getAssignedPermissions = async (req, res) => {
    const  role_id  = req.params.id;
    //console.log("gggggggggggggggggggggggggggggggggggggggggggggggggggg",role_id)

    try {
      const role = await Role.findByPk(role_id, {
        include: {
            model: Permission, // Assuming Permission model is associated
            through: { attributes: [] }, // Exclude join table attributes
        },
        logging: console.log // Correct placement of logging
    });


        if (!role) {
            return res.status(404).json({ status: "failed", msg: "Role not found" });
        }

        // Extract assigned permission IDs
        const assignedPermissionIds = role.Permissions.map(p => p.id);

        // Get unassigned permissions
        const unassignedPermissions = await Permission.findAll({
            where: assignedPermissionIds.length > 0
                ? { id: { [Op.notIn]: assignedPermissionIds } }
                : {} // Fetch all permissions if none are assigned
        });

        return res.status(200).json({
            status: "success",
            role_name: role.role_name,
            assigned_permissions: role.Permissions,
            unassigned_permissions: unassignedPermissions
        });
    } catch (error) {
        return res.status(500).json({ status: "failed", msg: "Server error", error: error.message });
    }
  };
  static getRollPermission = async (req, res) => {
    const  role_id = req.params.role_id;

    try {
      const assignedPermissions = await RolePermission.findAll({
        where: { role_id },
        include: [
          {
            model: Permission,
            attributes: ['id', 'permission_name', 'permission_key'],
          },
        ],
        attributes: ['rp_id', 'role_id', 'permission_id'],  // Specify the columns you need
        logging: console.log,  // This will log the generated SQL query
      });

      // Debugging the result
      console.log('Assigned Permissions:', assignedPermissions);

      if (assignedPermissions.length === 0) {
        return res.status(404).json({
          status: 'failed',
          msg: 'No permissions found for the specified role',
        });
      }

      return res.status(200).json({
        status: 'success',
        data: assignedPermissions,
      });

    } catch (error) {
      res.status(500).json({
        status: 'failed',
        msg: 'Server error',
        error: error.message,
      });
    }
  }
  static getAllRole = async (req, res) => {

    try {
      const getAllrole = await Role.findAll();

      // Debugging the result
      console.log('Assigned Permissions:', getAllrole);

      if (getAllrole.length === 0) {
        return res.status(404).json({
          status: 'failed',
          msg: 'No permissions found for the specified role',
        });
      }

      return res.status(200).json({
        status: 'success',
        data: getAllrole,
      });

    } catch (error) {
      res.status(500).json({
        status: 'failed',
        msg: 'Server error',
        error: error.message,
      });
    }
  }
  }
export default RollController;
