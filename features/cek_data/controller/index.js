const { TrxBeasiswa } = require("../../../models");
const { successResponse, errorResponse } = require("../../../common/response");

exports.cekDataByNik = async (req, res) => {
  try {
    const { nik } = req.query;

    if (!nik) {
      return errorResponse(res, "Parameter NIK tidak boleh kosong.");
    }

    // Mencari data berdasarkan NIK. 
    // Menggunakan findAll untuk mengantisipasi jika 1 NIK mendaftar di 2 batch beasiswa yang berbeda.
    const data = await TrxBeasiswa.findAll({
      where: { nik: nik },
      order: [["id_trx_beasiswa", "DESC"]] // Urutkan dari data pendaftaran terbaru
    });

    if (!data || data.length === 0) {
      // Jika data tidak ada, kita kembalikan response sukses tapi dengan array kosong agar frontend mudah menanganinya
      return successResponse(res, "Data tidak ditemukan untuk NIK tersebut.", []);
    }

    return successResponse(res, "Data pendaftar berhasil ditemukan.", data);
  } catch (error) {
    console.error("Error cekDataByNik:", error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.cekStatusPublic = async (req, res) => {
  try {
    const { nik } = req.query;

    if (!nik) {
      return errorResponse(res, "Parameter NIK tidak boleh kosong.");
    }

    // Mengambil data secara SPESIFIK. Hanya kolom yang tidak sensitif yang diambil!
    const data = await TrxBeasiswa.findAll({
      where: { nik: nik },
      attributes: [
        "nama_lengkap", 
        "nama_beasiswa", 
        "id_flow", 
        "nama_kluster", 
        "pt_final", 
        "prodi_final"
      ],
      order: [["id_trx_beasiswa", "DESC"]]
    });

    if (!data || data.length === 0) {
      return successResponse(res, "Data tidak ditemukan.", []);
    }

    return successResponse(res, "Status berhasil ditemukan.", data);
  } catch (error) {
    console.error("Error cekStatusPublic:", error);
    return errorResponse(res, "Internal Server Error");
  }
};