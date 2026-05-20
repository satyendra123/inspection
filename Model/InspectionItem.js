import { DataTypes } from "sequelize";
import sequelize from "../config/connectiondb.js";

const InspectionItem = sequelize.define(
  "inspection_items",
  {
    inspection_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    item_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
     status: {
      type: DataTypes.ENUM("active", "reassigned"),
      allowNull: false,
      defaultValue: "active",
    },

    ended_at: { type: DataTypes.DATE, allowNull: true },
    ended_by: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    timestamps: true
  }
);

export default InspectionItem;
