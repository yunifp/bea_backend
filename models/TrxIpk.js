const { DataTypes } = require("sequelize");
const { sequelize } = require("../core/db_config");

const TrxIpk = sequelize.define(
  "TrxIpk",
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
    semester: {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    },
    nilai: {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    },
  },
  {
    tableName: "trx_ipk",
    timestamps: false,
  },
);

module.exports = TrxIpk;
