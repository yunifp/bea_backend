const express = require("express");
const { create, getAllData } = require("../controller");
const router = express.Router();

router.get("/:idTrxMahasiswa", getAllData);
router.post("/", create);

module.exports = router;
