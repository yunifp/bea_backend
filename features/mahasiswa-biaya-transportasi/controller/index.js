const {
  successResponse,
  errorResponse,
  failResponse,
} = require("../../../common/response");
const { TrxBiayaTransportasi } = require("../../../models");

exports.getAllData = async (req, res) => {
  try {
    const { idTrxMahasiswa } = req.params;

    const biayaTransportasi = await TrxBiayaTransportasi.findAll({
      where: { id_trx_mahasiswa: idTrxMahasiswa },
      order: [["id", "ASC"]],
    });

    return successResponse(res, "Data berhasil dimuat", biayaTransportasi);
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.create = async (req, res) => {
  try {
    const { id_trx_mahasiswa, tahap, jumlah } = req.body;

    // validasi wajib
    if (!id_trx_mahasiswa || !tahap || jumlah == null) {
      return failResponse(res, "Data tidak lengkap", 400);
    }

    await TrxBiayaTransportasi.create({
      id_trx_mahasiswa,
      tahap,
      jumlah,
    });

    return successResponse(res, "Data berhasil ditambahkan");
  } catch (error) {
    return errorResponse(res, "Internal Server Error", 500);
  }
};
