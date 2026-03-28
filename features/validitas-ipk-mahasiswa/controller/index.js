const { Op, Sequelize } = require("sequelize");
const {
  TrxValiditasIpkMahasiswa,
  TrxPks,
  TrxIpk,
  TrxMahasiswa,
  LogPerubahanIpk,
} = require("../../../models");
const { successResponse, errorResponse } = require("../../../common/response");

exports.getByPagination = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    const { id_lembaga_pendidikan } = req.user;

    const { count, rows } = await TrxValiditasIpkMahasiswa.findAndCountAll({
      attributes: [
        "id",
        "semester",
        "isi_pernyataan",
        "created_by",
        "created_at",
        [Sequelize.col("TrxPk.no_pks"), "no_pks"],
      ],
      include: [
        {
          model: TrxPks,
          attributes: [],
          required: true,
          where: { id_lembaga_pendidikan },
        },
      ],
      where: search
        ? {
            [Op.or]: [{ no_pks: { [Op.like]: `%${search}%` } }],
          }
        : {},
      limit,
      offset,
      order: [["id", "ASC"]],
      raw: true,
    });

    return successResponse(res, "Data berhasil dimuat", {
      result: rows,
      total: count,
      current_page: page,
      total_pages: Math.ceil(count / limit),
    });
  } catch (error) {
    return errorResponse(res, "Internal server error");
  }
};

exports.getLockData = async (req, res) => {
  try {
    const { id_trx_pks, semester } = req.body;

    const exist = await TrxValiditasIpkMahasiswa.findOne({
      where: {
        id_trx_pks,
        semester,
      },
    });

    return successResponse(res, "Data berhasil di-update", exist ? "Y" : "N");
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error", 500);
  }
};

exports.create = async (req, res) => {
  try {
    const { id_trx_pks, semester } = req.body;

    const insertData = {
      id_trx_pks,
      semester,
      created_at: new Date(),
      created_by: req.user.nama,
    };

    await TrxValiditasIpkMahasiswa.create(insertData);

    return successResponse(res, "Data berhasil disimpan");
  } catch (error) {
    return errorResponse(res, "Internal Server Error", 500);
  }
};

exports.getMahasiswaStatusIpk = async (req, res) => {
  try {
    const { id_trx_pks, semester } = req.body;

    const semesterColumn = `ipk_s${semester}_pengganti`;

    // 1️⃣ Ambil semua mahasiswa
    const mahasiswa = await TrxMahasiswa.findAll({
      where: { id_trx_pks },
      attributes: ["id", "nama", "nim"],
    });

    const mahasiswaIds = mahasiswa.map((m) => m.id);

    if (mahasiswaIds.length === 0) {
      return res.json({ data: [] });
    }

    // 2️⃣ Ambil yang sudah punya IPK final
    const ipk = await TrxIpk.findAll({
      where: {
        id_trx_mahasiswa: mahasiswaIds,
        semester,
      },
      attributes: ["id_trx_mahasiswa"],
    });

    const ipkIds = ipk.map((i) => i.id_trx_mahasiswa);

    // 3️⃣ Ambil yang punya log pending
    const log = await LogPerubahanIpk.findAll({
      where: {
        id_trx_pks,
        id_mahasiswa: mahasiswaIds,
        status: "Pending",
        [semesterColumn]: {
          [Op.not]: null,
        },
      },
      attributes: ["id_mahasiswa"],
    });

    const logIds = log.map((l) => l.id_mahasiswa);

    // 4️⃣ Mapping hasil akhir
    const hasil = mahasiswa
      .filter((m) => !ipkIds.includes(m.id)) // skip yang sudah ada IPK final
      .map((m) => ({
        ...m.toJSON(),
        has_diajukan: logIds.includes(m.id),
      }));

    return res.json({
      message: "Data mahasiswa IPK semester",
      data: hasil,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
    });
  }
};
