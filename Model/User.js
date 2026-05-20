import { DataTypes } from 'sequelize';
import sequelize from '../config/connectiondb.js';
import bcryptjs from 'bcryptjs';

const User = sequelize.define('User', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
    gender: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  mobile_no: {
    type: DataTypes.STRING,
    allowNull: false,
  },
   aadhar_card: {
    type: DataTypes.STRING,
    allowNull: true,
  },
   address: {
    type: DataTypes.STRING,
    allowNull: true,
  },

    status: {
      type: DataTypes.ENUM("active", "inactive", "pending"),
      defaultValue: "active",
    },
}, {
  tableName: 'users',
  timestamps: true,

});

User.prototype.isValidPassword = async function (password) {
  return await bcryptjs.compare(password, this.password);
};

export default User;
