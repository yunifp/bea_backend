const { DataTypes } = require("sequelize");
const { sequelize } = require("../core/db_config");

const TrxBatchBiayaHidupPks = sequelize.define(
  "TrxBatchBiayaHidupPks",
  {
    id: {
      type: DataTypes.INTEGER(11),
      primaryKey: true,
      allowNull: false,
      autoIncrement: true, // biasanya primary key INT dibuat autoIncrement
    },
    nama: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null,
    },
    bulan: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: null,
    },
    tahun: {
      type: DataTypes.STRING(4),
      allowNull: true,
      defaultValue: null,
    },
    jenjang: {
      type: DataTypes.STRING(2),
      allowNull: true,
      defaultValue: null,
    },
    kategori: {
      type: DataTypes.STRING(8),
      allowNull: true,
      defaultValue: null,
    },
    ttd_nominatif_ppk: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
    ttd_nominatif_bendahara: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    tableName: "trx_batch_biaya_hidup_pks",
    timestamps: false,
  },
);

module.exports = TrxBatchBiayaHidupPks;
