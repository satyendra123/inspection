import { DataTypes } from "sequelize";
import sequelize from "../config/connectiondb.js";

const Inspection = sequelize.define("inspections", {
  po_id: DataTypes.INTEGER,
  inspector_id: DataTypes.INTEGER,
  assignment_id: DataTypes.INTEGER,
  case_id: { type: DataTypes.INTEGER, allowNull: true },
  purchase_order_item_id: { type: DataTypes.INTEGER, allowNull: true },

  inspection_location: DataTypes.STRING,
  schedule_datetime: DataTypes.DATE,
  status: DataTypes.STRING,
  remarks: DataTypes.STRING,
  assigned_by: DataTypes.INTEGER
});

export default Inspection;
