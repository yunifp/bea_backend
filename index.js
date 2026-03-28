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
  }),
);
app.use(cors());
app.use(morgan("dev"));
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  }),
);

app.use("/uploads", express.static(process.env.FILE_URL || "E:/upload_palma"));

app.use(
  "/api/mahasiswa_pks/pks",
  checkAuthorization,
  require("./features/pks/route"),
);

app.use(
  "/api/mahasiswa_pks/data-mahasiswa/ipk",
  checkAuthorization,
  require("./features/mahasiswa-ipk/route"),
);

app.use(
  "/api/mahasiswa_pks/data-mahasiswa/biaya-hidup",
  checkAuthorization,
  require("./features/mahasiswa-biaya-hidup/route"),
);

app.use(
  "/api/mahasiswa_pks/data-mahasiswa/biaya-pendidikan",
  checkAuthorization,
  require("./features/mahasiswa-biaya-pendidikan/route"),
);

app.use(
  "/api/mahasiswa_pks/data-mahasiswa/biaya-buku",
  checkAuthorization,
  require("./features/mahasiswa-biaya-buku/route"),
);

app.use(
  "/api/mahasiswa_pks/data-mahasiswa/biaya-transportasi",
  checkAuthorization,
  require("./features/mahasiswa-biaya-transportasi/route"),
);

app.use(
  "/api/mahasiswa_pks/data-mahasiswa/biaya-sertifikasi",
  checkAuthorization,
  require("./features/mahasiswa-biaya-sertifikasi/route"),
);

app.use(
  "/api/mahasiswa_pks/data-mahasiswa/tracer-studi",
  checkAuthorization,
  require("./features/mahasiswa-tracer-studi/route"),
);

app.use(
  "/api/mahasiswa_pks/pengajuan-pks/biaya-hidup",
  checkAuthorization,
  require("./features/pks-biaya-hidup/route"),
);

app.use(
  "/api/mahasiswa_pks/pengajuan-pks/biaya-buku",
  checkAuthorization,
  require("./features/pks-biaya-buku/route"),
);

app.use(
  "/api/mahasiswa_pks/pengajuan-pks/biaya-pendidikan",
  checkAuthorization,
  require("./features/pks-biaya-pendidikan/route"),
);

app.use(
  "/api/mahasiswa_pks/pengajuan-pks/biaya-transportasi",
  checkAuthorization,
  require("./features/pks-biaya-transportasi/route"),
);

app.use(
  "/api/mahasiswa_pks/pengajuan-pks/biaya-sertifikasi",
  checkAuthorization,
  require("./features/pks-biaya-sertifikasi/route"),
);

app.use(
  "/api/mahasiswa_pks/statistik-mahasiswa",
  require("./features/statistik-mahasiswa/route"),
);

app.use(
  "/api/mahasiswa_pks/statistik",
  checkAuthorization,
  require("./features/statistik/route"),
);

app.use(
  "/api/mahasiswa_pks/log-perubahan",
  checkAuthorization,
  require("./features/log-perubahan/route"),
);

app.use(
  "/api/mahasiswa_pks/validitas-keaktifan-mahasiswa",
  checkAuthorization,
  require("./features/validitas-keaktifan-mahasiswa/route"),
);

app.use(
  "/api/mahasiswa_pks/validitas-ipk-mahasiswa",
  checkAuthorization,
  require("./features/validitas-ipk-mahasiswa/route"),
);

app.use(multerErrorHandler);

module.exports = app;
