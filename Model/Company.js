import { DataTypes } from "sequelize";
import sequelize from "../config/connectiondb.js";

const Company = sequelize.define(
  "Company",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    company_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    registered_address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    state: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    pin: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    cin_no: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gstin_no: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    contact_no: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    website: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
    logo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "companies",
    timestamps: true,
  }
);

export default Company;
