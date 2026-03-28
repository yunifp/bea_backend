const { DataTypes } = require("sequelize");
const { sequelize } = require("../core/db_config");

const TrxBatchBiayaTransportasiPks = sequelize.define(
  "TrxBatchBiayaTransportasiPks",
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
    tahap: {
      type: DataTypes.STRING(1),
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
    tableName: "trx_batch_biaya_transportasi_pks",
    timestamps: false,
  },
);

module.exports = TrxBatchBiayaTransportasiPks;
