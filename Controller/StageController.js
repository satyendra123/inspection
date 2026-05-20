// controllers/StageController.js
import { Stage } from "../Model/index.js";

class StageController {

  // 🔹 CREATE Stage
  static async create(req, res) {
    try {
      const { stage_name, description, status } = req.body;

      const stage_icon = `uploads/stage/${req.file.filename}`;

      // user from auth middleware
      if (!req.user) {
        return res.status(401).json({ status: "error", message: "Unauthorized" });
      }

      const stage = await Stage.create({
        stage_icon,
        stage_name,
        description,
        status,
        created_by: req.user.id,
        created_by_name: req.user.name,
        updated_by: req.user.id,
        updated_by_name: req.user.name,
      });

      res.status(201).json({
        status: "success",
        message: "Stage created successfully",
        data: stage,
      });
    } catch (err) {
      res.status(500).json({ status: "error", message: err.message });
    }
  }

  // 🔹 GET All Stages
  static async getAll(req, res) {
    try {
      const stages = await Stage.findAll({
        order: [["id", "DESC"]],
      });

      res.json({
        status: "success",
        data: stages,
      });
    } catch (err) {
      res.status(500).json({ status: "error", message: err.message });
    }
  }

  // 🔹 GET Single Stage
  static async getById(req, res) {
    try {
      const stage = await Stage.findByPk(req.params.id);

      if (!stage) {
        return res.status(404).json({
          status: "error",
          message: "Stage not found",
        });
      }

      res.json({ status: "success", data: stage });
    } catch (err) {
      res.status(500).json({ status: "error", message: err.message });
    }
  }

  // 🔹 UPDATE Stage
  static async update(req, res) {
    try {
      const { stage_name, description, status } = req.body;
      const stage = await Stage.findByPk(req.params.id);

      if (!stage) {
        return res.status(404).json({
          status: "error",
          message: "Stage not found",
        });
      }

      if (req.file) {
        stage.stage_icon = `uploads/stage/${req.file.filename}`;
      }

      stage.stage_name = stage_name ?? stage.stage_name;
      stage.description = description ?? stage.description;
      stage.status = status ?? stage.status;
      stage.updated_by = req.user.id;
      stage.updated_by_name = req.user.name;

      await stage.save();

      res.json({
        status: "success",
        message: "Stage updated successfully",
        data: stage,
      });
    } catch (err) {
      res.status(500).json({ status: "error", message: err.message });
    }
  }

  // 🔹 DELETE Stage
  static async delete(req, res) {
    try {
      const stage = await Stage.findByPk(req.params.id);

      if (!stage) {
        return res.status(404).json({
          status: "error",
          message: "Stage not found",
        });
      }

      await stage.destroy();

      res.json({
        status: "success",
        message: "Stage deleted successfully",
      });
    } catch (err) {
      res.status(500).json({ status: "error", message: err.message });
    }
  }
}

export default StageController;
