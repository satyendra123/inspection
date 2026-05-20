import { DataTypes } from "sequelize";
import sequelize from "../config/connectiondb.js";

const InspectionEvent = sequelize.define(
  "inspection_events",
  {
    inspection_id: { type: DataTypes.INTEGER, allowNull: true }, // ✅ nullable now
    assignment_id: { type: DataTypes.INTEGER, allowNull: true },
    case_id: { type: DataTypes.INTEGER, allowNull: true },
    po_id: { type: DataTypes.INTEGER, allowNull: true },

    actor_user_id: { type: DataTypes.INTEGER, allowNull: true },

    type: {
      type: DataTypes.ENUM(
        "assign_inspector",
        "reassign_inspector",
        "start_inspection",
        "reschedule",
        "reschedule_item",
        "cancel",
        "cancel_item",
        "reject_item",
        "complete",
        "rework",
        "status_change",
        "items_change"
      ),
      allowNull: false,
    },

    note: { type: DataTypes.TEXT, allowNull: true },
    before: { type: DataTypes.JSON, allowNull: true },
    after: { type: DataTypes.JSON, allowNull: true },
  },
  { timestamps: true }
);

export default InspectionEvent;
