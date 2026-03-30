const { Op, fn, col } = require("sequelize");
const { TrxBeasiswa } = require("../../../models");
const { successResponse, errorResponse } = require("../../../common/response");

exports.getDashboardStats = async (req, res) => {
  try {
    const { id_beasiswa } = req.query;
    const baseWhere = {
      id_flow: { [Op.in]: [0, 1] }
    };
    if (id_beasiswa) {
      baseWhere.id_ref_beasiswa = id_beasiswa;
    }

    const jumlahPeminat = await TrxBeasiswa.count({
      where: baseWhere,
      distinct: true,
      col: "id_users"
    });

    const jumlahPendaftar = await TrxBeasiswa.count({
      where: { ...baseWhere, is_active: 1 },
      distinct: true,
      col: "id_users"
    });

    const sebaranWilayah = await TrxBeasiswa.findAll({
      attributes: [
        "tinggal_kode_prov",
        "tinggal_prov",
        [fn("COUNT", fn("DISTINCT", col("id_users"))), "jumlah_pendaftar"]
      ],
      where: {
        ...baseWhere,
        tinggal_kode_prov: { [Op.ne]: null }
      },
      group: ["tinggal_kode_prov", "tinggal_prov"],
      order: [[fn("COUNT", fn("DISTINCT", col("id_users"))), "DESC"]],
      raw: true
    });

    const totalProvinsiTerisi = sebaranWilayah.length;

    return successResponse(res, "Berhasil memuat statistik dashboard", {
      jumlah_peminat: jumlahPeminat,
      jumlah_pendaftar: jumlahPendaftar,
      total_provinsi_sebaran: totalProvinsiTerisi,
      detail_sebaran_wilayah: sebaranWilayah
    });
  } catch (error) {
    console.error("Error getDashboardStats:", error);
    return errorResponse(res, "Internal Server Error");
  }
};