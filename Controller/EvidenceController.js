export default class EvidenceController {
  static async upload(req, res) {
    try {
      const files = (req.files || []).map(f => ({
        filename: f.filename,
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
        path: `/uploads/evidence/${f.filename}`,
      }));
      return res.json({ success: true, files });
    } catch (e) {
      console.error("evidence upload:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
}
