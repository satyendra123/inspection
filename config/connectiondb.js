import { Sequelize } from "sequelize";
import dotenv from "dotenv";
dotenv.config();

process.env.TZ = "Asia/Kolkata";

const sequelize = new Sequelize("insp_mgmt", "root", "", {
  host: "127.0.0.1",
  dialect: "mysql",
  timezone: "+05:30",
  dialectOptions: {
    dateStrings: true,
    typeCast: function (field, next) {
      if (field.type === "DATETIME") {
        return field.string();
      }
      return next();
    },
  },
  logging: false,
});

export default sequelize;
