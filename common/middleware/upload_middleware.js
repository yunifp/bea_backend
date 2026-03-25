const multer = require("multer");
const path = require("path");
const fs = require("fs");

const baseUploadDir = process.env.FILE_URL;

// Fungsi untuk membuat folder jika belum ada
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Storage configuration dengan dynamic folder
const createStorage = (folderName) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(baseUploadDir, folderName);
      ensureDirectoryExists(uploadPath);
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1e6);

      // Nama file berdasarkan folder type
      let prefix = "file";
      switch (folderName) {
        case "persyaratan":
          prefix = "persyaratan";
          break;
        case "profile":
          prefix = "profile";
          break;
        default:
          prefix = "file";
      }

      const filename = `${prefix}-${timestamp}-${random}${ext}`;
      cb(null, filename);
    },
  });
};

// File filter untuk berbagai jenis file
const createFileFilter = (allowedTypes) => {
  return (req, file, cb) => {
    if (!allowedTypes.includes(file.mimetype)) {
      const typeNames = allowedTypes
        .map((type) => {
          switch (type) {
            case "image/jpeg":
              return "JPG";
            case "image/png":
              return "PNG";
            case "image/svg+xml":
              return "SVG";
            case "application/pdf":
              return "PDF";
            case "application/msword":
              return "DOC";
            case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
              return "DOCX";
            default:
              return type;
          }
        })
        .join(", ");

      // 🚨 Buat error dengan kode khusus
      const error = new Error(`Format file harus ${typeNames}`);
      error.code = "INVALID_FILE_TYPE";
      return cb(error, false);
    }

    cb(null, true);
  };
};

// Predefined upload configurations
const uploadConfigs = {
  // Untuk persyaratan
  persyaratan: multer({
    storage: createStorage("persyaratan"),
    fileFilter: createFileFilter([
      "application/pdf",
      "image/png",
      "image/jpeg",
    ]),
    limits: { fileSize: 10 * 1024 * 1024 }, // 5MB
  }),

  // Untuk berita_acara
  berita_acara: multer({
    storage: createStorage("berita_acara"),
    fileFilter: createFileFilter([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  }),

  // Untuk Excel
  excel: multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
        "application/vnd.ms-excel", // .xls
      ];

      if (!allowedTypes.includes(file.mimetype)) {
        return cb(
          new Error("Format file harus Excel (.xlsx atau .xls)"),
          false,
        );
      }
      cb(null, true);
    },
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  }),

  // Untuk Foto
  foto: multer({
    storage: createStorage("foto"), // folder penyimpanan: uploads/foto
    fileFilter: createFileFilter([
      "image/jpeg",
      "image/png",
      "image/jpg",
      "image/webp",
    ]),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  }),

  foto_depan: multer({
    storage: createStorage("foto_depan"),
    fileFilter: createFileFilter(["image/jpeg", "image/png", "image/jpg", "image/webp"]),
    limits: { fileSize: 2 * 1024 * 1024 },
  }),

  foto_samping_kiri: multer({
    storage: createStorage("foto_samping_kiri"),
    fileFilter: createFileFilter(["image/jpeg", "image/png", "image/jpg", "image/webp"]),
    limits: { fileSize: 2 * 1024 * 1024 },
  }),

  foto_samping_kanan: multer({
    storage: createStorage("foto_samping_kanan"),
    fileFilter: createFileFilter(["image/jpeg", "image/png", "image/jpg", "image/webp"]),
    limits: { fileSize: 2 * 1024 * 1024 },
  }),

  foto_belakang: multer({
    storage: createStorage("foto_belakang"),
    fileFilter: createFileFilter(["image/jpeg", "image/png", "image/jpg", "image/webp"]),
    limits: { fileSize: 2 * 1024 * 1024 },
  }),

  foto_semua: multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        // Tiap field nama file disimpan ke folder sesuai fieldname-nya
        const uploadPath = path.join(baseUploadDir, file.fieldname);
        ensureDirectoryExists(uploadPath);
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = `foto-${Date.now()}-${Math.floor(Math.random() * 1e6)}${ext}`;
        cb(null, filename);
      },
    }),
    fileFilter: createFileFilter(["image/jpeg", "image/png", "image/jpg", "image/webp"]),
    limits: { fileSize: 2 * 1024 * 1024 },
  }),

  // Generic upload dengan custom folder
  custom: (folderName, allowedTypes, maxSize) => {
    return multer({
      storage: createStorage(folderName),
      fileFilter: createFileFilter(allowedTypes),
      limits: { fileSize: maxSize },
    });
  },
};

// Helper function untuk mendapatkan URL file
const getFileUrl = (req, folderName, filename) => {
  const baseUrl =
    process.env.BASE_URL || `${req.protocol}://${req.get("host")}/backend`;

  return `${baseUrl}/uploads/${folderName}/${filename}`;
};

// Helper function untuk menghapus file
const deleteFile = (folderName, filename) => {
  const filePath = path.join(baseUploadDir, folderName, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
};

module.exports = {
  uploadConfigs,
  getFileUrl,
  deleteFile,
  ensureDirectoryExists,
  baseUploadDir,
};
