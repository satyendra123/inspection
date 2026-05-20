import { DataTypes } from "sequelize";
import sequelize from "../config/connectiondb.js";

const InspectionAssignment = sequelize.define(
  "inspection_assignments",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    case_id: { type: DataTypes.INTEGER, allowNull: false },
    inspector_id: { type: DataTypes.INTEGER, allowNull: false },

    inspection_location: { type: DataTypes.STRING(255), allowNull: false },
    scheduled_on: { type: DataTypes.DATE, allowNull: false },

    remarks: { type: DataTypes.TEXT, allowNull: true },

    status: {
      type: DataTypes.ENUM("active", "rescheduled", "cancelled", "completed", "reassigned", "assigned", "in_process"),
      allowNull: false,
      defaultValue: "active",
    },

    assigned_by: { type: DataTypes.INTEGER, allowNull: true },
    ended_at: { type: DataTypes.DATE, allowNull: true },
    ended_by: { type: DataTypes.INTEGER, allowNull: true },
  },
  { tableName: "inspection_assignments", underscored: true,timestamps: true }
);

export default InspectionAssignment;
