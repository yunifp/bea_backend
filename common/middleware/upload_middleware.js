const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { S3Client, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const multerS3 = require("multer-s3");
const { v4: uuidv4, v5: uuidv5 } = require("uuid");
const crypto = require("crypto"); // <-- TAMBAHAN LIBRARY CRYPTO BAWAAN NODE.JS

const baseUploadDir = process.env.FILE_URL;
const storageType = process.env.DATABASE_PENYIMPANAN || "biasa";

const APP_NAMESPACE = "1b671a64-40d5-491e-99b0-da01ff1f3341";

const s3Endpoint = process.env.S3_ENDPOINT;
const UPLOAD_BUCKET = process.env.S3_BUCKET_NAME;

let s3Client = null;

if (storageType === "s3") {
  s3Client = new S3Client({
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY,
    },
    endpoint: s3Endpoint,
    forcePathStyle: true,
  });
}

// ============================================================================
// LOGIKA ENKRIPSI UNTUK MENYEMBUNYIKAN PATH S3
// ============================================================================
// Menggunakan JWT_SECRET sebagai kunci enkripsi agar aman
const ENCRYPTION_KEY = crypto
  .createHash("sha256")
  .update(process.env.JWT_SECRET || "palma-secret-key")
  .digest("base64")
  .substring(0, 32);
const IV_LENGTH = 16;

const encryptPath = (text) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
};

