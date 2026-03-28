const { DataTypes } = require("sequelize");
const { sequelize } = require("../core/db_config");

const TrxMahasiswa = sequelize.define(
  "TrxMahasiswa",
  {
    id: {
      type: DataTypes.INTEGER(10).UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },

    id_trx_pks: {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    },

    /**
     * 1 = Aktif
     * 0 = Tidak Aktif
     */
    status: {
      type: DataTypes.TINYINT(1),
      allowNull: true,
    },

    nik: {
      type: DataTypes.STRING(16),
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
      type: DataTypes.INTEGER(4), // YEAR disimpan sebagai integer
      allowNull: true,
    },

    no_rekening: {
      type: DataTypes.STRING(30),
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
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    hp: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    id_kluster: {
      type: DataTypes.TINYINT(3).UNSIGNED,
      allowNull: true,
    },

    kluster: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    id_alasan_tidak_aktif: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    alasan_tidak_aktif: {
      type: DataTypes.STRING(10),
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
      type: DataTypes.TINYINT(1).UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },

    has_perubahan_status_aktif: {
      type: DataTypes.TINYINT(1).UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },

    has_perubahan_ipk: {
      type: DataTypes.TINYINT(1).UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    kodefikasi: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    prodi: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: "trx_mahasiswa",
    timestamps: false,
  },
);

module.exports = TrxMahasiswa;
