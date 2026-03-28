const { DataTypes } = require("sequelize");
const { sequelize } = require("../core/db_config");

const TrxBiayaHidup = sequelize.define(
  "TrxBiayaHidup",
  {
    id: {
      type: DataTypes.INTEGER(10),
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    id_trx_biaya_hidup_pks: {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    },
    id_trx_mahasiswa: {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    },
    bulan: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    tahun: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    nik: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    jumlah: {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    },
    status_disetujui: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: "P",
    },
    status_transfer: {
      type: DataTypes.ENUM("Y", "N"),
      allowNull: true,
      defaultValue: "N",
    },
  },
  {
    tableName: "trx_biaya_hidup_mahasiswa",
    timestamps: false,
  },
);

module.exports = TrxBiayaHidup;
