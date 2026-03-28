const express = require("express");
const {
  getByPagination,
  getLockData,
  create,
  getMahasiswaStatusIpk,
} = require("../controller");
const router = express.Router();

router.get("/", getByPagination);
router.post("/list-ipk", getMahasiswaStatusIpk);
router.post("/lock-data", getLockData);
router.post("/", create);

module.exports = router;
