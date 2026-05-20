// controllers/AdminController.js
import bcryptjs from "bcryptjs";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import {
  User,
  Role,
  UserRole,
  Company,
  UserCompany,
  Permission,
  RolePermission,
  UserLog,
} from "../Model/index.js";
import RollController from "./RollController.js";
import blacklistedTokens from "../middleware/toctokenBlacklist.js";
import { Op } from "sequelize";

const normalizeCompanyIds = (value) => {
  if (Array.isArray(value)) {
    // Supports [1,2] and [{ value: 1 }, { value: 2 }]
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
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry) => {
          if (typeof entry === "object" && entry !== null) {
            return Number(entry.value ?? entry.id ?? entry.company_id);
          }
          return Number(entry);
        })
        .filter(Boolean);
    }
  } catch (e) {
    // fallback below
  }

  return value
    .split(",")
    .map((id) => Number(id.trim()))
    .filter(Boolean);
};

const pickCompanyInput = (body = {}) =>
  body.companyIds ??
  body.company_ids ??
  body.companies ??
  body.company_id ??
  body.companyId ??
  body.selected_companies ??
  body.selectedCompanies;

const decorateUserWithCompanies = (userRow) => {
  const companies = userRow.Companies || [];
  const roleFromUserRoles = userRow.UserRoles?.[0]?.Role || null;
  const roleFromRoles = userRow.Roles?.[0] || null;
  const resolvedRole = roleFromUserRoles || roleFromRoles;

  return {
    ...userRow,
    role_id: resolvedRole?.id ?? userRow.role_id ?? null,
    role_name: resolvedRole?.role_name ?? null,
    company_ids: companies.map((c) => c.id),
    company_names: companies.map((c) => c.company_name).join(", "),
  };
};

const getUserWithRoleAndCompanies = async (userId) => {
  const row = await User.findByPk(userId, {
    attributes: { exclude: ["password"] },
    include: [
      {
        model: UserRole,
        attributes: ["role_id"],
        include: [{ model: Role, attributes: ["id", "role_name"] }],
      },
      {
        model: Company,
        through: { attributes: [] },
        attributes: ["id", "company_name"],
      },
    ],
  });

  if (!row) return null;
  const normalized = typeof row.toJSON === "function" ? row.toJSON() : row;
  return decorateUserWithCompanies(normalized);
};

class AdminController {
  // ----------------------------
  // Helper: safe send
  // ----------------------------
  static sendSuccess(res, msg = "Success", data = {}) {
    return res.status(200).json({ status: "success", msg, ...data });
  }

  static sendError(res, code = 500, msg = "Server error", err = null) {
    const payload = { status: "failed", msg };
    if (err) payload.error = err.message || err;
    return res.status(code).json(payload);
  }

