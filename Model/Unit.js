// Model/Unit.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/connectiondb.js';
 const Unit = sequelize.define(
    "Unit",
    {
      unit_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: DataTypes.TEXT,
      status: {
        type: DataTypes.STRING,
        defaultValue: "active",
      },
    },
    {
      tableName: "units",
      timestamps: true,
      underscored: true,
    }
  );
    export default Unit;