const decryptPath = (text) => {
  const textParts = text.split(":");
  const iv = Buffer.from(textParts.shift(), "hex");
  const encryptedText = Buffer.from(textParts.join(":"), "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
};

const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const getTrxContext = async (req, folderName) => {
  if (folderName === "rekomtek" || folderName === "berita_acara") {
      return { idTrx: null, idRef: null, trxInstance: null };
  }

  const { TrxBeasiswa, TrxDokumenUmum, TrxDokumenKhusus } = require("../../models");
  let idTrx = req.body?.id_trx_beasiswa || req.params?.idTrxBeasiswa || req.params?.idTrxDokumen;
  let idRef = req.body?.id_ref_dokumen;
  let trxInstance = null;

  if (!idTrx && req.params?.idTrxDokumen) {
     let dok = await TrxDokumenUmum.findOne({where: {id: req.params.idTrxDokumen}});
     if (!dok) dok = await TrxDokumenKhusus.findOne({where: {id: req.params.idTrxDokumen}});
     if (dok) {
       idTrx = dok.id_trx_beasiswa;
       idRef = dok.id_ref_dokumen;
     }
  }

  if (idTrx) {
      trxInstance = await TrxBeasiswa.findOne({ where: { id_trx_beasiswa: idTrx } });
  } else if (req.user && req.user.id && (!req.user.kode_kab && !req.user.kode_prov)) {
      trxInstance = await TrxBeasiswa.findOne({ 
         where: { id_users: req.user.id },
         order: [['id_trx_beasiswa', 'DESC']]
      });
      if (trxInstance) idTrx = trxInstance.id_trx_beasiswa;
  }

  return { idTrx, idRef, trxInstance };
};

const autoDeleteOldS3File = async (req, file, folderName, newFinalPath) => {
  if (storageType !== "s3") return; 
  
  try {
    const { TrxBeasiswa, TrxDokumenUmum, TrxDokumenKhusus } = require("../../models");
    const { idTrx } = await getTrxContext(req, folderName);
    let oldFileKey = null;

    if (idTrx) {
        if (folderName.includes("foto") || folderName === "profile" || file.fieldname.includes("foto")) {
            const trx = await TrxBeasiswa.findOne({ where: { id_trx_beasiswa: idTrx } });
            if (trx && trx[file.fieldname]) {
                oldFileKey = trx[file.fieldname];
            }
        } 
        else if (folderName === "persyaratan") {
            const idRef = req.body?.id_ref_dokumen;
            const kategori = req.params?.kategori;
            if (idRef && kategori) {
                let dok = null;
                if (kategori === "umum") dok = await TrxDokumenUmum.findOne({ where: { id_trx_beasiswa: idTrx, id_ref_dokumen: idRef } });
                else if (kategori === "khusus") dok = await TrxDokumenKhusus.findOne({ where: { id_trx_beasiswa: idTrx, id_ref_dokumen: idRef } });
                
                if (dok && dok.file) oldFileKey = dok.file;
            }
        }
    }

    if (oldFileKey && oldFileKey.includes("/") && oldFileKey !== newFinalPath) {
        const command = new DeleteObjectCommand({ Bucket: UPLOAD_BUCKET, Key: oldFileKey });
        await s3Client.send(command); 
    }
  } catch (error) {
    console.error(error.message);
  }
};

const generateS3Path = async (req, file, folderName, rawName) => {
  const { idTrx, trxInstance } = await getTrxContext(req, folderName);
  let tahun = new Date().getFullYear();
  
  if (idTrx) {
      let slugName = "PESERTA";
      let namaDariForm = req.body?.nama_lengkap;

      if (namaDariForm && namaDariForm !== "null" && namaDariForm.trim() !== "") {
          slugName = namaDariForm; 
      } else if (trxInstance && trxInstance.nama_lengkap && trxInstance.nama_lengkap !== "null") {
          slugName = trxInstance.nama_lengkap; 
      } else if (req.user && req.user.nama) {
          slugName = req.user.nama; 
      }
      slugName = slugName.trim().replace(/[^a-zA-Z0-9]/g, "_").replace(/\s+/g, "_").toUpperCase();

      let subFolder = folderName; 
      if (folderName.includes("foto")) subFolder = "foto";
      else if (folderName === "persyaratan") {
          const kategori = req.params?.kategori || "umum"; 
          subFolder = `persyaratan/${kategori}`;
      }
      return `${tahun}/${idTrx}_${slugName}/${subFolder}/${rawName}`;
  } 
  else {
      let adminArea = req.user?.nama_dinas_kabkota || req.user?.nama_dinas_provinsi || req.user?.nama_kampus || req.user?.nama || "UMUM";
      let safeAdminArea = adminArea.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
      return `${tahun}/ADMIN_${safeAdminArea}/${folderName}/${rawName}`;
  }
};

const createStorage = (folderName) => {
  if (storageType === "s3") {
    return multerS3({
      s3: s3Client, 
      bucket: UPLOAD_BUCKET,
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key: async (req, file, cb) => {
        try {
          const ext = path.extname(file.originalname);
          const { idTrx, idRef } = await getTrxContext(req, folderName);
          let rawName;

          if (folderName.includes("foto") || folderName === "profile" || file.fieldname.includes("foto")) {
              let prefix = folderName.includes("foto") ? file.fieldname : (folderName === "persyaratan" ? "persyaratan" : "file");
              const staticUUID = idTrx ? uuidv5(`FOTO_${idTrx}_${file.fieldname}`, APP_NAMESPACE) : uuidv4();
              rawName = `${prefix}-${staticUUID}${ext}`; 
          } 
          else if (folderName === "persyaratan") {
              const staticUUID = (idTrx && idRef) ? uuidv5(`DOK_${idTrx}_${idRef}`, APP_NAMESPACE) : uuidv4();
              rawName = `persyaratan-${staticUUID}${ext}`; 
          } 
          else if (folderName === "rekomtek" || folderName === "berita_acara") {
              let adminArea = req.user?.nama_dinas_kabkota || req.user?.nama_dinas_provinsi || req.user?.nama_kampus || req.user?.nama || "UMUM";
              let safeAdminArea = adminArea.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
              
              const prefix = folderName === "rekomtek" ? "REKOMTEK" : "BA";
              const staticUUID = uuidv5(`${prefix}_${safeAdminArea}`, APP_NAMESPACE);
              
              rawName = `${folderName}-${staticUUID}${ext}`; 
          }
          else {
              rawName = `${file.fieldname || folderName}${ext}`; 
          }
          
          const finalPath = await generateS3Path(req, file, folderName, rawName);
          await autoDeleteOldS3File(req, file, folderName, finalPath);
          
          file.filename = finalPath; 
          cb(null, finalPath);
        } catch (err) {
          const ext = path.extname(file.originalname);
          const fallbackPath = `${folderName}/fallback-${uuidv4()}${ext}`;
          file.filename = fallbackPath;
          cb(null, fallbackPath);
        }
      },
    });
  }

  return multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(baseUploadDir, folderName);
      ensureDirectoryExists(uploadPath);
      cb(null, uploadPath);
    },
    filename: async (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const { idTrx, idRef } = await getTrxContext(req, folderName);

      if (folderName.includes("foto") || file.fieldname.includes("foto")) {
          const staticUUID = idTrx ? uuidv5(`FOTO_${idTrx}_${file.fieldname}`, APP_NAMESPACE) : uuidv4();
          cb(null, `${file.fieldname}-${staticUUID}${ext}`);
      } else if (folderName === "persyaratan") {
          const staticUUID = (idTrx && idRef) ? uuidv5(`DOK_${idTrx}_${idRef}`, APP_NAMESPACE) : uuidv4();
          cb(null, `persyaratan-${staticUUID}${ext}`);
      } else if (folderName === "rekomtek" || folderName === "berita_acara") {
          let adminArea = req.user?.nama_dinas_kabkota || req.user?.nama_dinas_provinsi || req.user?.nama_kampus || req.user?.nama || "UMUM";
          let safeAdminArea = adminArea.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
          const prefix = folderName === "rekomtek" ? "REKOMTEK" : "BA";
          const staticUUID = uuidv5(`${prefix}_${safeAdminArea}`, APP_NAMESPACE);
          cb(null, `${folderName}-${staticUUID}${ext}`);
      } else {
          cb(null, `${file.fieldname || folderName}${ext}`);
      }
    },
  });
};

