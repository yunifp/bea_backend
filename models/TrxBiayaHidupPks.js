const { DataTypes } = require("sequelize");
const { sequelize } = require("../core/db_config");

const TrxBiayaHidupPks = sequelize.define(
  "TrxBiayaHidupPks",
  {
    id: {
      type: DataTypes.INTEGER(10),
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    id_trx_pks: {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    },
    bulan: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    tahun: {
      type: DataTypes.STRING(4),
      allowNull: true,
    },
    jumlah: {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    },
    total_mahasiswa: {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    },
    total_mahasiswa_aktif: {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    },
    total_mahasiswa_tidak_aktif: {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    },
    id_status: {
      type: DataTypes.INTEGER(10),
      allowNull: true,
      defaultValue: "P",
    },
    status: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: "P",
    },
    id_sub_status: {
      type: DataTypes.INTEGER(10),
      allowNull: true,
      defaultValue: "P",
    },
    sub_status: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: "P",
    },
    status_transfer: {
      type: DataTypes.ENUM("Y", "N"),
      allowNull: true,
      defaultValue: "N",
    },
    file_daftar_nominatif: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    file_surat_penagihan: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    file_pernyataan_keaktifan_mahasiswa: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    tagihan_bulan_lalu: {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    },
    tagihan_bulan_ini: {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    },
    tagihan_sd_bulan_ini: {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    },
    tagihan_sisa_dana: {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    },
    ttd_staff_beasiswa: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    ttd_timestamp_staff_beasiswa: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    nama_staff_beasiswa: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    ttd_verifikator_pjk: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    nama_verifikator_pjk: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    catatan_verifikator: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    file_rab_ttd: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    id_batch: {
      type: DataTypes.INTEGER(10),
      allowNull: true,
    },
    last_update_lp: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    verify_by_lp: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    diajukan_ke_verifikator_by: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    diajukan_ke_verifikator_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    diverifikasi_ppk_by: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    diverifikasi_ppk_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    diverifikasi_bendahara_by: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    diverifikasi_bendahara_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "trx_biaya_hidup_pks",
    timestamps: false,
  },
);

module.exports = TrxBiayaHidupPks;
