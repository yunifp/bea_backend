const { DataTypes } = require("sequelize");
const { sequelize } = require("../core/db_config");

const LogPengajuan = sequelize.define(
  "LogPengajuan",
  {
    id: {
      type: DataTypes.INTEGER(11),
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    id_pengajuan: {
      type: DataTypes.INTEGER(11),
      allowNull: true,
    },
    section: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    aksi: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    catatan: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "log_pengajuan",
    timestamps: false,
  },
);

module.exports = LogPengajuan;
