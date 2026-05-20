// middlewares/checkPermission.js
import { Op } from "sequelize";
import { UserRole, RolePermission, Permission } from "../Model/index.js";
import jwt from "jsonwebtoken";

const getBearerToken = (req) => {
  const header = req.headers["authorization"];
  if (!header) return null;
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return header.trim();
};

const normalizeRequiredPermissions = (requiredPermission) => {
  const keys = Array.isArray(requiredPermission)
    ? requiredPermission
    : [requiredPermission];

  return [...new Set(keys.map((key) => String(key || "").trim()).filter(Boolean))];
};

const hasAnyPermission = (availablePermissions, requiredKeys) => {
  const normalizedAvailable = new Set(
    normalizeRequiredPermissions(availablePermissions),
  );

  return requiredKeys.some((key) => normalizedAvailable.has(key));
};

const hasAdminRole = (req) => {
  const candidates = [
    req?.user?.role,
    req?.user?.fullData?.role_name,
    req?.user?.fullData?.role,
  ];

  return candidates.some((value) =>
    String(value || "").trim().toLowerCase().includes("admin"),
  );
};

export const checkPermission = (requiredPermission) => {
  const requiredKeys = normalizeRequiredPermissions(requiredPermission);

  return async (req, res, next) => {
    try {
      if (process.env.TEST_BYPASS_AUTH === "true") {
        return next();
      }

      if (!requiredKeys.length) return next();

      const token = getBearerToken(req);
      if (!token) {
        return res.status(403).send({ status: "failed", msg: "No token provided" });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

      if (
        hasAdminRole(req) ||
        String(decoded?.role || "").trim().toLowerCase().includes("admin")
      ) {
        return next();
      }

      if (
        hasAnyPermission(
          [
            ...(Array.isArray(req?.user?.permissions) ? req.user.permissions : []),
            ...(Array.isArray(decoded?.permissions) ? decoded.permissions : []),
          ],
          requiredKeys,
        )
      ) {
        return next();
      }

      const userRoles = await UserRole.findAll({ where: { user_id: decoded.userID } });
      const roleIds = userRoles.map((ur) => ur.role_id).filter(Boolean);
      if (!roleIds.length) {
        return res.status(403).json({ message: "Access denied: No roles assigned" });
      }

      const permissions = await Permission.findAll({
        where: { permission_key: { [Op.in]: requiredKeys } },
        attributes: ["id", "permission_key"],
      });

      if (!permissions.length) {
        return res.status(404).json({
          message: `Permission not found (${requiredKeys.join(" OR ")})`,
        });
      }

      const permissionIds = permissions.map((p) => p.id);
      const hasPermission = await RolePermission.findOne({
        where: {
          role_id: { [Op.in]: roleIds },
          permission_id: { [Op.in]: permissionIds },
        },
      });

      if (!hasPermission) {
        return res.status(403).json({ message: "Access denied: Insufficient permissions" });
      }

      return next();
    } catch (error) {
      return res.status(500).json({
        message: "Internal server error",
        error: error.message,
      });
    }
  };
};

export const verifyAdminPermission = async (req, res, next) => {
  try {
    if (process.env.TEST_BYPASS_AUTH === "true") {
      return next();
    }

    const token = getBearerToken(req);
    if (!token) {
      return res.status(403).send({ status: "failed", msg: "No token provided" });
    }

    jwt.verify(token, process.env.JWT_SECRET_KEY);

    if (!hasAdminRole(req)) {
      return res.status(403).send({
        status: "failed",
        msg: "Access denied: Admin access only",
      });
    }

    return next();
  } catch (error) {
    return res.status(500).send({
      status: "failed",
      msg: "Authorization failed",
      error: error.message,
    });
  }
};

export default checkPermission;
