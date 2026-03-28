const { DataTypes } = require("sequelize");
const { sequelize } = require("../core/db_config");

const TrxBiayaBuku = sequelize.define(
  "TrxBiayaBuku",
  {
    id: {
      type: DataTypes.INTEGER(10),
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    id_trx_biaya_buku_pks: {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    },
    id_trx_mahasiswa: {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    },
    semester: {
      type: DataTypes.STRING(1),
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
    tableName: "trx_biaya_buku_mahasiswa",
    timestamps: false,
  },
);

module.exports = TrxBiayaBuku;
