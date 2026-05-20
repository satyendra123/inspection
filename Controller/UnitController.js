import { Unit } from "../Model/index.js";


class UnitController {
static getAllUnits = async (req, res) => {
  try {
    const units = await Unit.findAll({
      order: [["id", "DESC"]],
    });

    return res.status(200).json({
      status: "success",
      msg: "All Units List",
      data: units,
    });
  } catch (error) {
    console.error("getAllUnits error:", error);
    return res.status(500).json({
      status: "error",
      msg: "Failed to fetch units",
    });
  }
};

static createUnit = async (req, res) => {
  try {
    const { unit_name, description, status } = req.body;

    if (!unit_name) {
      return res.status(400).json({
        status: "error",
        msg: "Unit name is required",
      });
    }

    const unit = await Unit.create({
      unit_name,
      description,
      status: status || "active",
    });

    return res.status(201).json({
      status: "success",
      msg: "Unit created successfully",
      data: unit,
    });
  } catch (error) {
    console.error("createUnit error:", error);
    return res.status(500).json({
      status: "error",
      msg: "Failed to create unit",
    });
  }
};

static getUnitById = async (req, res) => {
  try {
    const { id } = req.params;

    const unit = await Unit.findByPk(id);

    if (!unit) {
      return res.status(404).json({
        status: "error",
        msg: "Unit not found",
      });
    }

    return res.status(200).json({
      status: "success",
      data: unit,
    });
  } catch (error) {
    console.error("getUnitById error:", error);
    return res.status(500).json({
      status: "error",
      msg: "Failed to fetch unit",
    });
  }
};

static updateUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const { unit_name, description, status } = req.body;

    const unit = await Unit.findByPk(id);

    if (!unit) {
      return res.status(404).json({
        status: "error",
        msg: "Unit not found",
      });
    }

    await unit.update({
      unit_name: unit_name ?? unit.unit_name,
      description: description ?? unit.description,
      status: status ?? unit.status,
    });

    return res.status(200).json({
      status: "success",
      msg: "Unit updated successfully",
      data: unit,
    });
  } catch (error) {
    console.error("updateUnit error:", error);
    return res.status(500).json({
      status: "error",
      msg: "Failed to update unit",
    });
  }
};


static deleteUnit = async (req, res) => {
  try {
    const { id } = req.params;

    const unit = await Unit.findByPk(id);

    if (!unit) {
      return res.status(404).json({
        status: "error",
        msg: "Unit not found",
      });
    }

    await unit.destroy();

    return res.status(200).json({
      status: "success",
      msg: "Unit deleted successfully",
    });
  } catch (error) {
    console.error("deleteUnit error:", error);
    return res.status(500).json({
      status: "error",
      msg: "Failed to delete unit",
    });
  }
}
}
export default UnitController;