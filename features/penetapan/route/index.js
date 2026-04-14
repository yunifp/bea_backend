const express = require("express");
const router = express.Router();

const {
  getListPenetapanMaster,
  getDetailPenetapan,
  cekDokumenPenetapan,
  downloadDataPenetapan // <-- Tambahkan ini
} = require("../controller");

router.get("/master", getListPenetapanMaster); 
router.get("/detail", getDetailPenetapan);     
router.get("/cek-dokumen", cekDokumenPenetapan);
router.get("/download", downloadDataPenetapan); // <-- Rute baru untuk download

module.exports = router;