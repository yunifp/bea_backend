const express = require("express");
const {
  getJumlahMahasiswaPerLembagaPendidikan,
  getJumlahMahasiswaPerProvinsi,
} = require("../controller");
const router = express.Router();

router.get("/jumlah-mahasiswa-lp", getJumlahMahasiswaPerLembagaPendidikan);
router.get("/jumlah-mahasiswa-provinsi", getJumlahMahasiswaPerProvinsi);

module.exports = router;
