const { successResponse, errorResponse } = require("../../../common/response");
const { sequelize } = require("../../../core/db_config");

exports.getJumlahMahasiswaPerLembagaPendidikan = async (req, res) => {
  try {
    const { tahun } = req.query;

    const result = await sequelize.query(
      `
  SELECT 
      b.id_lembaga_pendidikan,
      b.lembaga_pendidikan,
      COUNT(*) AS jml
  FROM trx_mahasiswa a
  JOIN trx_pks b 
      ON a.no_pks = b.no_pks
  WHERE a.angkatan = :angkatan
  GROUP BY 
      b.id_lembaga_pendidikan,
      b.lembaga_pendidikan
  ORDER BY jml DESC
  `,
      {
        replacements: { angkatan: tahun },
        type: sequelize.QueryTypes.SELECT,
      },
    );

    return successResponse(res, "Data berhasil dimuat", result);
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.getJumlahMahasiswaPerProvinsi = async (req, res) => {
  try {
    const { tahun } = req.query;

    const result = await sequelize.query(
      `
    SELECT 
    a.asal_provinsi,
      COUNT(*) AS jml
  FROM trx_mahasiswa a

  WHERE a.angkatan = :angkatan
  GROUP BY 
      a.asal_provinsi
  ORDER BY jml DESC;
  `,
      {
        replacements: { angkatan: tahun },
        type: sequelize.QueryTypes.SELECT,
      },
    );

    return successResponse(res, "Data berhasil dimuat", result);
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error");
  }
};
