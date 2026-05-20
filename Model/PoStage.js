import { DataTypes } from "sequelize";
import sequelize from "../config/connectiondb.js";
import InspectionBatch from "./InspectionBatch.js";

const PoStage = sequelize.define(
  "po_stages",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    inspection_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    stage_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    inspector_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    batch_id: {                      // ✅ CORRECT
      type: DataTypes.INTEGER,
      allowNull: false
    },
    result: {
      type: DataTypes.STRING,
      allowNull: true,
    },
   status: {
      type: DataTypes.ENUM("pending", "In_progress", "completed", "rework"),
      defaultValue: "In_progress",
    },
  },
  {
    tableName: "po_stages",
    timestamps: true,
    engine: "InnoDB",
  }
);

export default PoStage;
