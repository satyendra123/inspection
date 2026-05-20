import {Vendor} from "../Model/index.js";

class VendorController {

  // Create Vendor
  static async create(req, res) {
    try {
      const { vendor_name, Contact_person, email, mobile_no, address } = req.body;

      if (!vendor_name || !mobile_no) {
        return res.status(400).json({ message: "Vendor name & mobile number are required" });
      }

      const vendor = await Vendor.create({
        vendor_name,
        Contact_person: Contact_person,
        email,
        mobile_no,
        address,
        created_by: req.user.id,
        created_by_name: req.user.name,
        updated_by: req.user.id,
        updated_by_name: req.user.name,
      });

      return res.status(201).json({
        message: "Vendor created successfully",
        data: vendor,
      });

    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }

  // Get all vendors
  static async getAll(req, res) {
    try {
      const vendors = await Vendor.findAll();
      return res.status(200).json({
        message: "Vendors fetched successfully",
        data: vendors,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }

  // Get vendor by ID
  static async getById(req, res) {
    try {
      const vendor = await Vendor.findByPk(req.params.id);
      if (!vendor) return res.status(404).json({ message: "Vendor not found" });

      return res.status(200).json({
        message: "Vendor fetched successfully",
        data: vendor,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }

  // Update vendor
  static async update(req, res) {
    try {
      const vendor = await Vendor.findByPk(req.params.id);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }

      await vendor.update({
        ...req.body,
        updated_by: req.user.id,
        updated_by_name: req.user.name,
      });

      return res.status(200).json({
        message: "Vendor updated successfully",
        data: vendor,
      });

    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }

  // Delete vendor
  static async delete(req, res) {
    try {
      const vendor = await Vendor.findByPk(req.params.id);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }

      await vendor.destroy();

      return res.status(200).json({
        message: "Vendor deleted successfully",
      });

    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
}

export default VendorController;
