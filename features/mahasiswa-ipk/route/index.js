const express = require("express");
const { getAllData, createOrUpdate } = require("../controller");
const router = express.Router();

router.get("/:idTrxMahasiswa", getAllData);
router.post("/", createOrUpdate);

module.exports = router;
