import { Company } from "../Model/index.js";

const withLogoUrl = (row) => {
  const data = typeof row?.toJSON === "function" ? row.toJSON() : row;
  if (!data) return data;

  const base = process.env.APP_URL || "";
  const relative = data.logo ? `/${String(data.logo).replace(/^\/+/, "")}` : null;
  const logo_url = relative ? `${base}${relative}` : null;

  return {
    ...data,
    logo_url,
  };
};

class CompanyController {
static create = async (req, res) => {
  try {
    const {
      company_name,
      name,
      registered_address,
      city,
      state,
      pin,
      cin_no,
      gstin_no,
      contact_no,
      email_id,
      website,
      status,
    } = req.body;

    const resolvedCompanyName = company_name || name;
    if (!resolvedCompanyName) {
      return res.status(400).json({ status: "failed", msg: "Company name is required" });
    }

    const normalizedStatus = status === undefined || status === null || status === ""
      ? "active"
      : String(status).trim().toLowerCase();
    if (!["active", "inactive"].includes(normalizedStatus)) {
      return res.status(400).json({ status: "failed", msg: "Invalid status. Use active or inactive." });
    }

    const exists = await Company.findOne({ where: { company_name: resolvedCompanyName } });
    if (exists) {
      return res.status(409).json({ status: "failed", msg: "Company already exists" });
    }

    const company = await Company.create({
      company_name: resolvedCompanyName,
      registered_address,
      city,
      state,
      pin,
      cin_no,
      gstin_no,
      contact_no,
      email_id,
      website,
      status: normalizedStatus,
      logo: req.file ? `uploads/company/${req.file.filename}` : null,
    });

    return res.status(201).json({
      status: "success",
      msg: "Company created successfully",
      data: withLogoUrl(company),
    });
  } catch (error) {
    return res.status(500).json({ status: "failed", msg: "Server error", error: error.message });
  }
};


  static getAll = async (req, res) => {
    try {
      const data = await Company.findAll({ order: [["company_name", "ASC"]] });
      return res.status(200).json({ status: "success", data: data.map(withLogoUrl) });
    } catch (error) {
      return res.status(500).json({ status: "failed", msg: "Server error", error: error.message });
    }
  };

  static getById = async (req, res) => {
    try {
      const company = await Company.findByPk(req.params.id);
      if (!company) {
        return res.status(404).json({ status: "failed", msg: "Company not found" });
      }
      return res.status(200).json({ status: "success", data: withLogoUrl(company) });
    } catch (error) {
      return res.status(500).json({ status: "failed", msg: "Server error", error: error.message });
    }
  };

  static update = async (req, res) => {
    try {
      const company = await Company.findByPk(req.params.id);
      if (!company) {
        return res.status(404).json({ status: "failed", msg: "Company not found" });
      }

      const updates = { ...req.body };
      if (!updates.company_name && updates.name) {
        updates.company_name = updates.name;
      }
      if (updates.status !== undefined) {
        const normalizedStatus = String(updates.status).trim().toLowerCase();
        if (!["active", "inactive"].includes(normalizedStatus)) {
          return res.status(400).json({ status: "failed", msg: "Invalid status. Use active or inactive." });
        }
        updates.status = normalizedStatus;
      }
      if (req.file) {
        updates.logo = `uploads/company/${req.file.filename}`;
      }

      await company.update(updates);
      return res.status(200).json({
        status: "success",
        msg: "Company updated successfully",
        data: withLogoUrl(company),
      });
    } catch (error) {
      return res.status(500).json({ status: "failed", msg: "Server error", error: error.message });
    }
  };

  static delete = async (req, res) => {
    try {
      const company = await Company.findByPk(req.params.id);
      if (!company) {
        return res.status(404).json({ status: "failed", msg: "Company not found" });
      }
      await company.destroy();
      return res.status(200).json({ status: "success", msg: "Company deleted successfully" });
    } catch (error) {
      return res.status(500).json({ status: "failed", msg: "Server error", error: error.message });
    }
  };
}

export default CompanyController;
