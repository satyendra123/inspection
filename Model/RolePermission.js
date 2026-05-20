// Model/RolePermission.js
import { DataTypes } from 'sequelize';
import sequelize from'../config/connectiondb.js';
import Role from './Role.js';
import Permission from './Permission.js';

const RolePermission = sequelize.define('RolePermission', {
    rp_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,  // Make it auto-increment
        primaryKey: true,     // Set as primary key
        allowNull: false,
      },
    role_id: {
        type: DataTypes.INTEGER,
        references: {
            model: Role,
            key: 'id',
        },
        onDelete: 'CASCADE',
        allowNull: false,
    },
    permission_id: {
        type: DataTypes.INTEGER,
        references: {
            model: Permission,
            key: 'id',
        },
        onDelete: 'CASCADE',
        allowNull: false,
    },
}, {
    tableName: 'role_permissions',
    timestamps: false,
});

export default RolePermission;
