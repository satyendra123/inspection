// Model/Userlog.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/connectiondb.js';
import { User } from '../Model/index.js'
const UserLog = sequelize.define('UserLog', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,   // सीधे मॉडल रेफरेंस
      key: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  },

  logout_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  token: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  login_time: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  logout_time: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'userlog',
  timestamps: false,
});

export default UserLog;
