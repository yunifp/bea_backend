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
  generateSptjm,
  verifikatorPjk,
  getTagihanSemesterLalu,
  getLog,
  ppkBendahara,
  getLockData,
  generateBuktiKwitansi,
  deleteById,
} = require("../controller");
const {
  uploadConfigs,
} = require("../../../common/middleware/upload_middleware");
const router = express.Router();

router.get("/", getByPagination);
router.get("/all/:idTrxPks", getAllData);
router.post("/", create);
router.delete("/:id_biaya_pendidikan", deleteById);

router.post("/ajukan-ke-bpdp/:id_biaya_pendidikan", ajukanKeBpdp);
router.post(
  "/ajukan-ke-verifikator",
  uploadConfigs
    .custom(
      "verifikasi_pengajuan_biaya_pendidikan", // nama folder
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
  "/staff-beasiswa/:id_biaya_pendidikan",
  uploadConfigs.ttd_staff_beasiswa.single("ttd"),
  staffBeasiswa,
);
router.get("/generate-rab/:id_biaya_pendidikan", generateRab);
router.post("/generate-nominatif", generateNominatif);
router.post("/generate-sptjm", generateSptjm);
router.post("/generate-bukti-kwitansi", generateBuktiKwitansi);

router.post(
  "/verifikator-pjk/:id_biaya_pendidikan",
  uploadConfigs.ttd_staff_beasiswa.single("ttd"),
  verifikatorPjk,
);

router.get(
  "/tagihan-semester-lalu/:id_biaya_pendidikan",
  getTagihanSemesterLalu,
);

router.put(
  "/ttd-pimpinan/:id_biaya_pendidikan/ppk-bendahara",
  uploadConfigs.ttd_staff_beasiswa.single("ttd"),
  ppkBendahara,
);

router.get("/log/:id_biaya_pendidikan", getLog);

router.post("/get-lock-data", getLockData);

module.exports = router;
