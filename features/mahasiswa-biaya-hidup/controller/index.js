const {
  successResponse,
  errorResponse,
  failResponse,
} = require("../../../common/response");
const { TrxBiayaHidup } = require("../../../models");

exports.getAllData = async (req, res) => {
  try {
    const { idTrxMahasiswa } = req.params;

    const biayaHidup = await TrxBiayaHidup.findAll({
      where: { id_trx_mahasiswa: idTrxMahasiswa },
      order: [["id", "ASC"]],
    });

    return successResponse(res, "Data berhasil dimuat", biayaHidup);
  } catch (error) {
    return errorResponse(res, "Internal Server Error");
  }
};

exports.create = async (req, res) => {
  try {
    const { id_trx_mahasiswa, bulan, jumlah } = req.body;

    // validasi wajib
    if (!id_trx_mahasiswa || !bulan || jumlah == null) {
      return failResponse(res, "Data tidak lengkap", 400);
    }

    // 🔴 CEK SEMESTER GANDA
    const exist = await TrxBiayaHidup.findOne({
      where: {
        id_trx_mahasiswa,
        bulan,
      },
    });

    if (exist) {
      return errorResponse(res, `Biaya Hidup bulan ${bulan} sudah ada`, 400);
    }

    await TrxBiayaHidup.create({
      id_trx_mahasiswa,
      bulan,
      jumlah,
    });

    return successResponse(res, "Data berhasil ditambahkan");
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error", 500);
  }
};
