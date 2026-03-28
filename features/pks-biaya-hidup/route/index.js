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
  generateSuratPenagihan,
  verifikatorPjk,
  getTagihanBulanLalu,
  getLog,
  getBatchByPagination,
  getByBatchAndPagination,
  ppkBendahara,
  generateNominatifGabungan,
  generateRekap,
  deleteById,
  autoBatchBiayaHidup,
  getMonitoringPengajuan,
} = require("../controller");
const {
  uploadConfigs,
} = require("../../../common/middleware/upload_middleware");
const router = express.Router();

router.get("/", getByPagination);
router.get("/monitoring-pengajuan", getMonitoringPengajuan);
router.get("/all/:idTrxPks", getAllData);
router.post("/", create);
router.delete("/:id_biaya_hidup", deleteById);

router.post("/ajukan-ke-bpdp/:id_biaya_hidup", ajukanKeBpdp);
router.post(
  "/ajukan-ke-verifikator",
  uploadConfigs
    .custom(
      "verifikasi_pengajuan_biaya_hidup", // nama folder
      ["application/pdf"], // hanya PDF
      5 * 1024 * 1024, // 5MB
    )
    .fields([{ name: "daftar_nominatif", maxCount: 1 }]),
  ajukanKeVerifikator,
);
router.post(
  "/staff-beasiswa/:id_biaya_hidup",
  uploadConfigs.ttd_staff_beasiswa.single("ttd"),
  staffBeasiswa,
);
router.get("/generate-rab/:id_biaya_hidup", generateRab);
router.get("/generate-nominatif/:id_trx_pks", generateNominatif);
router.get(
  "/generate-pernyataan-keaktifan-mahasiswa/:id_trx_pks",
  generatePernyataanKeaktifanMahasiswa,
);
router.post("/generate-surat-penagihan", generateSuratPenagihan);

router.post(
  "/verifikator-pjk/:id_biaya_hidup",
  uploadConfigs.ttd_staff_beasiswa.single("ttd"),
  verifikatorPjk,
);

router.get("/tagihan-bulan-lalu/:id_biaya_hidup", getTagihanBulanLalu);

router.get("/log/:id_biaya_hidup", getLog);
router.post("/auto-batch", autoBatchBiayaHidup);
router.get("/batch", getBatchByPagination);

router.put(
  "/batch/:id_batch/ppk-bendahara",
  uploadConfigs.ttd_staff_beasiswa.single("ttd"),
  ppkBendahara,
);
router.get("/batch/:id_batch", getByBatchAndPagination);
router.get(
  "/batch/:id_batch/generate-nominatif-gabungan",
  generateNominatifGabungan,
);
router.get("/batch/:id_batch/generate-rekap", generateRekap);

module.exports = router;
