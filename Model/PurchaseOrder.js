import { DataTypes } from "sequelize";
import sequelize from "../config/connectiondb.js";

const PurchaseOrder = sequelize.define("purchase_orders", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    po_number: DataTypes.STRING,
    project_name: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    project_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    vendor_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    po_date: DataTypes.DATE,
    delivery_date: DataTypes.DATE,
    attachment: DataTypes.TEXT,
    design_copy: DataTypes.TEXT,
    design_ref: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    created_by_name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    updated_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    updated_by_name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
},
    {
        timestamps: true,       // adds createdAt, updatedAt
        underscored: false      // use camelCase (createdAt)
    });

export default PurchaseOrder;
