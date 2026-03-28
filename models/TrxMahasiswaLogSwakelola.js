const { DataTypes } = require("sequelize");
const { sequelize } = require("../core/db_config");

const TrxMahasiswaLogSwakelola = sequelize.define(
  "TrxMahasiswaLogSwakelola",
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
    no_pks_lama: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    no_pks_baru: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    status: {
      type: DataTypes.TINYINT,
      allowNull: true,
      comment: "1=Aktif, 0=Tidak Aktif",
    },
    status2: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: "",
    },
    nik: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    nim: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    nama: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    jenis_kelamin: {
      type: DataTypes.ENUM("L", "P"),
      allowNull: true,
    },
    asal_kota: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    asal_provinsi: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    kode_pro: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    kode_kab: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    angkatan: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    no_rekening: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    nama_rekening: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    bank: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    kode_bank: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    file_scan_buku_tabungan: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    hp: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    id_kluster: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: true,
      comment: "1=Reguler, 2=Afirmasi",
    },
    kluster: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "Reguler / Afirmasi",
    },
    id_alasan_tidak_aktif: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    alasan_tidak_aktif: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    keterangan_tidak_aktif: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    file_pendukung: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    has_perubahan_rekening: {
      type: DataTypes.TINYINT,
      allowNull: true,
      defaultValue: 0,
    },
    has_perubahan_status_aktif: {
      type: DataTypes.TINYINT,
      allowNull: true,
      defaultValue: 0,
    },
    has_perubahan_ipk: {
      type: DataTypes.TINYINT,
      allowNull: true,
      defaultValue: 0,
    },
    kodefikasi: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    tableName: "trx_mahasiswa_log_swakelola",
    timestamps: false,
  },
);

module.exports = TrxMahasiswaLogSwakelola;
