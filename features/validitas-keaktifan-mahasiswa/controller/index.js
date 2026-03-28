const { Op, Sequelize } = require("sequelize");
const { TrxValiditasKeaktifanMahasiswa, TrxPks } = require("../../../models");
const { successResponse, errorResponse } = require("../../../common/response");

exports.getByPagination = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    const { id_lembaga_pendidikan } = req.user;

    const { count, rows } =
      await TrxValiditasKeaktifanMahasiswa.findAndCountAll({
        attributes: [
          "id",
          "bulan",
          "tahun",
          "isi_pernyataan",
          "created_by",
          "created_at",
          [Sequelize.col("TrxPk.no_pks"), "no_pks"], // ambil dari relasi
        ],
        include: [
          {
            model: TrxPks,
            attributes: [], // kosongkan supaya tidak nested
            required: true,
            where: { id_lembaga_pendidikan },
          },
        ],
        where: search
          ? {
              [Op.or]: [
                { bulan: { [Op.like]: `%${search}%` } },
                { tahun: { [Op.like]: `%${search}%` } },
              ],
            }
          : {},
        limit,
        offset,
        order: [["id", "ASC"]],
        raw: true, // supaya flat
      });

    return successResponse(res, "Data berhasil dimuat", {
      result: rows,
      total: count,
      current_page: page,
      total_pages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal server error");
  }
};

exports.getLockData = async (req, res) => {
  try {
    const { id_trx_pks, bulan, tahun } = req.body;

    const exist = await TrxValiditasKeaktifanMahasiswa.findOne({
      where: {
        id_trx_pks,
        bulan,
        tahun,
      },
    });

    return successResponse(res, "Data berhasil di-update", exist ? "Y" : "N");
  } catch (error) {
    return errorResponse(res, "Internal Server Error", 500);
  }
};

exports.create = async (req, res) => {
  try {
    const { id_trx_pks, bulan, tahun, isi_pernyataan } = req.body;

    const insertData = {
      id_trx_pks,
      bulan,
      tahun,
      isi_pernyataan,
      created_at: new Date(),
      created_by: req.user.nama,
    };

    await TrxValiditasKeaktifanMahasiswa.create(insertData);

    return successResponse(res, "Data berhasil disimpan");
  } catch (error) {
    return errorResponse(res, "Internal Server Error", 500);
  }
};
