import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/evidence"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`);
  },
});

export default multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB per file
});
