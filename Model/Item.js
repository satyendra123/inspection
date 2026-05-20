import { DataTypes } from "sequelize";
import sequelize from "../config/connectiondb.js";
import {Category,Unit} from "./index.js";
import Sequelize from "sequelize";
const Items = sequelize.define(
    "Items",
    {
        item_name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        Category_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: Category,
                key: "id",
            },
        },
      unit_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
        description: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        status: {
            type: Sequelize.ENUM("active", "inactive", "pending"),
            defaultValue: "active",
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
        tableName: "items",
        timestamps: true,
    }
);

export default Items;
