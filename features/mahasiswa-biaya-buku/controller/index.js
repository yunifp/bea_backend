const {
  successResponse,
  errorResponse,
  failResponse,
} = require("../../../common/response");
const { TrxBiayaBuku } = require("../../../models");

exports.getAllData = async (req, res) => {
  try {
    const { idTrxMahasiswa } = req.params;

    const biayaBuku = await TrxBiayaBuku.findAll({
      where: { id_trx_mahasiswa: idTrxMahasiswa },
      order: [["semester", "ASC"]],
    });

    return successResponse(res, "Data berhasil dimuat", biayaBuku);
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.create = async (req, res) => {
  try {
    const { id_trx_mahasiswa, semester, jumlah } = req.body;

    // validasi wajib
    if (!id_trx_mahasiswa || !semester || jumlah == null) {
      return failResponse(res, "Data tidak lengkap", 400);
    }

    // 🔴 CEK SEMESTER GANDA
    const exist = await TrxBiayaBuku.findOne({
      where: {
        id_trx_mahasiswa,
        semester,
      },
    });

    if (exist) {
      return errorResponse(
        res,
        `Biaya Buku semester ${semester} sudah ada`,
        400,
      );
    }

    await TrxBiayaBuku.create({
      id_trx_mahasiswa,
      semester,
      jumlah,
    });

    return successResponse(res, "Data berhasil ditambahkan");
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error", 500);
  }
};
