const express = require("express");
const { getByPagination, getLockData, create } = require("../controller");
const router = express.Router();

router.get("/", getByPagination);
router.post("/lock-data", getLockData);
router.post("/", create);

module.exports = router;
