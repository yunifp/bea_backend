const TrxBeasiswa = require("./TrxBeasiswa");
const TrxCatatanDataSection = require("./TrxCatatanDataSection");
const TrxDokumenDinasDaerah = require("./TrxDokumenDinasDaerah");
const TrxDokumenKhusus = require("./TrxDokumenKhusus");
const TrxDokumenUmum = require("./TrxDokumenUmum");
const TrxLog = require("./TrxLog");
const TrxPilihanProgramStudi = require("./TrxPilihanProgramStudi");
const TrxCatatanVerifikasiSection = require("./TrxCatatanVerifikasiSection");
const TrxSkDinasKabkota = require("./TrxSkDinasKabkota");
const TrxSkDinasProvinsi = require("./TrxSkDinasProvinsi");
const TrxBaDinasKabkota = require("./TrxBaDinasKabkota");
const TrxLogKeputusan = require("./TrxLogKeputusan");
const { sequelize } = require("../core/db_config");

// Buat object models supaya gampang akses
const models = {
  TrxBeasiswa,
  TrxDokumenKhusus,
  TrxDokumenUmum,
  TrxDokumenDinasDaerah,
  TrxLog,
  TrxPilihanProgramStudi,
  TrxCatatanDataSection,
  TrxCatatanVerifikasiSection,
  TrxSkDinasKabkota,
  TrxSkDinasProvinsi,
  TrxBaDinasKabkota,
  TrxLogKeputusan,
  sequelize
};

// Relasi RoleMenu ↔ Menu
module.exports = models;
