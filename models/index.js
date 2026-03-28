const LogPengajuan = require("./LogPengajuan");
const TrxBiayaBuku = require("./TrxBiayaBuku");
const TrxBiayaHidup = require("./TrxBiayaHidup");
const TrxBiayaHidupPks = require("./TrxBiayaHidupPks");
const TrxBiayaBukuPks = require("./TrxBiayaBukuPks");
const TrxBiayaPendidikanPks = require("./TrxBiayaPendidikanPks");
const TrxBiayaPendidikan = require("./TrxBiayaPendidikan");
const TrxBiayaTransportasiPks = require("./TrxBiayaTransportasiPks");
const TrxBiayaSertifikasi = require("./TrxBiayaSertifikasi");
const TrxBiayaTransportasi = require("./TrxBiayaTransportasi");
const TrxIpk = require("./TrxIpk");
const TrxMahasiswa = require("./TrxMahasiswa");
const TrxPks = require("./TrxPks");
const TrxTracerStudi = require("./TrxTracerStudi");
const TrxBatchBiayaHidupPks = require("./TrxBatchBiayaHidupPks");
const TrxBatchBiayaBukuPks = require("./TrxBatchBiayaBukuPks");
const TrxBatchBiayaPendidikanPks = require("./TrxBatchBiayaPendidikanPks");
const TrxBatchBiayaTransportasiPks = require("./TrxBatchBiayaTransportasiPks");
const LogPerubahanRekening = require("./LogPerubahanRekening");
const LogPerubahanStatusAktif = require("./LogPerubahanStatusAktif");
const LogPerubahanIpk = require("./LogPerubahanIpk");
const TrxValiditasKeaktifanMahasiswa = require("./TrxValiditasKeaktifanMahasiswa");
const TrxValiditasIpkMahasiswa = require("./TrxValiditasIpkMahasiswa");
const TrxBiayaSertifikasiPks = require("./TrxBiayaSertifikasiPks");
const TrxMahasiswaLogSwakelola = require("./TrxMahasiswaLogSwakelola");
const TrxLogSwakelola = require("./TrxLogSwakelola");
const LogPerubahanProfilLembaga = require("./LogPerubahanProfilLembaga");

// Buat object models supaya gampang akses
const models = {
  TrxPks,
  TrxMahasiswa,
  TrxIpk,
  TrxBiayaHidup,
  TrxBiayaPendidikan,
  TrxBiayaBuku,
  TrxBiayaTransportasi,
  TrxBiayaSertifikasi,
  TrxTracerStudi,

  TrxBiayaHidupPks,
  TrxBatchBiayaHidupPks,

  TrxBiayaBukuPks,
  TrxBatchBiayaBukuPks,

  TrxBiayaPendidikanPks,
  TrxBatchBiayaPendidikanPks,

  TrxBiayaTransportasiPks,
  TrxBatchBiayaTransportasiPks,

  TrxBiayaSertifikasiPks,

  LogPengajuan,
  LogPerubahanRekening,
  LogPerubahanStatusAktif,
  LogPerubahanIpk,
  LogPerubahanProfilLembaga,

  TrxValiditasKeaktifanMahasiswa,
  TrxValiditasIpkMahasiswa,
  TrxMahasiswaLogSwakelola,

  TrxLogSwakelola,
};

// TrxBiayaHidupPks.js
TrxBiayaHidupPks.belongsTo(TrxPks, {
  foreignKey: "id_trx_pks",
});

// TrxPks.js
TrxPks.hasMany(TrxBiayaHidupPks, {
  foreignKey: "id_trx_pks",
});

// TrxBiayaBukuPks.js
TrxBiayaBukuPks.belongsTo(TrxPks, {
  foreignKey: "id_trx_pks",
});

// TrxPks.js
TrxPks.hasMany(TrxBiayaBukuPks, {
  foreignKey: "id_trx_pks",
});

// TrxBiayaPendidikanPks.js
TrxBiayaPendidikanPks.belongsTo(TrxPks, {
  foreignKey: "id_trx_pks",
});

// TrxPks.js
TrxPks.hasMany(TrxBiayaPendidikanPks, {
  foreignKey: "id_trx_pks",
});

// TrxBiayaTransportasiPks.js
TrxBiayaTransportasiPks.belongsTo(TrxPks, {
  foreignKey: "id_trx_pks",
});

// TrxPks.js
TrxPks.hasMany(TrxBiayaTransportasiPks, {
  foreignKey: "id_trx_pks",
});

TrxPks.hasMany(TrxMahasiswa, {
  foreignKey: "id_trx_pks",
});

TrxMahasiswa.belongsTo(TrxPks, {
  foreignKey: "id_trx_pks",
});

TrxMahasiswa.belongsTo(TrxPks, { foreignKey: "no_pks", targetKey: "no_pks" });

TrxValiditasKeaktifanMahasiswa.belongsTo(TrxPks, {
  foreignKey: "id_trx_pks",
});

TrxPks.hasMany(TrxValiditasKeaktifanMahasiswa, {
  foreignKey: "id_trx_pks",
});

TrxValiditasIpkMahasiswa.belongsTo(TrxPks, {
  foreignKey: "id_trx_pks",
});

TrxPks.hasMany(TrxValiditasIpkMahasiswa, {
  foreignKey: "id_trx_pks",
});

module.exports = models;
