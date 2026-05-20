import jwt from "jsonwebtoken";
import Admin from "../Model/User.js";
import Client from "../Model/User.js";
import blacklistedTokens from "./toctokenBlacklist.js";

export const auth = async (req, res, next) => {
  try {
    if (process.env.TEST_BYPASS_AUTH === "true") {
      req.user = { id: 1, name: "Test User", role: "Admin" };
      return next();
    }

    const authHeader = req.headers.authorization;
    const fallbackToken =
      req.headers["x-access-token"] ||
      req.headers["token"] ||
      null;

    let token = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    } else if (authHeader && authHeader.trim()) {
      token = authHeader.trim();
    } else if (fallbackToken && String(fallbackToken).trim()) {
      token = String(fallbackToken).trim();
    }

    // Token exist check
    if (!token) {
      return res.status(401).json({
        status: "failed",
        message: "Unauthorized User, No Token",
      });
    }

    // Blacklist check (Logout token invalidate)
    if (blacklistedTokens.has(token)) {
      return res.status(401).json({
        status: "failed",
        message: "Token is invalid. Please sign in again.",
      });
    }

    // Token verify
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    const userID = decoded.userID;

    // Get user from database
    const user = await Admin.findByPk(userID) || await Client.findByPk(userID);

    if (!user) {
      return res.status(401).json({
        status: "failed",
        message: "User not found",
      });
    }

    // Attach user to req
    req.user = {
      id: user.id,
      name: user.name,
      role: user.role_name ?? decoded.role ?? null,
      permissions: Array.isArray(decoded.permissions) ? decoded.permissions : [],
      fullData: user, // optional full user object
    };

    next();
  } catch (error) {
    console.error("Auth Error:", error);
    return res.status(401).json({
      status: "failed",
      message: "Token verification failed",
    });
  }
};
export default auth;
