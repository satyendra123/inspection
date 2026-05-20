import { DataTypes } from "sequelize";
import sequelize from "../config/connectiondb.js";

const InspectionAssignmentItem = sequelize.define(
  "inspection_assignment_items",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    assignment_id: { type: DataTypes.INTEGER, allowNull: false },
    purchase_order_item_id: { type: DataTypes.INTEGER, allowNull: false },

    status: {
      type: DataTypes.ENUM("active", "reassigned", "cancelled", "completed"),
      allowNull: false,
      defaultValue: "active",
    },

    ended_at: { type: DataTypes.DATE, allowNull: true },
    ended_by: { type: DataTypes.INTEGER, allowNull: true },
  },
  { tableName: "inspection_assignment_items", timestamps: true }
);

export default InspectionAssignmentItem;
