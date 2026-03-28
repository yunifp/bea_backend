const express = require("express");
const router = express.Router();
const { cekDataByNik } = require("../controller");

router.get("/", cekDataByNik);

module.exports = router;