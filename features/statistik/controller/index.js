const { successResponse, errorResponse } = require("../../../common/response");
const { sequelize } = require("../../../core/db_config");

exports.getJumlahPengajuan = async (req, res) => {
  try {
    const { role } = req.user;

    let whereClause = "";
    const replacements = {};

    // Filter berdasarkan role
    if (role.includes(12)) {
      whereClause =
        "WHERE id_status = :id_status AND id_sub_status IN (:id_sub_status)";
      replacements.id_status = 2;
      replacements.id_sub_status = [2];
    } else if (role.includes(11)) {
      whereClause =
        "WHERE id_status = :id_status AND id_sub_status = :id_sub_status";
      replacements.id_status = 2;
      replacements.id_sub_status = 1;
    } else if (role.includes(6)) {
      whereClause = "WHERE id_status = :id_status";
      replacements.id_status = 2;
    } else if (role.includes(9)) {
      whereClause = "WHERE id_status IN (:status)";
      replacements.status = [1, 4];
    }

    // ======================
    // BIAYA HIDUP
    // ======================
    const qBiayaHidup = `
      SELECT COUNT(*) AS jumlah
      FROM trx_biaya_hidup_pks
      ${whereClause}
    `;

    const [biayaHidup] = await sequelize.query(qBiayaHidup, {
      replacements,
      type: sequelize.QueryTypes.SELECT,
    });

    // ======================
    // BIAYA PENDIDIKAN
    // ======================
    const qBiayaPendidikan = `
      SELECT COUNT(*) AS jumlah
      FROM trx_biaya_pendidikan_pks
      ${whereClause}
    `;

    const [biayaPendidikan] = await sequelize.query(qBiayaPendidikan, {
      replacements,
      type: sequelize.QueryTypes.SELECT,
    });

    // ======================
    // BIAYA BUKU
    // ======================
    const qBiayaBuku = `
      SELECT COUNT(*) AS jumlah
      FROM trx_biaya_buku_pks
      ${whereClause}
    `;

    const [biayaBuku] = await sequelize.query(qBiayaBuku, {
      replacements,
      type: sequelize.QueryTypes.SELECT,
    });

    // ======================
    // BIAYA TRANSPORTASI
    // ======================
    const qBiayaTransportasi = `
  SELECT COUNT(*) AS jumlah
  FROM trx_biaya_transportasi_pks
  ${whereClause}
`;

    const [biayaTransportasi] = await sequelize.query(qBiayaTransportasi, {
      replacements,
      type: sequelize.QueryTypes.SELECT,
    });

    const returnData = [
      {
        nama: "Biaya Hidup",
        jumlah: biayaHidup.jumlah,
      },
      {
        nama: "Biaya Pendidikan",
        jumlah: biayaPendidikan.jumlah,
      },
      {
        nama: "Biaya Buku",
        jumlah: biayaBuku.jumlah,
      },
      {
        nama: "Biaya Transportasi",
        jumlah: biayaTransportasi.jumlah,
      },
      {
        nama: "Biaya Sertifikasi",
        jumlah: 0,
      },
    ];

    return successResponse(res, "Data berhasil dimuat", returnData);
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.getJumlahPerubahanDataMahasiswa = async (req, res) => {
  try {
    const query = `
      SELECT 
        SUM(CASE WHEN has_perubahan_rekening = 1 THEN 1 ELSE 0 END) AS perubahan_rekening,
        SUM(CASE WHEN has_perubahan_status_aktif = 1 THEN 1 ELSE 0 END) AS perubahan_status_aktif,
        SUM(CASE WHEN has_perubahan_ipk = 1 THEN 1 ELSE 0 END) AS perubahan_ipk
      FROM trx_mahasiswa
    `;

    const [result] = await sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT,
    });

    const returnData = [
      {
        nama: "Perubahan Rekening",
        jumlah: result.perubahan_rekening || 0,
      },
      {
        nama: "Perubahan Status Aktif",
        jumlah: result.perubahan_status_aktif || 0,
      },
      {
        nama: "Perubahan IPK",
        jumlah: result.perubahan_ipk || 0,
      },
    ];

    return successResponse(res, "Data berhasil dimuat", returnData);
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};