  // ----------------------------
  // LOGIN (UserLogic)
  // ----------------------------
  static UserLogic = async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return AdminController.sendError(res, 400, "Username and password required");
      }

      // Normalize IP
      let clientIp = req.headers["x-forwarded-for"] || req.connection.remoteAddress || "";
      clientIp = String(clientIp).replace(/^::ffff:/, "");

      // Find user
      const user = await User.findOne({ where: { username } });
      if (!user) {
        return AdminController.sendError(res, 401, "You are not registered");
      }

      // Check password
      const isMatch = await bcryptjs.compare(password, user.password);
      if (!isMatch) {
        return AdminController.sendError(res, 401, "Username or Password is not valid");
      }

      // Get role via UserRole
      const userRole = await UserRole.findOne({ where: { user_id: user.id } });
      if (!userRole) {
        return AdminController.sendError(res, 403, "Role not assigned to this user");
      }

      const role = await Role.findByPk(userRole.role_id);
      if (!role) {
        return AdminController.sendError(res, 403, "Role details not found");
      }

      // Fetch permissions for that role (role -> role_permissions -> permission)
      const rolePermissions = await RolePermission.findAll({
        where: { role_id: role.id },
        include: [{ model: Permission }],
      });
      // Map permissions to keys (permission_key if exists else permission_name)
      const permissionKeys = rolePermissions.map((rp) => {
        if (rp.Permission) {
          return rp.Permission.permission_key || rp.Permission.permission_name;
        }
        return null;
      }).filter(Boolean);
      console.log("rolePermissions:", permissionKeys);

      // Check existing active login (UserLog with logout_time == null)
      const existingLog = await UserLog.findOne({
        where: {
          user_id: user.id,
          logout_time: null,
        },
      });

      if (existingLog) {
        // If you want to auto-invalidate previous session instead of rejecting login,
        // you could set logout_time here. For now we reject as per original logic.
        // return AdminController.sendError(
        //   res,
        //   401,
        //   `User already logged in on Lane: ${existingLog.lane_id || "unknown"}`
        // );
      }

      // Create token payload — include user id, name, role, permissions
      const payload = {
        userID: user.id,
        name: user.name,
        role: role.role_name,
        permissions: permissionKeys,
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET_KEY, {
        expiresIn: process.env.JWT_EXPIRES_IN || "24h",
      });

      // Create user log entry (lane/shift optional)
      await UserLog.create({
        user_id: user.id,
        lane_id: null, // if you have laneWithDevices use that id
        shift_assign_id: null, // if applicable
        token,
        login_time: new Date(),
        logout_time: null,
        client_ip: clientIp,
      });

      // Response
      return res.status(200).json({
        status: "success",
        msg: "Login Success",
        token,
        expiresIn: process.env.JWT_EXPIRES_IN || "24h",
      });
    } catch (error) {
      console.error("Login Error:", error);
      return AdminController.sendError(res, 500, "Server error", error);
    }
  };

  // ----------------------------
  // SIGN OUT (invalidate token via blacklist)
  // ----------------------------
  static SignOut = async (req, res) => {
    try {
      const { authorization } = req.headers;
      if (!authorization || !authorization.startsWith("Bearer ")) {
        return AdminController.sendError(res, 400, "No token provided");
      }
      const token = authorization.split(" ")[1];
      if (!token) return AdminController.sendError(res, 400, "No token provided");

      // Add token to blacklist
      blacklistedTokens.add(token);

      // Also mark logout_time in user's latest UserLog (best effort)
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        await UserLog.update(
          { logout_time: new Date() },
          { where: { user_id: decoded.userID, token, logout_time: null } }
        );
      } catch (e) {
        // token might be expired — ignore
      }

      return AdminController.sendSuccess(res, "Signed out successfully");
    } catch (error) {
      console.error("SignOut Error:", error);
      return AdminController.sendError(res, 500, "Failed to sign out", error);
    }
  };

  // ----------------------------
  // CREATE USER
  // ----------------------------
  static createUser = async (req, res) => {
    const {
      name,
      username,
      password,
      roleName,
      mobile_no,
      gender,
      email,
      aadhar_card,
      address,
      companyIds,
    } = req.body;

    try {
      if (!name || !username || !password || !roleName) {
        return AdminController.sendError(res, 400, "Missing required fields");
      }

      // Check existing username
      const existingUser = await User.findOne({ where: { username } });
      if (existingUser) {
        return AdminController.sendError(res, 409, "Username already registered");
      }

      // Hash password
      const hashedPassword = await bcryptjs.hash(password, 10);

      // Create user
      const newUser = await User.create({
        name,
        username,
        password: hashedPassword,
        mobile_no,
        gender,
        email,
        aadhar_card,
        address,
      });

      // Assign role if exists
      if (roleName !== undefined && roleName !== null && roleName !== "") {
        const role = await Role.findOne({ where: { id: roleName } });
        if (role) {
          await UserRole.create({
            user_id: newUser.id,
            role_id: roleName,
          });
        }
      }

      const parsedCompanyIds = normalizeCompanyIds(
        pickCompanyInput({ ...req.body, companyIds })
      );
      if (parsedCompanyIds.length > 0) {
        await UserCompany.bulkCreate(
          parsedCompanyIds.map((company_id) => ({
            user_id: newUser.id,
            company_id,
          }))
        );
      }

      const responseUser = await getUserWithRoleAndCompanies(newUser.id);

      return res.status(201).json({
        status: "success",
        msg: "User created successfully",
        data: responseUser || newUser,
      });
    } catch (error) {
      console.error("CreateUser Error:", error);
      return AdminController.sendError(res, 500, "Server error", error);
    }
  };
  static changeUserPassword = async (req, res) => {
    try {
      const { user_id, password } = req.body;

      if (!user_id || !password) {
        return res.status(400).json({ success: false, message: "User ID and password are required" });
      }
      console.log("changeUserPassword called with user_id:", user_id);
      // Check if user exists
      const user = await User.findByPk(user_id);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // Hash the new password
      const hashedPassword = await bcryptjs.hash(password, 10);

      // Update user's password
      await user.update({ password: hashedPassword });

      return res.status(200).json({ success: true, message: "Password changed successfully" });
    } catch (err) {
      console.error("Password change error:", err);
      return res.status(500).json({ success: false, message: "Failed to change password" });
    }
  };
  // ----------------------------
  // CREATE USERS FROM EXCEL (bulk)
  // ----------------------------
  static createByExcelUser = async (req, res) => {
    // Expected body: { office_id, role_id, users: [ { username, password, name, mobile_no }, ... ] }
    const { office_id, role_id, users } = req.body;
    if (!Array.isArray(users) || users.length === 0) {
      return AdminController.sendError(res, 400, "No users provided");
    }

    const t = await User.sequelize.transaction();
    try {
      const role = await Role.findByPk(role_id, { transaction: t });
      if (!role) {
        await t.rollback();
        return AdminController.sendError(res, 404, "Role not found");
      }

      // Authorization: check if current user can assign this role
      const currentUserId = AdminController.getUserIDFromToken(req);
      const rolesResponse = await RollController.getUserSpecific(currentUserId);
      const assignableRoleNames = rolesResponse
        .map((r) => r.assignableRoles || [])
        .flat()
        .map((ar) => ar.role_name);

      if (!assignableRoleNames.includes(role.role_name)) {
        await t.rollback();
        return AdminController.sendError(res, 403, "Not authorized to assign this role");
      }

      // Process users
      for (const u of users) {
        const { username, password, name, mobile_no } = u;
        if (!username || !password || !name || !mobile_no) {
          await t.rollback();
          return AdminController.sendError(res, 400, "Missing required fields in one of the users");
        }

        const exists = await User.findOne({ where: { username }, transaction: t });
        if (exists) {
          await t.rollback();
          return AdminController.sendError(res, 409, `Username ${username} already exists`);
        }

        const hashed = await bcryptjs.hash(password, 10);
        const created = await User.create(
          {
            office_id,
            username,
            password: hashed,
            name,
            mobile_no,
          },
          { transaction: t }
        );

        await UserRole.create(
          {
            user_id: created.id,
            role_id,
          },
          { transaction: t }
        );
      }

      await t.commit();
      return AdminController.sendSuccess(res, "Users created successfully");
    } catch (error) {
      await t.rollback();
      console.error("createByExcelUser Error:", error);
      return AdminController.sendError(res, 500, "Server error", error);
    }
  };

  // ----------------------------
  // UPDATE USER
  // ----------------------------
  static updateUser = async (req, res) => {
    const { id, name, username, email, gender, mobile_no, aadhar_card, address, roleName, companyIds } = req.body;
    if (!id) return AdminController.sendError(res, 400, "User id required");

    try {
      const user = await User.findByPk(id);
      if (!user) return AdminController.sendError(res, 404, "User not found");

      // Update fields (only provided ones)
      const updates = {};
      if (name) updates.name = name;
      if (username) updates.username = username;
      if (email) updates.email = email;
      if (gender) updates.gender = gender;
      if (mobile_no) updates.mobile_no = mobile_no;
      if (aadhar_card) updates.aadhar_card = aadhar_card;
      if (address) updates.address = address;

      await user.update(updates);

      // Role handling
      if (roleName !== undefined && roleName !== null && roleName !== "") {
        const parsedRoleId = parseInt(roleName, 10);
        const userRole = await UserRole.findOne({ where: { user_id: id } });

        if (userRole) {
          await UserRole.update(
            { role_id: parsedRoleId },
            { where: { user_id: id } }
          );
        } else {
          await UserRole.create({ user_id: id, role_id: parsedRoleId });
        }
      }

      const selectedCompanyInput = pickCompanyInput({ ...req.body, companyIds });
      if (selectedCompanyInput !== undefined) {
        const parsedCompanyIds = normalizeCompanyIds(selectedCompanyInput);
        await UserCompany.destroy({ where: { user_id: id } });
        if (parsedCompanyIds.length > 0) {
          await UserCompany.bulkCreate(
            parsedCompanyIds.map((company_id) => ({
              user_id: id,
              company_id,
            }))
          );
        }
      }


      const responseUser = await getUserWithRoleAndCompanies(id);
      return AdminController.sendSuccess(res, "User updated successfully", { data: responseUser || user });
    } catch (error) {
      console.error("updateUser Error:", error);
      return AdminController.sendError(res, 500, "Failed to update user", error);
    }
  };

  // ----------------------------
  // DELETE USER
  // ----------------------------
  static deleteUser = async (req, res) => {
    const { user_id } = req.params;
    console.log("deleteUser called with user_id:", user_id);
    try {
      await UserRole.destroy({ where: { user_id } });
      await UserCompany.destroy({ where: { user_id } });

      const deletedCount = await User.destroy({ where: { id: user_id } });
      if (!deletedCount) {
        return AdminController.sendError(res, 404, "User not found");
      }

      return AdminController.sendSuccess(res, "User deleted successfully");
    } catch (error) {
      console.error("deleteUser Error:", error);
      return AdminController.sendError(res, 500, "Failed to delete user", error);
    }
  };


  // ----------------------------
  // getUserIDFromToken (safe)
  // ----------------------------
  static getUserIDFromToken = (req) => {
    const { authorization } = req.headers;
    if (!authorization || !authorization.startsWith("Bearer ")) {
      throw new Error("Authorization header is missing or malformed");
    }
    const token = authorization.split(" ")[1];
    if (!token) throw new Error("Token missing");
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    return decoded.userID;
  };

  // ----------------------------
  // GET ALL USERS
  // ----------------------------
  static getAllUsers = async (req, res) => {
    try {
      const users = await User.findAll({
        attributes: { exclude: ["password"] },
        include: [
          {
            model: UserRole,
            attributes: ["role_id"],
        include: [{ model: Role, attributes: ["id", "role_name"] }],
          },
          {
            model: Company,
            through: { attributes: [] },
            attributes: ["id", "company_name"],
          },
        ],
      });

      const normalizedUsers = users.map((u) => decorateUserWithCompanies(u.toJSON()));

      return res.status(200).json({ status: "success", users: normalizedUsers });
    } catch (error) {
      console.error("getAllUsers Error:", error);
      return AdminController.sendError(res, 500, "Server error", error);
    }
  };

  // ----------------------------
  // GET ALL USERS BY OFFICE
  // ----------------------------
  static getAllUsersOfficeby = async (req, res) => {
    try {
      const officeId = req.params.officeid;
      const response = await User.findAll({
        where: { office_id: officeId },
        include: [
          {
            model: UserRole,
            attributes: ["role_id"],
        include: [{ model: Role, attributes: ["id", "role_name"] }],
          },
          { model: Company, attributes: ["id", "company_name"], through: { attributes: [] } },
        ],
        attributes: ["id", "role_id", "office_id", "name", "username", "mobile_no", "emp_dept", "createdAt", "updatedAt"],
      });

      return AdminController.sendSuccess(res, "Users fetched", {
        data: response.map((u) => decorateUserWithCompanies(u.toJSON())),
      });
    } catch (error) {
      console.error("getAllUsersOfficeby Error:", error);
      return AdminController.sendError(res, 500, "Server error", error);
    }
  };
  // ----------------------------
  // GET SINGLE INSPECTOR BY ID
  // ----------------------------
  static getSingleInspectorById = async (req, res) => {
  try {
    const inspectorId = AdminController.getUserIDFromToken(req);

    const user = await User.findByPk(inspectorId, {
      attributes: { exclude: ["password"] },
    });
    if (!user) return AdminController.sendError(res, 404, "User not found");

    const userRole = await UserRole.findOne({
      where: { user_id: user.id },
      include: [{ model: Role, attributes: ["id", "role_name"] }],
    });
    if (!userRole || !userRole.Role) {
      return AdminController.sendError(res, 403, "Role not assigned");
    }

    const roleName = (userRole.Role.role_name || "").toLowerCase();
    if (roleName !== "inspector") {
      return AdminController.sendError(res, 403, "You are not an inspector");
    }

    return AdminController.sendSuccess(res, "Inspector fetched", {
      data: { ...user.toJSON(), role: userRole.Role.role_name, role_id: userRole.role_id },
    });
  } catch (error) {
    console.error("getSingleInspectorById Error:", error);
    return AdminController.sendError(res, 500, "Server error", error);
  }
};

  static getUserCompanies = async (req, res) => {
    try {
      const user = await User.findByPk(req.params.id, {
        include: [
          {
            model: Company,
            through: { attributes: [] },
            attributes: ["id", "company_name"],
          },
        ],
      });

      if (!user) {
        return AdminController.sendError(res, 404, "User not found");
      }

      return AdminController.sendSuccess(res, "User companies fetched", {
        data: user.Companies || [],
      });
    } catch (error) {
      return AdminController.sendError(res, 500, "Server error", error);
    }
  };

  // ----------------------------
  // ASSIGN ROLE TO USER
  // ----------------------------
  static assignRoleToUser = async (req, res) => {
    const { userId, roleId } = req.body;
    try {
      const user = await User.findByPk(userId);
      if (!user) return AdminController.sendError(res, 404, "User not found");

      const role = await Role.findByPk(roleId);
      if (!role) return AdminController.sendError(res, 404, "Role not found");

      // Upsert in user_role
      const [userRole, created] = await UserRole.findOrCreate({
        where: { user_id: userId },
        defaults: { role_id: roleId },
      });

      if (!created) {
        userRole.role_id = roleId;
        await userRole.save();
      }

      // If Admin role, optionally assign all permissions (your original logic hinted at that)
      if (role.role_name === "Admin") {
        const allPermissions = await Permission.findAll();
        // Assign each permission to role if not already assigned
        for (const p of allPermissions) {
          await RolePermission.findOrCreate({
            where: { role_id: roleId, permission_id: p.id },
          });
        }
      }

      return AdminController.sendSuccess(res, "Role assigned successfully");
    } catch (error) {
      console.error("assignRoleToUser Error:", error);
      return AdminController.sendError(res, 500, "Server error", error);
    }
  };

  // ----------------------------
  // CHECK USER PERMISSION
  // ----------------------------
  static checkUserPermission = async (req, res) => {
    const { userId, permissionName } = req.body;
    if (!userId || !permissionName) {
      return AdminController.sendError(res, 400, "userId and permissionName required");
    }

    try {
      // Find user roles and permissions
      const user = await User.findByPk(userId, {
        include: [
          {
            model: UserRole,
            include: [{ model: Role, include: [{ model: RolePermission, include: [Permission] }] }],
          },
        ],
      });

      if (!user) return AdminController.sendError(res, 404, "User not found");

      // Walk through structure to find permission
      let found = false;
      if (user.UserRoles && user.UserRoles.length) {
        for (const ur of user.UserRoles) {
          if (ur.Role && ur.Role.RolePermissions) {
            for (const rp of ur.Role.RolePermissions) {
              if (rp.Permission && (rp.Permission.permission_name === permissionName || rp.Permission.permission_key === permissionName)) {
                found = true;
                break;
              }
            }
          }
          if (found) break;
        }
      }

      if (found) {
        return AdminController.sendSuccess(res, "User has permission");
      } else {
        return AdminController.sendError(res, 403, "User does not have permission");
      }
    } catch (error) {
      console.error("checkUserPermission Error:", error);
      return AdminController.sendError(res, 500, "Server error", error);
    }
  };

  // ----------------------------
  // SEND VERIFICATION EMAIL
  // ----------------------------
  static sendVerificationEmail = async (email, token) => {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn("SMTP is not configured. Skipping email send.");
      return;
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
      secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const verificationLink = `${process.env.APP_URL || "http://localhost:3000"}/auth/verify-email?token=${token}`;

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: "Email Verification",
      html: `<p>Click the link to verify your email: <a href="${verificationLink}">Verify Email</a></p>`,
    };

    await transporter.sendMail(mailOptions);
  };
}

export default AdminController;
