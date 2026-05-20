import { DataTypes } from "sequelize";
import sequelize from "../config/connectiondb.js";

const Stage = sequelize.define(
  "Stages",
  {
      id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
     stage_icon: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    stage_name: {
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
    tableName: "stages",
    timestamps: true,
  }
);

export default Stage;
