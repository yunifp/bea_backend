const { DataTypes } = require("sequelize");
const { sequelize } = require("../core/db_config");

const TrxTracerStudi = sequelize.define(
  "TrxTracerStudi",
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
    jalur_karir: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    kontribusi_lulusan: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: "trx_tracer_studi",
    timestamps: false,
  },
);

module.exports = TrxTracerStudi;
