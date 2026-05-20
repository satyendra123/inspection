import multer from "multer";
import path from "path";
import fs from "fs";

const baseUploadPath = path.join(process.cwd(), "uploads");

const ensureDir = dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = "common";

    if (req.originalUrl.includes("tests")) folder = "test";
    if (req.originalUrl.includes("stages")) folder = "stage";
    if (req.originalUrl.includes("po")) folder = "po";
    if (req.originalUrl.includes("company") || req.originalUrl.includes("companies")) folder = "company";
    if (req.originalUrl.includes("submit-report")) folder = "report";

    const uploadPath = path.join(baseUploadPath, folder);
    ensureDir(uploadPath);

    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const id =
      req.body.test_id ||
      req.body.stage_id ||
      req.body.po_id ||
      "no-id";

    const uniqueName = `${id}-${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${ext}`;

    cb(null, uniqueName);
  },
});

export default multer({ storage });
