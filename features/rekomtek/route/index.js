const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// 1. Buat folder "uploads" secara otomatis jika belum ada
const uploadDir = path.join(__dirname, "../../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 2. Konfigurasi Multer Lokal khusus untuk Dokumen Rekomtek
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // Simpan di folder uploads/
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Format nama file: REKOMTEK-1698273...pdf
    cb(null, "REKOMTEK-" + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadRekomtek = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Validasi agar hanya menerima file PDF / Word
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.pdf' && ext !== '.doc' && ext !== '.docx') {
      return cb(new Error('Hanya file PDF, DOC, dan DOCX yang diizinkan'));
    }
    cb(null, true);
  }
});

const {
  getPendaftarRekomtek,
  downloadDataRekomtek,
  uploadDokumenRekomtek,
  cekDokumenRekomtek,
  kirimKeFlow14
} = require("../controller");

router.get("/list", getPendaftarRekomtek);
router.get("/download", downloadDataRekomtek);
router.get("/cek-dokumen", cekDokumenRekomtek);
router.put("/kirim", kirimKeFlow14);

// 3. Gunakan middleware lokal "uploadRekomtek" yang baru saja kita buat
router.post("/upload-dokumen", uploadRekomtek.single("file"), uploadDokumenRekomtek);

module.exports = router;