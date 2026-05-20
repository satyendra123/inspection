import { DataTypes } from "sequelize";
import sequelize from "../config/connectiondb.js";

const Category = sequelize.define(
  "Category",
  {
    category_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM("active", "inactive", "pending"),
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
    tableName: "categories",
    timestamps: true,
  }
);

export default Category;
