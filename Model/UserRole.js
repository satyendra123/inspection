// Model/UserRole.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/connectiondb.js';

const UserRole = sequelize.define('UserRole', {
  user_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'users', // References the User table
      key: 'id',
    },
  },
  role_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'roles', // References the Role table
      key: 'id',
    },
  },
}, {
  tableName: 'user_roles', // Ensure this matches your database table name
  timestamps: false, // Disable timestamps if not needed
});

export default UserRole;