import { DataTypes } from "sequelize";
import sequelize from "../config/connectiondb.js";

const UserCompany = sequelize.define(
  "UserCompany",
  {
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
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
    tableName: "user_companies",
    timestamps: false,
  }
);

export default UserCompany;
