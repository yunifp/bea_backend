const express = require("express");
const router = express.Router();
const {
  getRekapProvinsi,
  getDetailProvinsi,
  ubahStatusKluster,
  kirimLembagaSeleksi,
  exportDetailSemua,
  kirimDataKewilayahan
} = require("../controller");

router.get("/rekap-provinsi", getRekapProvinsi);
router.get("/detail-provinsi/:kode_dinas_provinsi", getDetailProvinsi);
router.put("/ubah-kluster/:id_trx_beasiswa", ubahStatusKluster);
router.put("/kirim-seleksi", kirimLembagaSeleksi);
router.get("/export-detail", exportDetailSemua);
router.put("/rekap-administrasi/kirim", kirimDataKewilayahan);

module.exports = router;