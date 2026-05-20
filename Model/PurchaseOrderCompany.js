import { DataTypes } from "sequelize";
import sequelize from "../config/connectiondb.js";

const PurchaseOrderCompany = sequelize.define(
  "PurchaseOrderCompany",
  {
    po_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "purchase_orders",
        key: "id",
      },
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "companies",
        key: "id",
      },
    },
  },
  {
    tableName: "purchase_order_companies",
    timestamps: false,
  }
);

export default PurchaseOrderCompany;
