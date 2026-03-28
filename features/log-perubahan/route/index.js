const express = require("express");
const {
  getLogRekening,
  postRekening,
  verifikasiPerubahanRekening,
  getLogStatusAktif,
  postStatusAktif,
  verifikasiPerubahanStatusAktif,
  getLogIpk,
  postIpk,
  verifikasiPerubahanIpk,
  postPt,
  getLogPt,
  verifikasiPerubahanPt,
  verifikasiSemuaPerubahanRekening,
  setujuiSemuaPerubahanRekening,
  setujuiSemuaPerubahanStatusAktif,
  setujuiSemuaPerubahanIpk,
} = require("../controller");
const {
  uploadConfigs,
} = require("../../../common/middleware/upload_middleware");
const router = express.Router();

router.get("/rekening/:id_mahasiswa", getLogRekening);
router.post(
  "/rekening",
  uploadConfigs.scan_buku_tabungan.single("scan_buku_tabungan"),
  postRekening,
);
router.post("/rekening/verify/:id_log", verifikasiPerubahanRekening);
router.post("/rekening/approve-all", setujuiSemuaPerubahanRekening);

router.get("/status-aktif/:id_mahasiswa", getLogStatusAktif);
router.post(
  "/status-aktif",
  uploadConfigs.file_pendukung.single("file_pendukung"),
  postStatusAktif,
);
router.post("/status-aktif/verify/:id_log", verifikasiPerubahanStatusAktif);
router.post("/status-aktif/approve-all", setujuiSemuaPerubahanStatusAktif);

router.get("/ipk/:id_mahasiswa", getLogIpk);
router.post("/ipk", postIpk);
router.post("/ipk/verify/:id_log", verifikasiPerubahanIpk);
router.post("/ipk/approve-all", setujuiSemuaPerubahanIpk);

router.get("/perguruan-tinggi/:id_pt", getLogPt);
router.post(
  "/perguruan-tinggi/:id_pt",
  uploadConfigs.logo_perguruan_tinggi.single("logo"),
  postPt,
);
router.post("/perguruan-tinggi/verify/:id_log", verifikasiPerubahanPt);

module.exports = router;
