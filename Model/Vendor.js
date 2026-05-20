import { DataTypes } from 'sequelize';
import sequelize from '../config/connectiondb.js';
import bcryptjs from 'bcryptjs';

const Vendor = sequelize.define('Vendor', {
  vendor_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  Contact_person: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  mobile_no: {
    type: DataTypes.STRING,
    allowNull: false,
  },
   address: {
    type: DataTypes.STRING,
    allowNull: true,
  },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    created_by_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    updated_by_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
}, {
  tableName: 'vendors',
  timestamps: true,

});
export default Vendor;
