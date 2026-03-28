const { DataTypes } = require("sequelize");
const { sequelize } = require("../core/db_config");

const LogPerubahanStatusAktif = sequelize.define(
  "LogPerubahanStatusAktif",
  {
    id: {
      type: DataTypes.INTEGER(11),
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },

    id_trx_pks: {
      type: DataTypes.INTEGER(11),
      allowNull: true,
    },

    id_mahasiswa: {
      type: DataTypes.INTEGER(11),
      allowNull: true,
    },

    status_aktif_sebelumnya: {
      type: DataTypes.TINYINT(1),
      allowNull: true,
    },

    status_aktif_pengganti: {
      type: DataTypes.TINYINT(1),
      allowNull: true,
    },

    id_alasan_tidak_aktif_sebelumnya: {
      type: DataTypes.TINYINT(1),
      allowNull: true,
    },

    id_alasan_tidak_aktif_pengganti: {
      type: DataTypes.TINYINT(1),
      allowNull: true,
    },

    alasan_tidak_aktif_sebelumnya: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    alasan_tidak_aktif_pengganti: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    keterangan_tidak_aktif_sebelumnya: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    keterangan_tidak_aktif_pengganti: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    file_pendukung_sebelumnya: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    file_pendukung_pengganti: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM("Pending", "Ditolak", "Disetujui"),
      allowNull: true,
      defaultValue: "Pending",
    },

    catatan: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    created_by: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    verified_by: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "log_perubahan_status_aktif",
    timestamps: false,
  },
);

module.exports = LogPerubahanStatusAktif;