const createFileFilter = (allowedTypes) => {
  return (req, file, cb) => {
    if (!allowedTypes.includes(file.mimetype)) {
      const typeNames = allowedTypes
        .map((type) => {
          switch (type) {
            case "image/jpeg": return "JPG";
            case "image/png": return "PNG";
            case "image/svg+xml": return "SVG";
            case "application/pdf": return "PDF";
            case "application/msword": return "DOC";
            case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": return "DOCX";
            default: return type;
          }
        })
        .join(", ");

      const error = new Error(`Format file harus ${typeNames}`);
      error.code = "INVALID_FILE_TYPE";
      return cb(error, false);
    }
    cb(null, true);
  };
};

const uploadConfigs = {
  // ... (Upload configs tetap sama seperti sebelumnya, tidak ada perubahan)
  persyaratan: multer({
    storage: createStorage("persyaratan"),
    fileFilter: createFileFilter(["application/pdf", "image/png", "image/jpeg"]),
    limits: { fileSize: 10 * 1024 * 1024 },
  }),

  berita_acara: multer({
    storage: createStorage("berita_acara"),
    fileFilter: createFileFilter(["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]),
    limits: { fileSize: 10 * 1024 * 1024 },
  }),

  rekomtek: multer({
    storage: createStorage("rekomtek"),
    fileFilter: createFileFilter(["application/pdf"]),
    limits: { fileSize: 10 * 1024 * 1024 },
  }),

  excel: multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
      const allowedTypes = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"];
      if (!allowedTypes.includes(file.mimetype)) return cb(new Error("Format file harus Excel (.xlsx atau .xls)"), false);
      cb(null, true);
    },
    limits: { fileSize: 10 * 1024 * 1024 },
  }),

  foto: multer({ storage: createStorage("foto"), fileFilter: createFileFilter(["image/jpeg", "image/png", "image/jpg", "image/webp"]), limits: { fileSize: 2 * 1024 * 1024 } }),
  foto_depan: multer({ storage: createStorage("foto_depan"), fileFilter: createFileFilter(["image/jpeg", "image/png", "image/jpg", "image/webp"]), limits: { fileSize: 2 * 1024 * 1024 } }),
  foto_samping_kiri: multer({ storage: createStorage("foto_samping_kiri"), fileFilter: createFileFilter(["image/jpeg", "image/png", "image/jpg", "image/webp"]), limits: { fileSize: 2 * 1024 * 1024 } }),
  foto_samping_kanan: multer({ storage: createStorage("foto_samping_kanan"), fileFilter: createFileFilter(["image/jpeg", "image/png", "image/jpg", "image/webp"]), limits: { fileSize: 2 * 1024 * 1024 } }),
  foto_belakang: multer({ storage: createStorage("foto_belakang"), fileFilter: createFileFilter(["image/jpeg", "image/png", "image/jpg", "image/webp"]), limits: { fileSize: 2 * 1024 * 1024 } }),

  foto_semua: multer({
    storage: storageType === "s3"
      ? multerS3({
          s3: s3Client, 
          bucket: UPLOAD_BUCKET,
          contentType: multerS3.AUTO_CONTENT_TYPE,
          key: async (req, file, cb) => {
            try {
              const ext = path.extname(file.originalname);
              const { idTrx } = await getTrxContext(req, file.fieldname);
              
              const staticUUID = idTrx ? uuidv5(`FOTO_${idTrx}_${file.fieldname}`, APP_NAMESPACE) : uuidv4();
              const rawName = `${file.fieldname}-${staticUUID}${ext}`; 
              
              const finalPath = await generateS3Path(req, file, file.fieldname, rawName);
              await autoDeleteOldS3File(req, file, file.fieldname, finalPath);
              
              file.filename = finalPath;
              cb(null, finalPath);
            } catch(err) {
              const ext = path.extname(file.originalname);
              const fallbackPath = `${file.fieldname}/fallback-foto-${uuidv4()}${ext}`;
              file.filename = fallbackPath;
              cb(null, fallbackPath);
            }
          },
        })
      : multer.diskStorage({
          destination: (req, file, cb) => {
            const uploadPath = path.join(baseUploadDir, file.fieldname);
            ensureDirectoryExists(uploadPath);
            cb(null, uploadPath);
          },
          filename: async (req, file, cb) => {
            const ext = path.extname(file.originalname);
            const { idTrx } = await getTrxContext(req, file.fieldname);
            const staticUUID = idTrx ? uuidv5(`FOTO_${idTrx}_${file.fieldname}`, APP_NAMESPACE) : uuidv4();
            cb(null, `${file.fieldname}-${staticUUID}${ext}`);
          },
        }),
    fileFilter: createFileFilter(["image/jpeg", "image/png", "image/jpg", "image/webp"]),
    limits: { fileSize: 2 * 1024 * 1024 },
  }),

  custom: (folderName, allowedTypes, maxSize) => {
    return multer({
      storage: createStorage(folderName),
      fileFilter: createFileFilter(allowedTypes),
      limits: { fileSize: maxSize },
    });
  },
};

