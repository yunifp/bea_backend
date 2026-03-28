const { DataTypes } = require("sequelize");
const { sequelize } = require("../core/db_config");

const LogPerubahanIpk = sequelize.define(
  "LogPerubahanIpk",
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

    // Semester 1
    ipk_s1_sebelumnya: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
    },
    ipk_s1_pengganti: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
    },

    // Semester 2
    ipk_s2_sebelumnya: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
    },
    ipk_s2_pengganti: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
    },

    // Semester 3
    ipk_s3_sebelumnya: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
    },
    ipk_s3_pengganti: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
    },

    // Semester 4
    ipk_s4_sebelumnya: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
    },
    ipk_s4_pengganti: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
    },

    // Semester 5
    ipk_s5_sebelumnya: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
    },
    ipk_s5_pengganti: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
    },

    // Semester 6
    ipk_s6_sebelumnya: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
    },
    ipk_s6_pengganti: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
    },

    // Semester 7
    ipk_s7_sebelumnya: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
    },
    ipk_s7_pengganti: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
    },

    // Semester 8
    ipk_s8_sebelumnya: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
    },
    ipk_s8_pengganti: {
      type: DataTypes.DECIMAL(3, 2),
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
    tableName: "log_perubahan_ipk",
    timestamps: false,
  },
);

module.exports = LogPerubahanIpk;
