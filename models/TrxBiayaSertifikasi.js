const { DataTypes } = require("sequelize");
const { sequelize } = require("../core/db_config");

const TrxBiayaSertifikasi = sequelize.define(
  "TrxBiayaSertifikasi",
  {
    id: {
      type: DataTypes.INTEGER(10),
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    id_trx_mahasiswa: {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    },
    jumlah: {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    },
    status_disetujui: {
      type: DataTypes.ENUM("Y", "N", "P"),
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
    tableName: "trx_biaya_sertifikasi",
    timestamps: false,
  },
);

module.exports = TrxBiayaSertifikasi;
