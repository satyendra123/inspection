// models/StageTest.js
import { DataTypes } from "sequelize";
import sequelize from "../config/connectiondb.js";

const StageTest = sequelize.define("stage_tests", {
  po_stage_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  batch_id: { type: DataTypes.INTEGER, allowNull: false },
  inspector_id: { type: DataTypes.INTEGER, allowNull: true },

  item_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  test_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
   inspection_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  remark: {
    type: DataTypes.STRING,
    defaultValue: ""
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null
  },
  gps_location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  inspection_date: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null
  },
  result: {
    type: DataTypes.STRING, // 'pass', 'fail', null
    defaultValue: null
  },
   status: {
    type: DataTypes.STRING, // 'pass', 'fail', null
    defaultValue: null
  },
    documents: {
      type: DataTypes.JSON, // array support
      allowNull: true,
      defaultValue: [],
    },
}, {
  timestamps: true,
  underscored: false
});

export default StageTest;
