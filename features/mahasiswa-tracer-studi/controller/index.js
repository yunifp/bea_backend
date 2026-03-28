const {
  successResponse,
  errorResponse,
  failResponse,
} = require("../../../common/response");
const { TrxTracerStudi } = require("../../../models");

exports.getAllData = async (req, res) => {
  try {
    const { idTrxMahasiswa } = req.params;

    const tracerStudi = await TrxTracerStudi.findAll({
      where: { id_trx_mahasiswa: idTrxMahasiswa },
      order: [["id", "ASC"]],
    });

    return successResponse(res, "Data berhasil dimuat", tracerStudi);
  } catch (error) {
    return errorResponse(res, "Internal Server Error");
  }
};

exports.create = async (req, res) => {
  try {
    const { id_trx_mahasiswa, jalur_karir, kontribusi_lulusan } = req.body;

    // validasi wajib
    if (!id_trx_mahasiswa || !jalur_karir || !kontribusi_lulusan) {
      return failResponse(res, "Data tidak lengkap", 400);
    }

    await TrxTracerStudi.create({
      id_trx_mahasiswa,
      jalur_karir,
      kontribusi_lulusan,
    });

    return successResponse(res, "Data berhasil ditambahkan");
  } catch (error) {
    return errorResponse(res, "Internal Server Error", 500);
  }
};
