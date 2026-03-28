const { DataTypes } = require("sequelize");
const { sequelize } = require("../core/db_config");

const LogPerubahanRekening = sequelize.define(
  "LogPerubahanRekening",
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
    nama_bank_sebelumnya: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    nama_bank_pengganti: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    kode_bank_sebelumnya: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    kode_bank_pengganti: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    nomor_rekening_sebelumnya: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    nomor_rekening_pengganti: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    nama_rekening_sebelumnya: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    nama_rekening_pengganti: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    scan_buku_tabungan_sebelumnya: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    scan_buku_tabungan_pengganti: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("Pending", "Ditolak", "Disetujui"),
      allowNull: true,
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
    tableName: "log_perubahan_rekening",
    timestamps: false,
  },
);

module.exports = LogPerubahanRekening;
