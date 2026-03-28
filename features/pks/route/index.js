const express = require("express");
const router = express.Router();

const {
  getPksByPagination,
  create,
  deleteById,
  detailPksById,
  getMahasiswaByIdPksAndPagination,
  editPksById,
  getPksGroupedByPagination,
  updateStatusAktifMahasiswa,
  importExcelMahasiswa,
  getAllPks,
  getStatistikMahasiswa,
  lockData,
  getLockData,
  updateDataMahasiswa,
  getPksWithJumlahPerubahanByPagination,
  hasPerubahanDataMahasiswa,
  getPerubahanDataMahasiswa,
  createSwakelola,
  detailPksSwakelolaById,
  editPksSwakelolaById,
  updateNimMahasiswa,
  exportMahasiswaByPks,
} = require("../controller");
const {
  uploadConfigs,
} = require("../../../common/middleware/upload_middleware");

router.get("/grouped", getPksGroupedByPagination);
router.get("/jumlah-perubahan", getPksWithJumlahPerubahanByPagination);
router.get("/all", getAllPks);
router.get("/list-perubahan-data-mahasiswa", getPerubahanDataMahasiswa);
router.get("/", getPksByPagination);

router.post(
  "/swakelola",
  uploadConfigs.file_pks.single("file_pks"),
  createSwakelola,
);
router.post("/", uploadConfigs.file_pks.single("file_pks"), create);

router.delete("/:id", deleteById);
router.get("/mahasiswa/:id_trx_pks", getMahasiswaByIdPksAndPagination);
router.put(
  "/status-aktif-mahasiswa/:id_trx_mahasiswa",
  uploadConfigs.file_pendukung.single("file_pendukung"),
  updateStatusAktifMahasiswa,
);
router.post(
  "/import-excel-mahasiswa/:id_trx_pks",
  uploadConfigs.excel.single("file"),
  importExcelMahasiswa,
);
router.get("/statistik-mahasiswa", getStatistikMahasiswa);

router.post("/lock-data", lockData);

router.post("/get-lock-data", getLockData);

router.post("/mahasiswa/export-excel", exportMahasiswaByPks);

router.put("/mahasiswa/nim/:id_trx_mahasiswa", updateNimMahasiswa);

router.put(
  "/mahasiswa/:id_trx_mahasiswa",
  uploadConfigs.scan_buku_tabungan.single("scan_buku_tabungan"),
  updateDataMahasiswa,
);

router.put(
  "/swakelola/:id_trx_pks",
  uploadConfigs.file_pks.single("file_pks"),
  editPksSwakelolaById,
);

router.put(
  "/:id_trx_pks",
  uploadConfigs.file_pks.single("file_pks"),
  editPksById,
);

router.get(
  "/has-perubahan-data-mahasiswa/:id_trx_pks",
  hasPerubahanDataMahasiswa,
);

router.get("/swakelola/:id_trx_pks", detailPksSwakelolaById);
router.get("/:id_trx_pks", detailPksById);

module.exports = router;
