// Model/Permission.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/connectiondb.js';

const Permission = sequelize.define('Permission', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false,
  },
  permission_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  permission_key: {
    type: DataTypes.STRING,
    allowNull: false,
  }
}, {
  tableName: 'permissions',
  timestamps: false,
});

export default Permission;
