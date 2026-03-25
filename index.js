const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const multerErrorHandler = require("./common/middleware/multerErrorHandler");

const checkAuthorization = require("./common/middleware/auth_middleware");

const app = express();
app.set("trust proxy", true);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(cors());
app.use(morgan("dev"));
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

app.use("/uploads", express.static(process.env.FILE_URL || "E:/upload_palma"));

app.use(
  "/api/beasiswa/beasiswa",
  checkAuthorization,
  require("./features/beasiswa/route")
);

app.use(
  "/api/beasiswa/persyaratan",
  checkAuthorization,
  require("./features/persyaratan/route")
);

app.use(multerErrorHandler);

module.exports = app;
