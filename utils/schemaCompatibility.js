import { DataTypes } from "sequelize";

const isDuplicateColumnError = (error) => {
  const code = error?.original?.code || error?.parent?.code || "";
  const message = String(error?.message || "").toLowerCase();
  return code === "ER_DUP_FIELDNAME" || message.includes("duplicate column");
};

export const ensureSchemaCompatibility = async (sequelize) => {
  const queryInterface = sequelize.getQueryInterface();

  try {
    const purchaseOrderColumns = await queryInterface.describeTable("purchase_orders");
    if (!purchaseOrderColumns.project_id) {
      await queryInterface.addColumn("purchase_orders", "project_id", {
        type: DataTypes.INTEGER,
        allowNull: true,
      });
      console.log("Schema compatibility: added purchase_orders.project_id");
    }

    const attachmentType = String(
      purchaseOrderColumns.attachment?.type ||
      purchaseOrderColumns.attachment?.Type ||
      "",
    ).toLowerCase();

    if (purchaseOrderColumns.attachment && !attachmentType.includes("text")) {
      await queryInterface.changeColumn("purchase_orders", "attachment", {
        type: DataTypes.TEXT,
        allowNull: true,
      });
      console.log("Schema compatibility: updated purchase_orders.attachment to TEXT");
    }

    const designCopyType = String(
      purchaseOrderColumns.design_copy?.type ||
      purchaseOrderColumns.design_copy?.Type ||
      "",
    ).toLowerCase();

    if (purchaseOrderColumns.design_copy && !designCopyType.includes("text")) {
      await queryInterface.changeColumn("purchase_orders", "design_copy", {
        type: DataTypes.TEXT,
        allowNull: true,
      });
      console.log("Schema compatibility: updated purchase_orders.design_copy to TEXT");
    }
  } catch (error) {
    if (isDuplicateColumnError(error)) return;
    throw error;
  }

  try {
    const stageTestColumns = await queryInterface.describeTable("stage_tests");
    if (!stageTestColumns.inspection_date) {
      await queryInterface.addColumn("stage_tests", "inspection_date", {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      });
      console.log("Schema compatibility: added stage_tests.inspection_date");
    }
  } catch (error) {
    if (isDuplicateColumnError(error)) return;
    throw error;
  }
};

export default ensureSchemaCompatibility;
