const express = require("express");
const router = express.Router();

const {
  getPendaftarWawancara,
  downloadExcelWawancara,
  uploadExcelWawancara,
  kirimDataWawancara
} = require("../controller");

const { uploadConfigs } = require("../../../common/middleware/upload_middleware");

router.get("/", getPendaftarWawancara);

router.get("/download-excel", downloadExcelWawancara);

router.post(
  "/upload-excel",
  uploadConfigs.excel.single("file"),
  uploadExcelWawancara
);

router.put("/kirim", kirimDataWawancara);

module.exports = router;