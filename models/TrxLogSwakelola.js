const { DataTypes } = require("sequelize");
const { sequelize } = require("../core/db_config");

const TrxLogSwakelola = sequelize.define(
  "TrxLogSwakelola",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: true,
    },
    id_trx_pks_lama: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    id_trx_pks_baru: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "trx_log_swakelola",
    timestamps: false,
  },
);

module.exports = TrxLogSwakelola;
