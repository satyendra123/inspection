import { DataTypes } from 'sequelize';
import sequelize from '../config/connectiondb.js';

const Role = sequelize.define('Role', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  role_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'roles',
  freezeTableName: true,
});

export default Role;