import { Test } from "../Model/index.js";
import path from "path";
import fs from "fs";

class TestController {

  // Create Test

  static async createTest(req, res) {
    try {
      const { test_name, instrument, description, status } = req.body;
      const user = req.user; // from auth middleware

      let test_icon = null;
      let document = null;
      let attachment = [];
      if (req.files?.test_icon?.length) {
        test_icon = `uploads/test/${req.files.test_icon[0].filename}`;
      }

      if (req.files?.document?.length) {
        document = `uploads/test/${req.files.document[0].filename}`;
      }

      // // Handle test_icon
      // if (req.files?.test_icon?.length) {
      //   const file = req.files.test_icon[0];
      //   const ext = path.extname(file.originalname);
      //   const newFileName = `${file.filename}${ext}`; // Add extension
      //   fs.renameSync(file.path, path.join(path.dirname(file.path), newFileName));
      //   test_icon = `uploads/${newFileName}`;
      // }

      // // Handle document
      // if (req.files?.document?.length) {
      //   const file = req.files.document[0];
      //   const ext = path.extname(file.originalname);
      //   const newFileName = `${file.filename}${ext}`;
      //   fs.renameSync(file.path, path.join(path.dirname(file.path), newFileName));
      //   document = `uploads/${newFileName}`;
      // }

      // Handle multiple attachments
      // if (req.files?.attachment) {
      //   attachment = req.files.attachment.map(file => {
      //     const ext = path.extname(file.originalname);
      //     const newFileName = `${file.filename}${ext}`;
      //     fs.renameSync(file.path, path.join(path.dirname(file.path), newFileName));
      //     return `uploads/${newFileName}`;
      //   });
      // }

      const test = await Test.create({
        test_icon,
        test_name,
        instrument,
        attachment,
        document,
        description,
        status,
        created_by: user.id,
        created_by_name: user.name,
        updated_by: user.id,
        updated_by_name: user.name,
      });

      res.status(201).json({ status: "success", data: test });

    } catch (err) {
      console.error(err);
      res.status(500).json({ status: "error", message: err.message });
    }
  }


  // Get All
  // getAll
  static async getAll(req, res) {
    try {
      const data = await Test.findAll();

      const formattedData = data.map(test => {
        return {
          ...test.toJSON(),
          test_icon: test.test_icon ? test.test_icon.replace(/\\/g, "/") : null,
          document: test.document ? test.document.replace(/\\/g, "/") : null,
          attachment: Array.isArray(test.attachment) ? test.attachment.map(a => a.replace(/\\/g, "/")) : [],
        };
      });

      res.json({ status: "success", data: formattedData });
    } catch (err) {
      res.status(500).json({ status: "error", message: err.message });
    }
  }


  // Get One
  static async getOne(req, res) {
    try {
      const data = await Test.findByPk(req.params.id);
      if (!data) {
        return res.status(404).json({ status: "fail", message: "Test not found" });
      }
      res.json({ status: "success", data });
    } catch (err) {
      res.status(500).json({ status: "error", message: err.message });
    }
  }

  // Update
// Update
static async update(req, res) {
  try {
    const id = req.params.id;
    const body = req.body;

    const updateData = { ...body };

    // test_icon update
    if (req.files?.test_icon?.length) {
      updateData.test_icon = `uploads/test/${req.files.test_icon[0].filename}`;
    }

    // document update
    if (req.files?.document?.length) {
      updateData.document = `uploads/test/${req.files.document[0].filename}`;
    }

    // attachment update (multiple files)
    if (req.files?.attachment?.length) {
      updateData.attachment = req.files.attachment.map(file => file.path);
    }

    const [updated] = await Test.update(updateData, {
      where: { id }
    });

    if (!updated) {
      return res.status(404).json({
        status: "fail",
        message: "Test not found"
      });
    }

    res.json({
      status: "success",
      message: "Updated successfully"
    });

  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
}


  // Delete
  static async delete(req, res) {
    try {
      const id = req.params.id;
      const deleted = await Test.destroy({ where: { id } });

      if (!deleted) {
        return res.status(404).json({ status: "fail", message: "Test not found" });
      }

      res.json({ status: "success", message: "Deleted successfully" });

    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
}

export default TestController;
