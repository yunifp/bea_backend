const express = require("express");
const router = express.Router();

const {
  getListPenetapanMaster,
  getDetailPenetapan,
  cekDokumenPenetapan
} = require("../controller");

router.get("/master", getListPenetapanMaster); 
router.get("/detail", getDetailPenetapan);     
router.get("/cek-dokumen", cekDokumenPenetapan);

module.exports = router;