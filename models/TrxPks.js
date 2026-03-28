const { DataTypes } = require("sequelize");
const { sequelize } = require("../core/db_config");

const TrxPks = sequelize.define(
  "TrxPks",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },

    id_trx_pks_referensi: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    no_pks: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    tanggal_pks: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    tanggal_awal_pks: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    tanggal_akhir_pks: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    id_lembaga_pendidikan: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    lembaga_pendidikan: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    id_jenjang: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    jenjang: {
      type: DataTypes.STRING(5),
      allowNull: true,
    },

    tahun_angkatan: {
      type: DataTypes.STRING(4),
      allowNull: true,
    },

    is_swakelola: {
      type: DataTypes.ENUM("Y", "N"),
      allowNull: true,
    },

    file_pks: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    jumlah_mahasiswa: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    biaya_hidup: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },

    biaya_hidup_per_bulan: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },

    biaya_hidup_per_bulan_per_mahasiswa: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },

    biaya_pendidikan: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },

    biaya_pendidikan_semester_1: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },
    biaya_pendidikan_semester_2: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },
    biaya_pendidikan_semester_3: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },
    biaya_pendidikan_semester_4: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },
    biaya_pendidikan_semester_5: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },
    biaya_pendidikan_semester_6: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },
    biaya_pendidikan_semester_7: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },
    biaya_pendidikan_semester_8: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },

    biaya_pendidikan_semester_1_per_mahasiswa: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },
    biaya_pendidikan_semester_2_per_mahasiswa: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },
    biaya_pendidikan_semester_3_per_mahasiswa: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },
    biaya_pendidikan_semester_4_per_mahasiswa: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },
    biaya_pendidikan_semester_5_per_mahasiswa: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },
    biaya_pendidikan_semester_6_per_mahasiswa: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },
    biaya_pendidikan_semester_7_per_mahasiswa: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },
    biaya_pendidikan_semester_8_per_mahasiswa: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },

    biaya_buku: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },

    biaya_buku_per_semester: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },

    biaya_buku_per_semester_per_mahasiswa: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },

    biaya_transportasi: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },

    biaya_transportasi_per_tahap: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },

    biaya_transportasi_per_tahap_per_mahasiswa: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },

    biaya_sertifikasi_kompetensi: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },

    biaya_sertifikasi_kompetensi_per_mahasiswa: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },

    nilai_pks: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
    },
  },
  {
    tableName: "trx_pks",
    timestamps: false,
  },
);

module.exports = TrxPks;
