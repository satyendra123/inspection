import { DataTypes } from "sequelize";
import sequelize from "../config/connectiondb.js";

const InspectionBatch = sequelize.define(
  "inspection_batches",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    assignment_id: { type: DataTypes.INTEGER, allowNull: false }, // ✅ NEW
    purchase_order_item_id: { type: DataTypes.INTEGER, allowNull: false },
    inspection_id: {                 // 🔥 ADD THIS
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "inspection_id"          // DB column
    },
    selected_quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

    status: {
      type: DataTypes.ENUM("active", "completed", "cancelled"),
      allowNull: false,
      defaultValue: "active",
    },

    result: { type: DataTypes.ENUM("pass", "fail"), allowNull: true, defaultValue: null },
    started_by: { type: DataTypes.INTEGER, allowNull: true },
  },
  { tableName: "inspection_batches", timestamps: true }
);

export default InspectionBatch;
