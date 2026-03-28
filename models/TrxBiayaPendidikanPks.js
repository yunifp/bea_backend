const { DataTypes } = require("sequelize");
const { sequelize } = require("../core/db_config");

const TrxBiayaPendidikanPks = sequelize.define(
  "TrxBiayaPendidikanPks",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },

    id_trx_pks: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    semester: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    tahun: {
      type: DataTypes.STRING(4),
      allowNull: true,
    },

    jumlah: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },

    total_mahasiswa: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    total_mahasiswa_aktif: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    total_mahasiswa_tidak_aktif: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    id_status: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    status: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    id_sub_status: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    sub_status: {
      type: DataTypes.STRING(100),
      allowNull: true,
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

    file_laporan_kegiatan_semester: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    file_sptjm: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    file_bukti_kwitansi: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    tagihan_semester_lalu: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },

    tagihan_semester_ini: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },

    tagihan_sd_semester_ini: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },

    tagihan_sisa_dana: {
      type: DataTypes.DECIMAL(20, 6),
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

    ttd_nominatif_ppk: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    ttd_nominatif_bendahara: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    last_update_lp: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    verify_by_lp: {
      type: DataTypes.DATEONLY,
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

    diverifikasi_ppk_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    diverifikasi_ppk_by: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    diverifikasi_bendahara_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    diverifikasi_bendahara_by: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: "trx_biaya_pendidikan_pks",
    timestamps: false,
  },
);

module.exports = TrxBiayaPendidikanPks;
