import { Items, Category,Unit } from "../Model/index.js";

class ItemsController {
  // ✅ Create Item
  static async create(req, res) {
    try {
      const { item_name, Category_id, unit_id, description, status } = req.body;
      console.log(req.body);
      const category = await Category.findByPk(Category_id);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      const item = await Items.create({
        item_name,
        Category_id,
        unit_id,
        description,
        status,
        created_by: req.user.id,
        created_by_name: req.user.name,
        updated_by: req.user.id,
        updated_by_name: req.user.name,
      });

      return res.status(201).json({ message: "Item created", data: item });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }

  // ✅ Get All Items
  static async getAll(req, res) {
    try {
      const data = await Items.findAll({
        include: [{ model: Category },{model:Unit}],
      });

      return res.status(200).json({ message: "Items fetched", data });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }

  // ✅ Get Single Item
  static async getById(req, res) {
    try {
      const data = await Items.findByPk(req.params.id);
      if (!data) {
        return res.status(404).json({ message: "Item not found" });
      }

      return res.status(200).json({ message: "Item fetched", data });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }

  // ✅ Update Item
  static async update(req, res) {
    try {
      const item = await Items.findByPk(req.params.id);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      await item.update({
        ...req.body,
        updated_by: req.user.id,
        updated_by_name: req.user.name,
      });

      return res.status(200).json({ message: "Item updated", data: item });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }

  // ✅ Delete Item
  static async delete(req, res) {
    try {
      const item = await Items.findByPk(req.params.id);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      await item.destroy();

      return res.status(200).json({ message: "Item deleted" });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
}

export default ItemsController;
