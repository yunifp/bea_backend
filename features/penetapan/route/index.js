const express = require("express");
const router = express.Router();

const {
  getListPenetapanMaster,
  getDetailPenetapan,
  cekDokumenPenetapan
} = require("../controller");

router.get("/master", getListPenetapanMaster); // Untuk tabel awal
router.get("/detail", getDetailPenetapan);     // Untuk tabel detail mahasiswa
router.get("/cek-dokumen", cekDokumenPenetapan);

module.exports = router;