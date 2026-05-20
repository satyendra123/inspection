import { DataTypes } from "sequelize";
import sequelize from "../config/connectiondb.js";

const Project = sequelize.define(
  "projects",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    project_name: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.ENUM("active", "inactive"), defaultValue: "active" },
  },
  { timestamps: true }
);

export default Project;
