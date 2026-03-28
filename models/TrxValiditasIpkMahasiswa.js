const { DataTypes } = require("sequelize");
const { sequelize } = require("../core/db_config");

const TrxValiditasIpkMahasiswa = sequelize.define(
  "TrxValiditasIpkMahasiswa",
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
    semester: {
      type: DataTypes.STRING(1),
      allowNull: true,
    },
    isi_pernyataan: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "trx_validitas_ipk_mahasiswa",
    timestamps: false,
    indexes: [
      {
        name: "id_trx_pks",
        fields: ["id_trx_pks"],
      },
    ],
  },
);

module.exports = TrxValiditasIpkMahasiswa;
