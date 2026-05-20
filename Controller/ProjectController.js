import { Project, Company } from "../Model/index.js";

class ProjectController {
  static async create(req, res) {
    try {
      const { company_id, project_name, status } = req.body;
      if (!company_id || !project_name || !String(project_name).trim()) {
        return res.status(400).json({ success: false, message: "company_id and project_name required" });
      }

      const company = await Company.findByPk(Number(company_id));
      if (!company) {
        return res.status(404).json({ success: false, message: "Company not found" });
      }

      const project = await Project.create({
        company_id: Number(company_id),
        project_name: String(project_name).trim(),
        status: status || "active",
      });

      return res.json({ success: true, data: project });
    } catch (e) {
      console.error("Project create:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  static async getAll(req, res) {
    try {
      const company_id = req.query.company_id ? Number(req.query.company_id) : null;
      const where = company_id ? { company_id } : undefined;
      const data = await Project.findAll({
        where,
        include: [{ model: Company, attributes: ["id", "company_name"] }],
        order: [["createdAt", "DESC"]],
      });
      return res.json({ success: true, data });
    } catch (e) {
      console.error("Project list:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  static async getById(req, res) {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, message: "Invalid id" });
      const project = await Project.findByPk(id, {
        include: [{ model: Company, attributes: ["id", "company_name"] }],
      });
      if (!project) return res.status(404).json({ success: false, message: "Not found" });
      return res.json({ success: true, data: project });
    } catch (e) {
      console.error("Project getById:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  static async update(req, res) {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, message: "Invalid id" });
      const { company_id, project_name, status } = req.body;

      const project = await Project.findByPk(id);
      if (!project) return res.status(404).json({ success: false, message: "Not found" });

      if (company_id) {
        const company = await Company.findByPk(Number(company_id));
        if (!company) return res.status(404).json({ success: false, message: "Company not found" });
      }

      await project.update({
        company_id: company_id ? Number(company_id) : project.company_id,
        project_name: project_name ? String(project_name).trim() : project.project_name,
        status: status || project.status,
      });

      return res.json({ success: true, data: project });
    } catch (e) {
      console.error("Project update:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  static async delete(req, res) {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, message: "Invalid id" });
      const project = await Project.findByPk(id);
      if (!project) return res.status(404).json({ success: false, message: "Not found" });
      await project.destroy();
      return res.json({ success: true, message: "Project deleted successfully" });
    } catch (e) {
      console.error("Project delete:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
}

export default ProjectController;
