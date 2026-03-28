const express = require("express");
const {
  getJumlahPengajuan,
  getJumlahPerubahanDataMahasiswa,
} = require("../controller");
const router = express.Router();

router.get("/pengajuan-biaya", getJumlahPengajuan);
router.get("/jumlah-perubahan-data-mahasiswa", getJumlahPerubahanDataMahasiswa);

module.exports = router;
