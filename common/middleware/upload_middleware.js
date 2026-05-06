const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const multerS3 = require("multer-s3");
const { v4: uuidv4, v5: uuidv5 } = require("uuid"); 
const axios = require("axios");

const baseUploadDir = process.env.FILE_URL;
const storageType = process.env.DATABASE_PENYIMPANAN || "biasa";

const APP_NAMESPACE = "1b671a64-40d5-491e-99b0-da01ff1f3341"; 

const primaryEndpoint = process.env.NEO_ENDPOINT || "https://nos.wjv-1.neo.id";
const secondaryEndpoint = process.env.NEO_ENDPOINT_SECONDARY || "https://nos.jkt-1.neo.id";
const UPLOAD_BUCKET = process.env.NEO_BUCKET_UPLOAD;

let activeEndpoint = primaryEndpoint;
let s3Proxy = null;
let currentS3Client = null;
let primaryClient = null;
let secondaryClient = null;

if (storageType === "s3") {
  const s3Config = {
    region: process.env.NEO_REGION || "wjv-1",
    credentials: {
      accessKeyId: process.env.NEO_ACCESS_KEY,
      secretAccessKey: process.env.NEO_SECRET_KEY,
    },
    forcePathStyle: true,
  };

  primaryClient = new S3Client({ ...s3Config, endpoint: primaryEndpoint });
  secondaryClient = new S3Client({ ...s3Config, endpoint: secondaryEndpoint });

  currentS3Client = primaryClient;

  s3Proxy = new Proxy({}, {
    get: (target, prop) => {
      if (typeof currentS3Client[prop] === "function") {
        return currentS3Client[prop].bind(currentS3Client);
      }
      return currentS3Client[prop];
    }
  });
}

let lastEndpointCheck = 0;
const checkAndSwitchEndpoint = async () => {
  if (storageType !== "s3") return;
  const now = Date.now();
  if (now - lastEndpointCheck < 30000) return; 

  try {
    await axios.get(primaryEndpoint, { timeout: 3000 });
    currentS3Client = primaryClient;
    activeEndpoint = primaryEndpoint;
    lastEndpointCheck = now;
  } catch (error) {
    console.warn(`[S3 Failover] Primary Endpoint bermasalah! Beralih ke Secondary Endpoint (${secondaryEndpoint}).`);
    currentS3Client = secondaryClient;
    activeEndpoint = secondaryEndpoint;
    lastEndpointCheck = now;
  }
};

const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// ✅ FIX: Tambahkan parameter folderName agar sistem tahu ini dokumen Admin
const getTrxContext = async (req, folderName) => {
  // Jika ini upload dokumen birokrasi, PAKSA idTrx menjadi null agar masuk folder ADMIN
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
        await s3Proxy.send(command); 
        console.log(`[S3 Auto-Delete] File lama dimusnahkan: ${oldFileKey}`);
    } else if (oldFileKey === newFinalPath) {
        console.log(`[S3 Overwrite] File otomatis tertimpa di S3: ${newFinalPath}`);
    }
  } catch (error) {
    console.error("[S3 Auto-Delete Error]", error.message);
  }
};

const generateS3Path = async (req, file, folderName, rawName) => {
  const { idTrx, trxInstance } = await getTrxContext(req, folderName);
  let tahun = new Date().getFullYear();
  
  // LOGIKA UNTUK PESERTA
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
  // ✅ LOGIKA UNTUK ADMIN (REKOMTEK / BERITA ACARA)
  else {
      let adminArea = req.user?.nama_dinas_kabkota || req.user?.nama_dinas_provinsi || req.user?.nama_kampus || req.user?.nama || "UMUM";
      let safeAdminArea = adminArea.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
      return `${tahun}/ADMIN_${safeAdminArea}/${folderName}/${rawName}`;
  }
};

const createStorage = (folderName) => {
  if (storageType === "s3") {
    return multerS3({
      s3: s3Proxy, 
      bucket: UPLOAD_BUCKET,
      acl: "public-read",
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key: async (req, file, cb) => {
        try {
          await checkAndSwitchEndpoint(); 

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
          // ✅ UUID v5 KHUSUS ADMIN AGAR OTOMATIS REPLACE
          else if (folderName === "rekomtek" || folderName === "berita_acara") {
              let adminArea = req.user?.nama_dinas_kabkota || req.user?.nama_dinas_provinsi || req.user?.nama_kampus || req.user?.nama || "UMUM";
              let safeAdminArea = adminArea.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
              
              const prefix = folderName === "rekomtek" ? "REKOMTEK" : "BA";
              // Selama adminnya sama, nama file akan selalu persis sama (Contoh: REKOMTEK-5f8a0.pdf)
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
          console.error("[Multer S3 Error]: Gagal generate path dinamis", err);
          const ext = path.extname(file.originalname);
          const fallbackPath = `${folderName}/fallback-${uuidv4()}${ext}`;
          file.filename = fallbackPath;
          cb(null, fallbackPath);
        }
      },
    });
  }

  // Fallback Lokal
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
          s3: s3Proxy, 
          bucket: UPLOAD_BUCKET,
          acl: "public-read",
          contentType: multerS3.AUTO_CONTENT_TYPE,
          key: async (req, file, cb) => {
            try {
              await checkAndSwitchEndpoint(); 
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

const getFileUrl = (req, folderName, filename) => {
  if (!filename) return null;
  const cacheBuster = `?t=${Date.now()}`;

  if (storageType === "s3") {
    if (filename.includes("/")) {
       return `${activeEndpoint}/${UPLOAD_BUCKET}/${filename}${cacheBuster}`;
    }
    return `${activeEndpoint}/${UPLOAD_BUCKET}/${folderName}/${filename}${cacheBuster}`;
  }
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get("host")}/backend`;
  return `${baseUrl}/uploads/${folderName}/${filename}${cacheBuster}`;
};

const deleteFile = async (folderName, filename) => {
  if (!filename) return false;
  if (storageType === "s3") {
    await checkAndSwitchEndpoint(); 

    const fileKey = filename.includes("/") ? filename : `${folderName}/${filename}`;
    const command = new DeleteObjectCommand({
      Bucket: UPLOAD_BUCKET,
      Key: fileKey,
    });
    try {
      await s3Proxy.send(command); 
      return true;
    } catch (error) {
      console.error(`[Delete S3 Error]: Gagal menghapus ${fileKey}`, error);
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
  deleteFile,
  ensureDirectoryExists,
  baseUploadDir,
};