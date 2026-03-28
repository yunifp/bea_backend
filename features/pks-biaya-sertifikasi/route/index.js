const express = require("express");
const {
  create,
  getAllData,
  getByPagination,
  ajukanKeBpdp,
  ajukanKeVerifikator,
  staffBeasiswa,
  generateRab,
  generateNominatif,
  verifikatorPjk,
  getTagihanTahapLalu,
  getLog,
  ppkBendahara,
  getLockData,
  getListBuktiPengeluaran,
  generateSptjm,
  generateBuktiKwitansi,
} = require("../controller");
const {
  uploadConfigs,
} = require("../../../common/middleware/upload_middleware");
const router = express.Router();

router.get("/", getByPagination);
router.get("/all/:idTrxPks", getAllData);
router.post("/", create);

router.post("/ajukan-ke-bpdp/:id_biaya_sertifikasi", ajukanKeBpdp);
router.post(
  "/ajukan-ke-verifikator",
  uploadConfigs
    .custom(
      "verifikasi_pengajuan_biaya_sertifikasi", // nama folder
      ["application/pdf"], // hanya PDF
      5 * 1024 * 1024, // 5MB
    )
    .fields([
      { name: "daftar_nominatif", maxCount: 1 },
      { name: "sptjm", maxCount: 1 },
      { name: "bukti_kwitansi", maxCount: 1 },
    ]),
  ajukanKeVerifikator,
);
router.post(
  "/staff-beasiswa/:id_biaya_sertifikasi",
  uploadConfigs.ttd_staff_beasiswa.single("ttd"),
  staffBeasiswa,
);
router.get("/generate-rab/:id_biaya_sertifikasi", generateRab);
router.get("/generate-nominatif/:id_trx_pks", generateNominatif);
router.post("/generate-sptjm", generateSptjm);
router.post("/generate-bukti-kwitansi", generateBuktiKwitansi);

router.post(
  "/verifikator-pjk/:id_biaya_sertifikasi",
  uploadConfigs.ttd_staff_beasiswa.single("ttd"),
  verifikatorPjk,
);

router.get("/tagihan-tahap-lalu/:id_biaya_sertifikasi", getTagihanTahapLalu);

router.get("/log/:id_biaya_sertifikasi", getLog);

router.put(
  "/batch/:id_batch/ppk-bendahara",
  uploadConfigs.ttd_staff_beasiswa.single("ttd"),
  ppkBendahara,
);

router.post("/get-lock-data", getLockData);
router.post("/mahasiswa-bukti-pengeluaran", getListBuktiPengeluaran);

module.exports = router;
