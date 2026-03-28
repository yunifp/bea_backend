const express = require("express");
const {
  create,
  getAllData,
  getByPagination,
  ajukanKeBpdp,
  ajukanKeVerifikator,
  staffBeasiswa,
  generateRab,
  generatePernyataanKeaktifanMahasiswa,
  generateNominatif,
  verifikatorPjk,
  getTagihanSemesterLalu,
  getLog,
  batch,
  getBatchByPagination,
  getByBatchAndPagination,
  ppkBendahara,
  getLockData,
  generateSuratPenagihan,
  deleteById,
  autoBatchBiayaBuku,
  generateNominatifGabungan,
  generateRekap,
} = require("../controller");
const {
  uploadConfigs,
} = require("../../../common/middleware/upload_middleware");
const router = express.Router();

router.get("/", getByPagination);
router.get("/all/:idTrxPks", getAllData);
router.post("/", create);
router.delete("/:id_biaya_buku", deleteById);

router.post("/ajukan-ke-bpdp/:id_biaya_buku", ajukanKeBpdp);
router.post(
  "/ajukan-ke-verifikator",
  uploadConfigs
    .custom(
      "verifikasi_pengajuan_biaya_buku", // nama folder
      ["application/pdf"], // hanya PDF
      5 * 1024 * 1024, // 5MB
    )
    .fields([{ name: "daftar_nominatif", maxCount: 1 }]),
  ajukanKeVerifikator,
);
router.post(
  "/staff-beasiswa/:id_biaya_buku",
  uploadConfigs.ttd_staff_beasiswa.single("ttd"),
  staffBeasiswa,
);
router.get("/generate-rab/:id_biaya_buku", generateRab);

router.post("/generate-nominatif", generateNominatif);
router.get(
  "/generate-pernyataan-keaktifan-mahasiswa/:id_trx_pks",
  generatePernyataanKeaktifanMahasiswa,
);
router.get("/generate-surat-penagihan/:id_trx_pks", generateSuratPenagihan);

router.post(
  "/verifikator-pjk/:id_biaya_buku",
  uploadConfigs.ttd_staff_beasiswa.single("ttd"),
  verifikatorPjk,
);

router.get("/tagihan-semester-lalu/:id_biaya_buku", getTagihanSemesterLalu);

router.get("/log/:id_biaya_buku", getLog);
router.post("/auto-batch", autoBatchBiayaBuku);
router.get("/batch", getBatchByPagination);

router.put(
  "/batch/:id_batch/ppk-bendahara",
  uploadConfigs.ttd_staff_beasiswa.single("ttd"),
  ppkBendahara,
);
router.get("/batch/:id_batch", getByBatchAndPagination);

router.post("/get-lock-data", getLockData);

router.get(
  "/batch/:id_batch/generate-nominatif-gabungan",
  generateNominatifGabungan,
);
router.get("/batch/:id_batch/generate-rekap", generateRekap);

module.exports = router;
