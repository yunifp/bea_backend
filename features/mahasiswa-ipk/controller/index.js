const {
  successResponse,
  errorResponse,
  failResponse,
} = require("../../../common/response");
const { TrxIpk } = require("../../../models");

exports.getAllData = async (req, res) => {
  try {
    const { idTrxMahasiswa } = req.params;

    const ipk = await TrxIpk.findAll({
      where: { id_trx_mahasiswa: idTrxMahasiswa },
      order: [["semester", "ASC"]],
    });

    return successResponse(res, "Data berhasil dimuat", ipk);
  } catch (error) {
    return errorResponse(res, "Internal Server Error");
  }
};

exports.createOrUpdate = async (req, res) => {
  try {
    const { id_trx_mahasiswa, semester, nilai } = req.body;

    // validasi wajib
    if (!id_trx_mahasiswa || !semester || nilai == null) {
      return failResponse(res, "Data tidak lengkap", 400);
    }

    // cari data existing
    const exist = await TrxIpk.findOne({
      where: {
        id_trx_mahasiswa,
        semester,
      },
    });

    if (exist) {
      // UPDATE
      await TrxIpk.update(
        { nilai },
        {
          where: { id: exist.id },
        },
      );

      return successResponse(res, "IPK berhasil diperbarui");
    }

    // INSERT
    await TrxIpk.create({
      id_trx_mahasiswa,
      semester,
      nilai,
    });

    return successResponse(res, "IPK berhasil ditambahkan");
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error", 500);
  }
};
