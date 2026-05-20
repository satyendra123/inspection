import { DataTypes } from "sequelize";
import sequelize from "../config/connectiondb.js";

const PurchaseOrderItem = sequelize.define("purchase_order_items", {
  po_id: DataTypes.INTEGER,
  quantity: DataTypes.INTEGER,
  item_id: DataTypes.INTEGER ,
},{
  timestamps: true,       // adds createdAt, updatedAt
  underscored: false      // use camelCase (createdAt)
});

export default PurchaseOrderItem;
