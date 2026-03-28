const { DataTypes } = require("sequelize");
const { sequelize } = require("../core/db_config");

const LogPerubahanProfilLembaga = sequelize.define(
  "LogPerubahanProfilLembaga",
  {
    id: {
      type: DataTypes.INTEGER(11),
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },

    id_lembaga_pendidikan: {
      type: DataTypes.INTEGER(11),
      allowNull: true,
    },

    logo_sebelumnya: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    logo_pengganti: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    nama_sebelumnya: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    nama_pengganti: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    kode_sebelumnya: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },

    kode_pengganti: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },

    singkatan_sebelumnya: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },

    singkatan_pengganti: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },

    jenis_sebelumnya: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    jenis_pengganti: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    alamat_sebelumnya: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    alamat_pengganti: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    kota_sebelumnya: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    kota_pengganti: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    kode_pos_sebelumnya: {
      type: DataTypes.STRING(5),
      allowNull: true,
    },

    kode_pos_pengganti: {
      type: DataTypes.STRING(5),
      allowNull: true,
    },

    no_telepon_sebelumnya: {
      type: DataTypes.STRING(16),
      allowNull: true,
    },

    no_telepon_pengganti: {
      type: DataTypes.STRING(16),
      allowNull: true,
    },

    fax_sebelumnya: {
      type: DataTypes.STRING(16),
      allowNull: true,
    },

    fax_pengganti: {
      type: DataTypes.STRING(16),
      allowNull: true,
    },

    email_sebelumnya: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    email_pengganti: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    website_sebelumnya: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    website_pengganti: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    nama_pimpinan_sebelumnya: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    nama_pimpinan_pengganti: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    no_telepon_pimpinan_sebelumnya: {
      type: DataTypes.STRING(16),
      allowNull: true,
    },

    no_telepon_pimpinan_pengganti: {
      type: DataTypes.STRING(16),
      allowNull: true,
    },

    jabatan_pimpinan_sebelumnya: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    jabatan_pimpinan_pengganti: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    no_rekening_sebelumnya: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    no_rekening_pengganti: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    nama_bank_sebelumnya: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    nama_bank_pengganti: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    penerima_transfer_sebelumnya: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    penerima_transfer_pengganti: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    npwp_sebelumnya: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    npwp_pengganti: {
      type: DataTypes.STRING(20),
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
    tableName: "log_perubahan_profil_lembaga",
    timestamps: false,
  },
);

module.exports = LogPerubahanProfilLembaga;
