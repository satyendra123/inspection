import {Category} from "../Model/index.js";

class CategoryController {
  // ⭐ CREATE CATEGORY
  static async create(req, res) {
    try {
      const { category_name, description ,status} = req.body;

      if (!category_name) {
        return res.status(400).json({
          status: "fail",
          message: "Category name is required",
        });
      }

      const newCategory = await Category.create({
        category_name,
        description,
        status,
        created_by: req.user.id,
        created_by_name: req.user.name,
        updated_by: req.user.id,
        updated_by_name: req.user.name,
      });

      return res.status(201).json({
        status: "success",
        message: "Category created successfully",
        data: newCategory,
      });
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: error.message || "Server error",
      });
    }
  }

  // ⭐ GET ALL CATEGORIES
  static async getAll(req, res) {
    try {
      const categories = await Category.findAll();

      return res.status(200).json({
        status: "success",
        message: "Categories fetched successfully",
        data: categories,
      });
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: error.message || "Server error",
      });
    }
  }

  // ⭐ UPDATE CATEGORY
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { category_name, description } = req.body;

      const category = await Category.findByPk(id);
      if (!category) {
        return res.status(404).json({
          status: "fail",
          message: "Category not found",
        });
      }

      await category.update({
        category_name,
        description,
        updated_by: req.user.id,
        updated_by_name: req.user.name,
      });

      return res.status(200).json({
        status: "success",
        message: "Category updated successfully",
        data: category,
      });
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: error.message || "Server error",
      });
    }
  }

  // ⭐ DELETE CATEGORY
  static async delete(req, res) {
    try {
      const { id } = req.params;

      const category = await Category.findByPk(id);
      if (!category) {
        return res.status(404).json({
          status: "fail",
          message: "Category not found",
        });
      }

      await category.destroy();

      return res.status(200).json({
        status: "success",
        message: "Category deleted successfully",
      });
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: error.message || "Server error",
      });
    }
  }
}

export default CategoryController;