// ============================================================================
// MODIFIKASI: URL DIUBAH MENGARAH KE BACKEND, BUKAN LANGSUNG KE S3
// ============================================================================
const getFileUrl = async (req, folderName, filename) => {
  if (!filename) return null;

  // Tentukan Base URL Backend Anda
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get("host")}/backend`;

  if (storageType === "s3") {
    try {
      const fileKey = filename.includes("/") ? filename : `${folderName}/${filename}`;
      
      // Enkripsi Key asli S3
      const encryptedKey = encryptPath(fileKey);
      
      // Kembalikan URL yang mengarah ke endpoint streaming backend Anda
      return `${baseUrl}/api/files/stream?q=${encryptedKey}`;
    } catch (error) {
      return null;
    }
  }

  // Jika penyimpanan biasa (lokal)
  const cacheBuster = `?t=${Date.now()}`;
  return `${baseUrl}/uploads/${folderName}/${filename}${cacheBuster}`;
};

// ============================================================================
// FUNGSI BARU: MENGAMBIL DATA DARI S3 DAN STREAM KE FRONTEND
// ============================================================================
const streamS3File = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).send("Parameter q (key) tidak ditemukan");

    // Dekripsi untuk mendapatkan path S3 asli
    const fileKey = decryptPath(q);

    const command = new GetObjectCommand({
      Bucket: UPLOAD_BUCKET,
      Key: fileKey,
    });

    // Minta data ke S3
    const s3Response = await s3Client.send(command);

    // Salin tipe file (image/png, application/pdf) ke response backend
    res.setHeader("Content-Type", s3Response.ContentType);
    res.setHeader("Content-Length", s3Response.ContentLength);
    res.setHeader("Cache-Control", "public, max-age=3600"); // Opsional: Beri tahu browser untuk cache gambar 1 jam

    // PENTING: Pipe data dari S3 langsung ke Client (Frontend)
    s3Response.Body.pipe(res);
  } catch (error) {
    console.error("Error streaming dari S3:", error.message);
    return res.status(404).send("File tidak ditemukan atau akses ditolak");
  }
};

const deleteFile = async (folderName, filename) => {
  if (!filename) return false;
  if (storageType === "s3") {
    const fileKey = filename.includes("/") ? filename : `${folderName}/${filename}`;
    const command = new DeleteObjectCommand({
      Bucket: UPLOAD_BUCKET,
      Key: fileKey,
    });
    try {
      await s3Client.send(command); 
      return true;
    } catch (error) {
      return false;
    }
  } else {
    const filePath = path.join(baseUploadDir, folderName, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }
};

module.exports = {
  uploadConfigs,
  getFileUrl,
  streamS3File, // <-- Ekspor fungsi baru ini
  deleteFile,
  ensureDirectoryExists,
  baseUploadDir,
};