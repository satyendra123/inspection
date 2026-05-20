import { DataTypes } from "sequelize";
import sequelize from "../config/connectiondb.js";

const Test = sequelize.define(
  "Test",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    test_icon: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    test_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    instrument: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    attachment: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },

    document: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    description: {
      type: DataTypes.TEXT,
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
    tableName: "tests",
    timestamps: true,
  }
);

export default Test;
