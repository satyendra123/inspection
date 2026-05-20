import { DataTypes } from "sequelize";
import sequelize from "../config/connectiondb.js";

const InspectionCase = sequelize.define(
  "inspection_cases",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    po_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    status: { type: DataTypes.ENUM("open", "closed"), allowNull: false, defaultValue: "open" },
  },
  { tableName: "inspection_cases", timestamps: true }
);

export default InspectionCase;
