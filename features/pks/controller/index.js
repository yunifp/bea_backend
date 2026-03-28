const { successResponse, errorResponse } = require("../../../common/response");
const { Op, fn, col, literal } = require("sequelize");
const {
  TrxPks,
  TrxMahasiswa,
  TrxBiayaHidupPks,
  TrxMahasiswaLogSwakelola,
  TrxLogSwakelola,
} = require("../../../models");
const { safeSplit, getCellString } = require("../../../utils/stringFormatter");
const { getFileUrl } = require("../../../common/middleware/upload_middleware");
const ExcelJS = require("exceljs");
const { sequelize } = require("../../../core/db_config");

exports.getPksGroupedByPagination = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    const whereCondition = {};

    if (search) {
      whereCondition[Op.or] = [{ no_pks: { [Op.like]: `%${search}%` } }];
    }

    if (req.query.lpId) {
      whereCondition.id_lembaga_pendidikan = req.query.lpId;
    }

    if (req.query.jenjang) {
      whereCondition.jenjang = req.query.jenjang;
    }

    if (req.query.tahun) {
      whereCondition.tahun_angkatan = req.query.tahun;
    }

    /* =====================================================
     * STEP 1: PAGINATION BERDASARKAN no_pks (UNIK)
     * ===================================================== */
    const { count, rows } = await TrxPks.findAndCountAll({
      attributes: ["no_pks"],
      where: whereCondition,
      group: ["no_pks"],
      order: [["no_pks", "ASC"]],
      limit,
      offset,
      subQuery: false,
    });

    const noPksList = rows.map((r) => r.no_pks);

    if (noPksList.length === 0) {
      return successResponse(res, "Data berhasil dimuat", {
        result: [],
        total: 0,
        current_page: page,
        total_pages: 0,
      });
    }

    /* =====================================================
     * STEP 2: AMBIL DETAIL SEMUA ROW BERDASARKAN no_pks
     * ===================================================== */
    const detailRows = await TrxPks.findAll({
      where: {
        no_pks: noPksList,
      },
      order: [["id", "ASC"]],
    });

    /* =====================================================
     * STEP 3: GROUPING DATA
     * ===================================================== */
    const grouped = {};

    detailRows.forEach((row) => {
      const data = row.toJSON();
      const key = data.no_pks;

      if (!grouped[key]) {
        grouped[key] = {
          no_pks: data.no_pks,
          tanggal_pks: data.tanggal_pks,

          id_lembaga_pendidikan: data.id_lembaga_pendidikan,
          lembaga_pendidikan: data.lembaga_pendidikan,

          is_swakelola: data.is_swakelola,

          biaya_hidup: data.biaya_hidup,
          biaya_pendidikan: data.biaya_pendidikan,
          biaya_buku: data.biaya_buku,
          biaya_transportasi: data.biaya_transportasi,
          biaya_sertifikasi_kompetensi: data.biaya_sertifikasi_kompetensi,

          nilai_pks: data.nilai_pks,

          file_pks: data.file_pks
            ? getFileUrl(req, "file_pks", data.file_pks)
            : null,

          // 🔥 ARRAY JENJANG
          jenjang: [],
        };
      }

      grouped[key].jenjang.push({
        id: data.id_jenjang,
        jenjang: data.jenjang,
        tahun_angkatan: data.tahun_angkatan,
      });
    });

    const result = Object.values(grouped);

    /* =====================================================
     * STEP 4: RESPONSE
     * ===================================================== */
    return successResponse(res, "Data berhasil dimuat", {
      result,
      total: count.length, // count dari group
      current_page: page,
      total_pages: Math.ceil(count.length / limit),
    });
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal server error");
  }
};

exports.getPksByPagination = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    const { role, id_lembaga_pendidikan, id_jenjang } = req.user;

    const baseCondition = {};

    if (role.includes(8)) {
      const jenjangIds = normalizeJenjang(id_jenjang);

      baseCondition.id_lembaga_pendidikan = id_lembaga_pendidikan;
      baseCondition.id_jenjang = {
        [Op.in]: jenjangIds,
      };
    }

    const whereCondition = {
      [Op.and]: [
        baseCondition,
        ...(search
          ? [
              {
                [Op.or]: [{ no_pks: { [Op.like]: `%${search}%` } }],
              },
            ]
          : []),
      ],
    };

    if (req.query.lpId) {
      whereCondition.id_lembaga_pendidikan = req.query.lpId;
    }

    if (req.query.jenjang) {
      whereCondition.jenjang = req.query.jenjang;
    }

    if (req.query.tahun) {
      whereCondition.tahun_angkatan = req.query.tahun;
    }

    if (req.query.jenis_swakelola) {
      const jenis = req.query.jenis_swakelola.toLowerCase();

      if (jenis === "reguler") {
        whereCondition.is_swakelola = "N";
      } else if (jenis === "swakelola") {
        whereCondition.is_swakelola = "Y";
      }
    }

    const { count, rows } = await TrxPks.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      order: [["id", "ASC"]],
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

exports.getPksWithJumlahPerubahanByPagination = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";
    const jenis_perubahan = req.query.jenis_perubahan;

    const { role, id_lembaga_pendidikan, id_jenjang } = req.user;

    const baseCondition = {};

    if (role.includes(8)) {
      const jenjangIds = normalizeJenjang(id_jenjang);

      baseCondition.id_lembaga_pendidikan = id_lembaga_pendidikan;
      baseCondition.id_jenjang = {
        [Op.in]: jenjangIds,
      };
    }

    const whereCondition = {
      [Op.and]: [
        baseCondition,
        ...(search
          ? [
              {
                [Op.or]: [{ no_pks: { [Op.like]: `%${search}%` } }],
              },
            ]
          : []),
      ],
    };

    if (req.query.lpId) {
      whereCondition.id_lembaga_pendidikan = req.query.lpId;
    }

    if (req.query.jenjang) {
      whereCondition.id_jenjang = req.query.jenjang;
    }

    if (req.query.tahun) {
      whereCondition.tahun_angkatan = req.query.tahun;
    }

    // ✅ Tambahkan filter berdasarkan query q
    const mahasiswaWhere = {};
    if (jenis_perubahan === "perubahan-rekening") {
      mahasiswaWhere.has_perubahan_rekening = 1;
    } else if (jenis_perubahan === "perubahan-status-aktif") {
      mahasiswaWhere.has_perubahan_status_aktif = 1;
    } else if (jenis_perubahan === "perubahan-ipk") {
      mahasiswaWhere.has_perubahan_ipk = 1;
    }

    const { count, rows } = await TrxPks.findAndCountAll({
      where: whereCondition,
      attributes: {
        include: [
          [
            fn(
              "SUM",
              literal(
                "CASE WHEN TrxMahasiswas.has_perubahan_rekening = 1 THEN 1 ELSE 0 END",
              ),
            ),
            "jumlah_perubahan_rekening",
          ],
          [
            fn(
              "SUM",
              literal(
                "CASE WHEN TrxMahasiswas.has_perubahan_status_aktif = 1 THEN 1 ELSE 0 END",
              ),
            ),
            "jumlah_perubahan_status_aktif",
          ],
          [
            fn(
              "SUM",
              literal(
                "CASE WHEN TrxMahasiswas.has_perubahan_ipk = 1 THEN 1 ELSE 0 END",
              ),
            ),
            "jumlah_perubahan_ipk",
          ],
        ],
      },
      include: [
        {
          model: TrxMahasiswa,
          attributes: [],
          where: Object.keys(mahasiswaWhere).length
            ? mahasiswaWhere
            : undefined,
        },
      ],
      group: ["TrxPks.id"],
      subQuery: false,
      limit,
      offset,
      order: [["id", "ASC"]],
    });

    return successResponse(res, "Data berhasil dimuat", {
      result: rows,
      total: count.length, // karena pakai group
      current_page: page,
      total_pages: Math.ceil(count.length / limit),
    });
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal server error");
  }
};

exports.getAllPks = async (req, res) => {
  try {
    const {
      role,
      id_lembaga_pendidikan: userLpId,
      id_jenjang: userJenjang,
    } = req.user;

    const baseCondition = {};

    // Default filter berdasarkan user jika role 8
    if (role.includes(8)) {
      baseCondition.id_lembaga_pendidikan = userLpId;
      baseCondition.id_jenjang = userJenjang;
    }

    // Override id_lembaga_pendidikan dari query jika ada
    if (req.query.id_lembaga_pendidikan) {
      const lpId = parseInt(req.query.id_lembaga_pendidikan);
      if (!isNaN(lpId)) {
        baseCondition.id_lembaga_pendidikan = lpId;
      }
    }

    // Override jenjang dari query jika ada
    if (req.query.id_jenjang) {
      const jenjangId = parseInt(req.query.id_jenjang);
      if (!isNaN(jenjangId)) {
        baseCondition.id_jenjang = jenjangId;
      }
    }

    // Mapping sesuai request jenis_swakelola
    const swakelolaMap = {
      reguler: "N", // reguler → ambil N
      swakelola: "Y", // swakelola → ambil Y
    };

    const jenisSwakelola = req.query.jenis_swakelola?.toLowerCase();
    if (jenisSwakelola && swakelolaMap[jenisSwakelola]) {
      baseCondition.is_swakelola = swakelolaMap[jenisSwakelola];
    }

    const rows = await TrxPks.findAll({
      where: baseCondition,
    });

    const formattedRows = rows.map((user) => {
      const data = user.toJSON();

      if (data.file_pks) {
        data.file_pks = getFileUrl(req, "file_pks", data.file_pks);
      }

      return data;
    });

    return successResponse(res, "Data berhasil dimuat", formattedRows);
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal server error");
  }
};

exports.create = async (req, res) => {
  try {
    const {
      id_pks_referensi,
      no_pks,
      tanggal_pks,
      tanggal_awal_pks,
      tanggal_akhir_pks,
      lembaga_pendidikan,
      jenjang,
      is_swakelola,
      jumlah_mahasiswa,
      tahun,

      // biaya utama
      biaya_hidup,
      biaya_pendidikan,
      biaya_buku,
      biaya_transportasi,
      biaya_sertifikasi_kompetensi,

      // biaya turunan
      biaya_hidup_per_bulan,
      biaya_hidup_per_bulan_per_mahasiswa,

      biaya_buku_per_semester,
      biaya_buku_per_semester_per_mahasiswa,

      biaya_transportasi_per_tahap,
      biaya_transportasi_per_tahap_per_mahasiswa,

      biaya_sertifikasi_kompetensi_per_mahasiswa,
    } = req.body;

    // ===============================
    // PARSE JENJANG
    // ===============================
    const [idJenjang, namaJenjang] = safeSplit(jenjang);

    // ===============================
    // PARSE TAHUN (SEKARANG STRING BIASA)
    // ===============================
    if (!tahun || typeof tahun !== "string") {
      return errorResponse(res, "Tahun wajib diisi");
    }

    // ===============================
    // FILE
    // ===============================
    const file_pks = req.file?.filename ?? null;

    const [idLembagaPendidikan, namaLembagaPendidikan] =
      safeSplit(lembaga_pendidikan);

    const toNumber = (val) =>
      val !== undefined && val !== null && val !== "" ? Number(val) : 0;

    // ===============================
    // KONVERSI BIAYA UTAMA
    // ===============================
    const biaya = {
      biaya_hidup: toNumber(biaya_hidup),
      biaya_hidup_per_bulan: toNumber(biaya_hidup_per_bulan),
      biaya_hidup_per_bulan_per_mahasiswa: toNumber(
        biaya_hidup_per_bulan_per_mahasiswa,
      ),

      biaya_pendidikan: toNumber(biaya_pendidikan),

      biaya_buku: toNumber(biaya_buku),
      biaya_buku_per_semester: toNumber(biaya_buku_per_semester),
      biaya_buku_per_semester_per_mahasiswa: toNumber(
        biaya_buku_per_semester_per_mahasiswa,
      ),

      biaya_transportasi: toNumber(biaya_transportasi),
      biaya_transportasi_per_tahap: toNumber(biaya_transportasi_per_tahap),
      biaya_transportasi_per_tahap_per_mahasiswa: toNumber(
        biaya_transportasi_per_tahap_per_mahasiswa,
      ),

      biaya_sertifikasi_kompetensi: toNumber(biaya_sertifikasi_kompetensi),
      biaya_sertifikasi_kompetensi_per_mahasiswa: toNumber(
        biaya_sertifikasi_kompetensi_per_mahasiswa,
      ),
    };

    const totalMahasiswa = toNumber(jumlah_mahasiswa);

    // ===============================
    // HANDLE SEMESTER DINAMIS (1–8)
    // ===============================
    const MAX_SEMESTER = 8;

    const semesterFields = {};
    const semesterPerMahasiswaFields = {};

    for (let i = 1; i <= MAX_SEMESTER; i++) {
      const key = `biaya_pendidikan_semester_${i}`;
      const keyPerMhs = `biaya_pendidikan_semester_${i}_per_mahasiswa`;

      semesterFields[key] =
        req.body[key] !== undefined ? toNumber(req.body[key]) : null;

      semesterPerMahasiswaFields[keyPerMhs] =
        req.body[keyPerMhs] !== undefined
          ? toNumber(req.body[keyPerMhs])
          : null;
    }

    // ===============================
    // HITUNG NILAI PKS
    // ===============================
    const nilai_pks =
      biaya.biaya_hidup +
      biaya.biaya_pendidikan +
      biaya.biaya_buku +
      biaya.biaya_transportasi +
      biaya.biaya_sertifikasi_kompetensi;

    // ===============================
    // GENERATE ROWS PER TAHUN
    // ===============================
    const row = {
      id_trx_pks_referensi: id_pks_referensi,
      no_pks,
      tanggal_pks,
      tanggal_awal_pks,
      tanggal_akhir_pks,

      id_jenjang: idJenjang,
      jenjang: namaJenjang,
      tahun_angkatan: tahun, // langsung pakai string

      is_swakelola,

      id_lembaga_pendidikan: idLembagaPendidikan,
      lembaga_pendidikan: namaLembagaPendidikan,

      file_pks,
      jumlah_mahasiswa: totalMahasiswa || null,

      ...biaya,
      ...semesterFields,
      ...semesterPerMahasiswaFields,

      nilai_pks,
    };

    await TrxPks.create(row);

    return successResponse(res, "PKS berhasil ditambahkan");
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.deleteById = async (req, res) => {
  try {
    const { id } = req.params;

    // Menghapus data berdasarkan id
    await TrxPks.destroy({ where: { id } });

    return successResponse(res, "Data berhasil dihapus");
  } catch (error) {
    return errorResponse("Internal Server Error");
  }
};

exports.detailPksById = async (req, res) => {
  try {
    const { id_trx_pks } = req.params;

    const row = await TrxPks.findOne({
      where: { id: id_trx_pks },
    });

    if (!row) {
      return errorResponse(res, "Data PKS tidak ditemukan", 404);
    }

    const data = row.toJSON();

    data.file_pks = getFileUrl(req, "file_pks", data.file_pks);

    // Ambil jumlah mahasiswa berdasarkan status
    const total_mahasiswa_aktif = await TrxMahasiswa.count({
      where: { id_trx_pks, status: 1 },
    });

    const total_mahasiswa_tidak_aktif = await TrxMahasiswa.count({
      where: { id_trx_pks, status: 2 },
    });

    const total_mahasiswa = total_mahasiswa_aktif + total_mahasiswa_tidak_aktif;

    // Tambahkan ke data
    data.total_mahasiswa_aktif = total_mahasiswa_aktif;
    data.total_mahasiswa_tidak_aktif = total_mahasiswa_tidak_aktif;
    data.total_mahasiswa = total_mahasiswa;

    return successResponse(res, "Data berhasil dimuat", data);
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal server error", 500);
  }
};

exports.detailPksSwakelolaById = async (req, res) => {
  try {
    const { id_trx_pks } = req.params;

    const row = await TrxPks.findOne({
      where: { id: id_trx_pks },
    });

    if (!row) {
      return errorResponse(res, "Data PKS tidak ditemukan", 404);
    }

    const data = row.toJSON();

    data.file_pks = getFileUrl(req, "file_pks", data.file_pks);

    // Ambil jumlah mahasiswa berdasarkan status
    const total_mahasiswa_aktif = await TrxMahasiswa.count({
      where: { id_trx_pks, status: 1 },
    });

    const total_mahasiswa_tidak_aktif = await TrxMahasiswa.count({
      where: { id_trx_pks, status: 2 },
    });

    const total_mahasiswa = total_mahasiswa_aktif + total_mahasiswa_tidak_aktif;

    // Tambahkan ke data
    data.total_mahasiswa_aktif = total_mahasiswa_aktif;
    data.total_mahasiswa_tidak_aktif = total_mahasiswa_tidak_aktif;
    data.total_mahasiswa = total_mahasiswa;

    const pksSebelumnya = await TrxLogSwakelola.findAll({
      where: { id_trx_pks_baru: id_trx_pks },
      attributes: ["id_trx_pks_lama"],
    });

    data.pks_sebelumnya = pksSebelumnya.map((item) => item.id_trx_pks_lama);

    return successResponse(res, "Data berhasil dimuat", data);
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal server error", 500);
  }
};

exports.editPksById = async (req, res) => {
  try {
    const { id_trx_pks } = req.params;

    const existing = await TrxPks.findByPk(id_trx_pks);

    if (!existing) {
      return errorResponse(res, "Data PKS tidak ditemukan");
    }

    const {
      id_pks_referensi,
      no_pks,
      tanggal_pks,
      tanggal_awal_pks,
      tanggal_akhir_pks,
      lembaga_pendidikan,
      jenjang,
      is_swakelola,
      jumlah_mahasiswa,
      tahun,

      // biaya utama
      biaya_hidup,
      biaya_pendidikan,
      biaya_buku,
      biaya_transportasi,
      biaya_sertifikasi_kompetensi,

      // biaya turunan
      biaya_hidup_per_bulan,
      biaya_hidup_per_bulan_per_mahasiswa,

      biaya_buku_per_semester,
      biaya_buku_per_semester_per_mahasiswa,

      biaya_transportasi_per_tahap,
      biaya_transportasi_per_tahap_per_mahasiswa,

      biaya_sertifikasi_kompetensi_per_mahasiswa,
    } = req.body;

    // ===============================
    // PARSE JENJANG
    // ===============================
    const [idJenjang, namaJenjang] = safeSplit(jenjang);
    const [idLembagaPendidikan, namaLembagaPendidikan] =
      safeSplit(lembaga_pendidikan);

    const toNumber = (val) =>
      val !== undefined && val !== null && val !== "" ? Number(val) : 0;

    // ===============================
    // FILE (OPTIONAL)
    // ===============================
    let file_pks = existing.file_pks;

    if (req.file) {
      file_pks = req.file.filename;
    }

    // ===============================
    // KONVERSI BIAYA
    // ===============================
    const biaya = {
      biaya_hidup: toNumber(biaya_hidup),
      biaya_hidup_per_bulan: toNumber(biaya_hidup_per_bulan),
      biaya_hidup_per_bulan_per_mahasiswa: toNumber(
        biaya_hidup_per_bulan_per_mahasiswa,
      ),

      biaya_pendidikan: toNumber(biaya_pendidikan),

      biaya_buku: toNumber(biaya_buku),
      biaya_buku_per_semester: toNumber(biaya_buku_per_semester),
      biaya_buku_per_semester_per_mahasiswa: toNumber(
        biaya_buku_per_semester_per_mahasiswa,
      ),

      biaya_transportasi: toNumber(biaya_transportasi),
      biaya_transportasi_per_tahap: toNumber(biaya_transportasi_per_tahap),
      biaya_transportasi_per_tahap_per_mahasiswa: toNumber(
        biaya_transportasi_per_tahap_per_mahasiswa,
      ),

      biaya_sertifikasi_kompetensi: toNumber(biaya_sertifikasi_kompetensi),
      biaya_sertifikasi_kompetensi_per_mahasiswa: toNumber(
        biaya_sertifikasi_kompetensi_per_mahasiswa,
      ),
    };

    const totalMahasiswa = toNumber(jumlah_mahasiswa);

    // ===============================
    // HANDLE SEMESTER DINAMIS
    // ===============================
    const MAX_SEMESTER = 8;
    const semesterFields = {};
    const semesterPerMahasiswaFields = {};

    for (let i = 1; i <= MAX_SEMESTER; i++) {
      const key = `biaya_pendidikan_semester_${i}`;
      const keyPerMhs = `biaya_pendidikan_semester_${i}_per_mahasiswa`;

      semesterFields[key] =
        req.body[key] !== undefined ? toNumber(req.body[key]) : null;

      semesterPerMahasiswaFields[keyPerMhs] =
        req.body[keyPerMhs] !== undefined
          ? toNumber(req.body[keyPerMhs])
          : null;
    }

    // ===============================
    // HITUNG NILAI PKS
    // ===============================
    const nilai_pks =
      biaya.biaya_hidup +
      biaya.biaya_pendidikan +
      biaya.biaya_buku +
      biaya.biaya_transportasi +
      biaya.biaya_sertifikasi_kompetensi;

    // ===============================
    // FINAL ROW UPDATE
    // ===============================
    const updatedRow = {
      id_trx_pks_referensi: id_pks_referensi,
      no_pks,
      tanggal_pks,
      tanggal_awal_pks,
      tanggal_akhir_pks,

      id_jenjang: idJenjang,
      jenjang: namaJenjang,
      tahun_angkatan: tahun,

      is_swakelola,

      id_lembaga_pendidikan: idLembagaPendidikan,
      lembaga_pendidikan: namaLembagaPendidikan,

      file_pks,
      jumlah_mahasiswa: totalMahasiswa || null,

      ...biaya,
      ...semesterFields,
      ...semesterPerMahasiswaFields,

      nilai_pks,
    };

    await TrxPks.update(updatedRow, {
      where: { id: id_trx_pks },
    });

    return successResponse(res, "PKS berhasil diperbarui");
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.createSwakelola = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      id_pks_referensi,
      no_pks,
      tanggal_pks,
      tanggal_awal_pks,
      tanggal_akhir_pks,
      lembaga_pendidikan,
      jenjang,
      jumlah_mahasiswa,
      tahun,
      // biaya utama
      biaya_hidup,
      biaya_pendidikan,
      biaya_buku,
      biaya_transportasi,
      biaya_sertifikasi_kompetensi,
      // biaya turunan
      biaya_hidup_per_bulan,
      biaya_hidup_per_bulan_per_mahasiswa,
      biaya_buku_per_semester,
      biaya_buku_per_semester_per_mahasiswa,
      biaya_transportasi_per_tahap,
      biaya_transportasi_per_tahap_per_mahasiswa,
      biaya_sertifikasi_kompetensi_per_mahasiswa,
    } = req.body;

    // ===============================
    // PARSE JENJANG & LEMBAGA
    // ===============================
    const [idJenjang, namaJenjang] = safeSplit(jenjang);
    const [idLembagaPendidikan, namaLembagaPendidikan] =
      safeSplit(lembaga_pendidikan);

    if (!tahun || typeof tahun !== "string") {
      return errorResponse(res, "Tahun wajib diisi");
    }

    const file_pks = req.file?.filename ?? null;
    const toNumber = (val) =>
      val !== undefined && val !== null && val !== "" ? Number(val) : 0;

    const biaya = {
      biaya_hidup: toNumber(biaya_hidup),
      biaya_hidup_per_bulan: toNumber(biaya_hidup_per_bulan),
      biaya_hidup_per_bulan_per_mahasiswa: toNumber(
        biaya_hidup_per_bulan_per_mahasiswa,
      ),
      biaya_pendidikan: toNumber(biaya_pendidikan),
      biaya_buku: toNumber(biaya_buku),
      biaya_buku_per_semester: toNumber(biaya_buku_per_semester),
      biaya_buku_per_semester_per_mahasiswa: toNumber(
        biaya_buku_per_semester_per_mahasiswa,
      ),
      biaya_transportasi: toNumber(biaya_transportasi),
      biaya_transportasi_per_tahap: toNumber(biaya_transportasi_per_tahap),
      biaya_transportasi_per_tahap_per_mahasiswa: toNumber(
        biaya_transportasi_per_tahap_per_mahasiswa,
      ),
      biaya_sertifikasi_kompetensi: toNumber(biaya_sertifikasi_kompetensi),
      biaya_sertifikasi_kompetensi_per_mahasiswa: toNumber(
        biaya_sertifikasi_kompetensi_per_mahasiswa,
      ),
    };

    const totalMahasiswa = toNumber(jumlah_mahasiswa);

    // ===============================
    // HANDLE SEMESTER DINAMIS (1–8)
    // ===============================
    const MAX_SEMESTER = 8;

    const semesterFields = {};
    const semesterPerMahasiswaFields = {};

    for (let i = 1; i <= MAX_SEMESTER; i++) {
      const key = `biaya_pendidikan_semester_${i}`;
      const keyPerMhs = `biaya_pendidikan_semester_${i}_per_mahasiswa`;

      semesterFields[key] =
        req.body[key] !== undefined ? toNumber(req.body[key]) : null;

      semesterPerMahasiswaFields[keyPerMhs] =
        req.body[keyPerMhs] !== undefined
          ? toNumber(req.body[keyPerMhs])
          : null;
    }

    // ===============================
    // HITUNG NILAI PKS
    // ===============================
    const nilai_pks =
      biaya.biaya_hidup +
      biaya.biaya_pendidikan +
      biaya.biaya_buku +
      biaya.biaya_transportasi +
      biaya.biaya_sertifikasi_kompetensi;

    // ===============================
    // GENERATE ROW PKS
    // ===============================
    const row = {
      id_trx_pks_referensi: id_pks_referensi,
      no_pks,
      tanggal_pks,
      tanggal_awal_pks,
      tanggal_akhir_pks,
      id_jenjang: idJenjang,
      jenjang: namaJenjang,
      tahun_angkatan: tahun,
      is_swakelola: 1,
      id_lembaga_pendidikan: idLembagaPendidikan,
      lembaga_pendidikan: namaLembagaPendidikan,
      file_pks,
      jumlah_mahasiswa: totalMahasiswa || null,
      ...biaya,
      ...semesterFields,
      ...semesterPerMahasiswaFields,
      nilai_pks,
      is_swakelola: "Y",
    };

    const newPks = await TrxPks.create(row, { transaction });

    // ===============================
    // HANDLE MAHASISWA DARI PKS SEBELUMNYA
    // ===============================
    let pks_sebelumnya = [];
    if (req.body.pks_sebelumnya) {
      try {
        pks_sebelumnya = JSON.parse(req.body.pks_sebelumnya);
        if (!Array.isArray(pks_sebelumnya)) pks_sebelumnya = [];
      } catch (err) {
        pks_sebelumnya = [];
      }
    }

    if (Array.isArray(pks_sebelumnya) && pks_sebelumnya.length > 0) {
      for (const oldPksId of pks_sebelumnya) {
        // Ambil mahasiswa terkait PKS lama
        const mahasiswaList = await TrxMahasiswa.findAll({
          where: { id_trx_pks: oldPksId },
        });

        await TrxLogSwakelola.create({
          id_trx_pks_lama: oldPksId,
          id_trx_pks_baru: newPks.id,
        });

        for (const mhs of mahasiswaList) {
          // Insert ke log
          await TrxMahasiswaLogSwakelola.create(
            {
              id_trx_pks_lama: oldPksId,
              id_trx_pks_baru: newPks.id,
              no_pks_lama: mhs.no_pks,
              no_pks_baru: newPks.no_pks,
              status: 1,
              status2: "UPDATE SWAKELOLA",
              nik: mhs.nik,
              nim: mhs.nim,
              nama: mhs.nama,
              jenis_kelamin: mhs.jenis_kelamin,
              asal_kota: mhs.asal_kota,
              asal_provinsi: mhs.asal_provinsi,
              kode_pro: mhs.kode_pro,
              kode_kab: mhs.kode_kab,
              angkatan: mhs.angkatan,
              no_rekening: mhs.no_rekening,
              nama_rekening: mhs.nama_rekening,
              bank: mhs.bank,
              kode_bank: mhs.kode_bank,
              file_scan_buku_tabungan: mhs.file_scan_buku_tabungan,
              email: mhs.email,
              hp: mhs.hp,
              id_kluster: mhs.id_kluster,
              kluster: mhs.kluster,
              id_alasan_tidak_aktif: mhs.id_alasan_tidak_aktif,
              alasan_tidak_aktif: mhs.alasan_tidak_aktif,
              keterangan_tidak_aktif: mhs.keterangan_tidak_aktif,
              file_pendukung: mhs.file_pendukung,
              has_perubahan_rekening: mhs.has_perubahan_rekening,
              has_perubahan_status_aktif: mhs.has_perubahan_status_aktif,
              has_perubahan_ipk: mhs.has_perubahan_ipk,
              kodefikasi: mhs.kodefikasi,
            },
            { transaction },
          );

          // Update PKS baru di TrxMahasiswa
          await mhs.update(
            { id_trx_pks: newPks.id, no_pks: newPks.no_pks },
            { transaction },
          );
        }
      }
    }

    await transaction.commit();
    return successResponse(res, "PKS Swakelola berhasil ditambahkan");
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.editPksSwakelolaById = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id_trx_pks } = req.params;

    const existingPks = await TrxPks.findByPk(id_trx_pks, { transaction });
    if (!existingPks) {
      await transaction.rollback();
      return errorResponse(res, "PKS tidak ditemukan");
    }

    const {
      id_pks_referensi,
      no_pks,
      tanggal_pks,
      tanggal_awal_pks,
      tanggal_akhir_pks,
      lembaga_pendidikan,
      jenjang,
      jumlah_mahasiswa,
      tahun,

      biaya_hidup,
      biaya_pendidikan,
      biaya_buku,
      biaya_transportasi,
      biaya_sertifikasi_kompetensi,

      biaya_hidup_per_bulan,
      biaya_hidup_per_bulan_per_mahasiswa,
      biaya_buku_per_semester,
      biaya_buku_per_semester_per_mahasiswa,
      biaya_transportasi_per_tahap,
      biaya_transportasi_per_tahap_per_mahasiswa,
      biaya_sertifikasi_kompetensi_per_mahasiswa,
    } = req.body;

    const [idJenjang, namaJenjang] = safeSplit(jenjang);
    const [idLembagaPendidikan, namaLembagaPendidikan] =
      safeSplit(lembaga_pendidikan);

    const toNumber = (val) =>
      val !== undefined && val !== null && val !== "" ? Number(val) : 0;

    const biaya = {
      biaya_hidup: toNumber(biaya_hidup),
      biaya_hidup_per_bulan: toNumber(biaya_hidup_per_bulan),
      biaya_hidup_per_bulan_per_mahasiswa: toNumber(
        biaya_hidup_per_bulan_per_mahasiswa,
      ),
      biaya_pendidikan: toNumber(biaya_pendidikan),
      biaya_buku: toNumber(biaya_buku),
      biaya_buku_per_semester: toNumber(biaya_buku_per_semester),
      biaya_buku_per_semester_per_mahasiswa: toNumber(
        biaya_buku_per_semester_per_mahasiswa,
      ),
      biaya_transportasi: toNumber(biaya_transportasi),
      biaya_transportasi_per_tahap: toNumber(biaya_transportasi_per_tahap),
      biaya_transportasi_per_tahap_per_mahasiswa: toNumber(
        biaya_transportasi_per_tahap_per_mahasiswa,
      ),
      biaya_sertifikasi_kompetensi: toNumber(biaya_sertifikasi_kompetensi),
      biaya_sertifikasi_kompetensi_per_mahasiswa: toNumber(
        biaya_sertifikasi_kompetensi_per_mahasiswa,
      ),
    };

    const nilai_pks =
      biaya.biaya_hidup +
      biaya.biaya_pendidikan +
      biaya.biaya_buku +
      biaya.biaya_transportasi +
      biaya.biaya_sertifikasi_kompetensi;

    // ===============================
    // UPDATE DATA PKS
    // ===============================
    await existingPks.update(
      {
        id_trx_pks_referensi: id_pks_referensi,
        no_pks,
        tanggal_pks,
        tanggal_awal_pks,
        tanggal_akhir_pks,
        id_jenjang: idJenjang,
        jenjang: namaJenjang,
        tahun_angkatan: tahun,
        id_lembaga_pendidikan: idLembagaPendidikan,
        lembaga_pendidikan: namaLembagaPendidikan,
        jumlah_mahasiswa: toNumber(jumlah_mahasiswa) || null,
        ...biaya,
        nilai_pks,
        is_swakelola: "Y",
      },
      { transaction },
    );

    // ===============================
    // HANDLE PKS SEBELUMNYA
    // ===============================
    let pks_sebelumnya = [];

    if (req.body.pks_sebelumnya) {
      try {
        pks_sebelumnya = JSON.parse(req.body.pks_sebelumnya);
        if (!Array.isArray(pks_sebelumnya)) pks_sebelumnya = [];
      } catch {
        pks_sebelumnya = [];
      }
    }

    if (Array.isArray(pks_sebelumnya) && pks_sebelumnya.length > 0) {
      await TrxLogSwakelola.destroy({
        where: {
          id_trx_pks_baru: id_trx_pks,
        },
      });

      for (const oldPksId of pks_sebelumnya) {
        const mahasiswaList = await TrxMahasiswa.findAll({
          where: { id_trx_pks: oldPksId },
          transaction,
        });

        await TrxLogSwakelola.create({
          id_trx_pks_lama: oldPksId,
          id_trx_pks_baru: id_trx_pks,
        });

        for (const mhs of mahasiswaList) {
          // Cek apakah sudah pernah dilog
          const alreadyLogged = await TrxMahasiswaLogSwakelola.findOne({
            where: {
              id_trx_pks_lama: oldPksId,
              id_trx_pks_baru: id_trx_pks,
              nik: mhs.nik,
            },
            transaction,
          });

          if (!alreadyLogged) {
            await TrxMahasiswaLogSwakelola.create(
              {
                id_trx_pks_lama: oldPksId,
                id_trx_pks_baru: id_trx_pks,
                no_pks_lama: mhs.no_pks,
                no_pks_baru: no_pks,
                status: 1,
                status2: "UPDATE SWAKELOLA",
                nik: mhs.nik,
                nim: mhs.nim,
                nama: mhs.nama,
              },
              { transaction },
            );
          }

          await mhs.update(
            { id_trx_pks: id_trx_pks, no_pks: no_pks },
            { transaction },
          );
        }
      }
    }

    await transaction.commit();
    return successResponse(res, "PKS Swakelola berhasil diperbarui");
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

// Mengambil mahasiswa yang punya id trx pks tertentu
exports.getMahasiswaByIdPksAndPagination = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    const { id_trx_pks } = req.params;

    const baseCondition = { id_trx_pks };

    const whereCondition = search
      ? {
          ...baseCondition,
          [Op.or]: [
            { nik: { [Op.like]: `%${search}%` } },
            { nim: { [Op.like]: `%${search}%` } },
            { nama: { [Op.like]: `%${search}%` } },
          ],
        }
      : baseCondition;

    const { count, rows } = await TrxMahasiswa.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      order: [["id", "ASC"]],
    });

    // ✅ FORMAT file_pendukung
    const formattedRows = rows.map((item) => {
      const data = item.toJSON();

      return {
        ...data,
        file_pendukung: data.file_pendukung
          ? getFileUrl(req, "file_pendukung", data.file_pendukung)
          : null,
        file_scan_buku_tabungan: data.file_scan_buku_tabungan
          ? getFileUrl(req, "scan_buku_tabungan", data.file_scan_buku_tabungan)
          : null,
      };
    });

    return successResponse(res, "Data berhasil dimuat", {
      result: formattedRows,
      total: count,
      current_page: page,
      total_pages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal server error");
  }
};

exports.updateStatusAktifMahasiswa = async (req, res) => {
  try {
    const { id_trx_mahasiswa } = req.params;
    const { is_active, alasan_tidak_aktif, keterangan_tidak_aktif } = req.body;

    // Ambil data lama
    const existingMahasiswa = await TrxMahasiswa.findByPk(id_trx_mahasiswa);

    if (!existingMahasiswa) {
      return errorResponse(res, "Data Mahasiswa tidak ditemukan", 404);
    }

    let updateData = {
      status: is_active,
    };

    if (String(is_active) === "0") {
      // ❗ Jika tidak aktif → alasan & file WAJIB
      if (!alasan_tidak_aktif) {
        return errorResponse(res, "Alasan tidak aktif wajib diisi", 400);
      }

      if (!req.file) {
        return errorResponse(res, "File pendukung wajib diupload", 400);
      }

      const [idAlasanTidakAktif, alasanTidakAktif] =
        safeSplit(alasan_tidak_aktif);

      updateData.id_alasan_tidak_aktif = idAlasanTidakAktif;
      updateData.alasan_tidak_aktif = alasanTidakAktif;
      updateData.keterangan_tidak_aktif = keterangan_tidak_aktif;
      updateData.file_pendukung = req.file.filename;
    } else {
      // ✅ Jika aktif → NULL kan
      updateData.id_alasan_tidak_aktif = null;
      updateData.alasan_tidak_aktif = null;
      updateData.keterangan_tidak_aktif = null;
      updateData.file_pendukung = null;
    }

    await existingMahasiswa.update(updateData);

    return successResponse(res, "Status Mahasiswa berhasil diperbarui");
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.importExcelMahasiswa = async (req, res) => {
  try {
    const { id_trx_pks } = req.params;

    if (!req.file) {
      return errorResponse(res, "File Excel tidak ditemukan");
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const worksheet = workbook.getWorksheet("Data Mahasiswa");
    if (!worksheet) {
      return errorResponse(res, "Sheet 'Data Mahasiswa' tidak ditemukan");
    }

    let successCount = 0;
    let failedCount = 0;
    const errors = [];

    const previewData = [];

    // mulai baris ke-2 (baris 1 header)
    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);

      // skip jika NIM kosong
      if (!row.getCell(4).value) continue;

      const statusText = row.getCell(2).value?.toString().trim();
      const nik = getCellString(row.getCell(3));
      const nim = getCellString(row.getCell(4));
      const nama = getCellString(row.getCell(5));
      const jenisKelamin = getCellString(row.getCell(6));
      const asalKota = row.getCell(7).value?.toString().trim();
      const asalProvinsi = row.getCell(8).value?.toString().trim();
      const angkatan = row.getCell(9).value;
      const noRekening = row.getCell(10).value?.toString().trim();
      const namaRekening = row.getCell(11).value?.toString().trim();
      const bank = row.getCell(12).value?.toString().trim();
      const email = getCellString(row.getCell(13));
      const hp = getCellString(row.getCell(14));
      const klusterText = row.getCell(15).value?.toString().trim();
      const alasanTidakAktif = row.getCell(16).value?.toString().trim() || null;

      /** =====================
       * VALIDASI STATUS
       ===================== */
      let status;
      if (statusText === "Aktif") status = 1;
      else if (statusText === "Non Aktif") status = 0;
      else {
        failedCount++;
        errors.push({
          row: i,
          nim,
          message: 'Status harus diisi "Aktif" atau "Non Aktif"',
        });
        continue;
      }

      /** =====================
       * VALIDASI KLUSTER
       ===================== */
      let idKluster;
      let kluster;

      if (klusterText === "Reguler") {
        idKluster = 1;
        kluster = "Reguler";
      } else if (klusterText === "Afirmasi") {
        idKluster = 2;
        kluster = "Afirmasi";
      } else {
        failedCount++;
        errors.push({
          row: i,
          nim,
          message: 'Kluster harus diisi "Reguler" atau "Afirmasi"',
        });
        continue;
      }

      try {
        /** =====================
         * CEK DUPLIKAT NIM
         ===================== */
        const existing = await TrxMahasiswa.findOne({
          where: { nim },
        });

        if (existing) {
          failedCount++;
          errors.push({
            row: i,
            nim,
            message: "NIM sudah terdaftar",
          });
          continue;
        }

        /** =====================
         * INSERT DATA
         ===================== */
        await TrxMahasiswa.create({
          id_trx_pks,
          status,
          nik,
          nim,
          nama,
          asal_kota: asalKota,
          asal_provinsi: asalProvinsi,
          angkatan,
          no_rekening: noRekening,
          nama_rekening: namaRekening,
          bank,
          email,
          hp,
          id_kluster: idKluster,
          kluster,
          alasan_tidak_aktif: status === 0 ? alasanTidakAktif : null,
          jenis_kelamin: jenisKelamin,
        });

        successCount++;
      } catch (err) {
        failedCount++;
        errors.push({
          row: i,
          nim,
          message: err.message,
        });
      }
    }

    return successResponse(res, "Upload Excel Mahasiswa selesai", {
      successCount,
      failedCount,
      errors,
    });
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Gagal mengupload Excel Mahasiswa");
  }
};

exports.getStatistikMahasiswa = async (req, res) => {
  try {
    const id_trx_pks = req.query.pks;
    if (!id_trx_pks) {
      return errorResponse(res, "PKS wajib diisi");
    }

    const statistik = await TrxMahasiswa.findOne({
      attributes: [
        [fn("COUNT", col("id")), "total_mahasiswa"],
        [
          fn("SUM", literal("CASE WHEN status = 1 THEN 1 ELSE 0 END")),
          "total_mahasiswa_aktif",
        ],
        [
          fn("SUM", literal("CASE WHEN status = 0 THEN 1 ELSE 0 END")),
          "total_mahasiswa_tidak_aktif",
        ],
      ],
      where: {
        id_trx_pks,
      },
      raw: true,
    });

    return successResponse(res, "Data berhasil dimuat", {
      total_mahasiswa: Number(statistik.total_mahasiswa),
      total_mahasiswa_aktif: Number(statistik.total_mahasiswa_aktif),
      total_mahasiswa_tidak_aktif: Number(
        statistik.total_mahasiswa_tidak_aktif,
      ),
    });
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal server error");
  }
};

exports.lockData = async (req, res) => {
  try {
    const {
      id_trx_pks,
      bulan,
      tahun,
      jumlah_nominal,
      total_mahasiswa,
      total_mahasiswa_aktif,
      total_mahasiswa_tidak_aktif,
    } = req.body;

    const exist = await TrxBiayaHidupPks.findOne({
      where: {
        id_trx_pks,
        bulan,
        tahun,
      },
    });

    if (exist) {
      return errorResponse(
        res,
        `Biaya Hidup bulan ${bulan} tahun ${tahun} sudah ada`,
        400,
      );
    }

    await TrxBiayaHidupPks.create({
      id_trx_pks,
      bulan,
      jumlah: jumlah_nominal,
      tahun,
      total_mahasiswa,
      total_mahasiswa_aktif,
      total_mahasiswa_tidak_aktif,
      last_update_lp: new Date(),
      id_status: 1,
      status: "Verifikasi Lembaga Pendidikan",
    });

    return successResponse(res, "Data berhasil di-update");
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error", 500);
  }
};

exports.getLockData = async (req, res) => {
  try {
    const { id_trx_pks, bulan, tahun } = req.body;

    const exist = await TrxBiayaHidupPks.findOne({
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

exports.updateDataMahasiswa = async (req, res) => {
  try {
    const { id_trx_mahasiswa } = req.params;

    const {
      nik,
      nim,
      nama,
      jenis_kelamin,
      asal_kota,
      asal_provinsi,
      angkatan,
      email,
      hp,
      bank,
      no_rekening,
      nama_rekening,
      kluster,
    } = req.body;

    let filename;

    if (req.file) {
      filename = req.file.filename;
    }

    // Ambil data lama
    const existingMahasiswa = await TrxMahasiswa.findByPk(id_trx_mahasiswa);

    if (!existingMahasiswa) {
      return errorResponse(res, "Data Mahasiswa tidak ditemukan", 404);
    }

    let updateData = {};

    if (nik !== undefined) updateData.nik = nik;
    if (nim !== undefined) updateData.nim = nim;
    if (nama !== undefined) updateData.nama = nama;
    if (jenis_kelamin !== undefined) updateData.jenis_kelamin = jenis_kelamin;
    if (asal_kota !== undefined) {
      const [kodeKota, namaKota] = safeSplit(asal_kota);
      updateData.kode_kab = kodeKota;
      updateData.asal_kota = namaKota;
    }
    if (asal_provinsi !== undefined) {
      const [kodeProvinsi, namaProvinsi] = safeSplit(asal_provinsi);
      updateData.kode_pro = kodeProvinsi;
      updateData.asal_provinsi = namaProvinsi;
    }
    if (angkatan !== undefined) updateData.angkatan = angkatan;
    if (email !== undefined) updateData.email = email;
    if (hp !== undefined) updateData.hp = hp;
    if (bank !== undefined) updateData.bank = bank;
    if (no_rekening !== undefined) updateData.no_rekening = no_rekening;
    if (nama_rekening !== undefined) updateData.nama_rekening = nama_rekening;

    if (filename !== undefined) {
      updateData.file_scan_buku_tabungan = filename;
    }

    // 🔹 Parsing kluster
    if (kluster !== undefined) {
      const [idKluster, namaKluster] = safeSplit(kluster);

      if (!idKluster || !namaKluster) {
        return errorResponse(res, "Format kluster tidak valid", 400);
      }

      updateData.id_kluster = idKluster;
      updateData.kluster = namaKluster;
    }

    // Tidak ada data yang diupdate
    if (Object.keys(updateData).length === 0) {
      return errorResponse(res, "Tidak ada data yang diupdate", 400);
    }

    await existingMahasiswa.update(updateData);

    return successResponse(res, "Data Mahasiswa berhasil diperbarui");
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.updateNimMahasiswa = async (req, res) => {
  try {
    const { id_trx_mahasiswa } = req.params;

    const { nim } = req.body;

    // Ambil data lama
    const existingMahasiswa = await TrxMahasiswa.findByPk(id_trx_mahasiswa);

    if (!existingMahasiswa) {
      return errorResponse(res, "Data Mahasiswa tidak ditemukan", 404);
    }

    let updateData = {};

    if (nim !== undefined) updateData.nim = nim;

    await existingMahasiswa.update(updateData);

    return successResponse(res, "Data Mahasiswa berhasil diperbarui");
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.exportMahasiswaByPks = async (req, res) => {
  try {
    const { id_trx_pks } = req.body;

    if (!id_trx_pks) {
      return res.status(400).json({
        success: false,
        message: "id_trx_pks wajib diisi",
      });
    }

    const data = await TrxMahasiswa.findAll({
      where: { id_trx_pks },
      order: [["id", "ASC"]],
    });

    if (data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Data tidak ditemukan",
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data Mahasiswa");

    worksheet.columns = [
      { header: "No", key: "no", width: 10 },
      { header: "NIK", key: "nik", width: 30 },
      { header: "Nama", key: "nama", width: 30 },
      { header: "Jenis Kelamin", key: "jenis_kelamin", width: 10 },
      { header: "Kluster", key: "kluster", width: 20 },
      { header: "Bank", key: "bank", width: 25 },
      { header: "No Rekening", key: "no_rekening", width: 25 },
      { header: "Status", key: "status", width: 25 },
    ];

    worksheet.getRow(1).font = { bold: true };

    data.forEach((item, index) => {
      worksheet.addRow({
        no: index + 1,
        nik: item.nik,
        nama: item.nama,
        jenis_kelamin: item.jenis_kelamin,
        kluster: item.kluster,
        bank: item.bank + " - " + item.kode_bank,
        no_rekening: item.no_rekening,
        status: item.status === 1 ? "Aktif" : "Tidak Aktif",
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    res.setHeader("Content-Disposition", `attachment; filename=Mahasiswa.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Gagal export excel",
    });
  }
};

exports.hasPerubahanDataMahasiswa = async (req, res) => {
  try {
    const { id_trx_pks } = req.params;

    const count = await TrxMahasiswa.count({
      where: {
        id_trx_pks,
        [Op.or]: [
          { has_perubahan_rekening: 1 },
          { has_perubahan_status_aktif: 1 },
          { has_perubahan_ipk: 1 },
        ],
      },
    });

    const result = count > 0 ? "Y" : "N";

    return successResponse(res, "Data berhasil dimuat", result);
  } catch (error) {
    return errorResponse(res, "Internal server error", 500);
  }
};

exports.getPerubahanDataMahasiswa = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    // ✅ WHERE untuk Mahasiswa
    const whereMahasiswa = {};

    const jenisPerubahan = req.query.jenisPerubahan;

    if (jenisPerubahan) {
      if (jenisPerubahan === "status_aktif") {
        whereMahasiswa.has_perubahan_status_aktif = 1;
      }

      if (jenisPerubahan === "rekening") {
        whereMahasiswa.has_perubahan_rekening = 1;
      }

      if (jenisPerubahan === "ipk") {
        whereMahasiswa.has_perubahan_ipk = 1;
      }
    } else {
      // default: semua jenis perubahan
      whereMahasiswa[Op.or] = [
        { has_perubahan_rekening: 1 },
        { has_perubahan_status_aktif: 1 },
        { has_perubahan_ipk: 1 },
      ];
    }
    if (search) {
      whereMahasiswa[Op.and] = [
        {
          [Op.or]: [
            { nik: { [Op.like]: `%${search}%` } },
            { nim: { [Op.like]: `%${search}%` } },
            { nama: { [Op.like]: `%${search}%` } },
          ],
        },
      ];
    }

    // ✅ WHERE untuk PKS
    const wherePks = {};

    if (req.query.lpId) {
      wherePks.id_lembaga_pendidikan = req.query.lpId;
    }

    if (req.query.jenjang) {
      wherePks.jenjang = req.query.jenjang;
    }

    if (req.query.tahun) {
      wherePks.tahun_angkatan = req.query.tahun;
    }

    const { count, rows } = await TrxMahasiswa.findAndCountAll({
      where: whereMahasiswa,
      limit,
      offset,
      order: [["id", "ASC"]],
      include: [
        {
          model: TrxPks,
          attributes: ["lembaga_pendidikan", "jenjang", "tahun_angkatan"],
          where: Object.keys(wherePks).length ? wherePks : undefined,
          required: Object.keys(wherePks).length > 0, // penting 🔥
        },
      ],
    });

    const formattedRows = rows.map((item) => {
      const data = item.toJSON();

      return {
        ...data,
        lembaga_pendidikan: data.TrxPk?.lembaga_pendidikan || null,
        jenjang: data.TrxPk?.jenjang || null,
        tahun_angkatan: data.TrxPk?.tahun_angkatan || null,
        file_pendukung: data.file_pendukung
          ? getFileUrl(req, "file_pendukung", data.file_pendukung)
          : null,
        file_scan_buku_tabungan: data.file_scan_buku_tabungan
          ? getFileUrl(req, "scan_buku_tabungan", data.file_scan_buku_tabungan)
          : null,
      };
    });

    return successResponse(res, "Data berhasil dimuat", {
      result: formattedRows,
      total: count,
      current_page: page,
      total_pages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal server error");
  }
};

const normalizeJenjang = (id_jenjang) => {
  if (Array.isArray(id_jenjang)) return id_jenjang.map(Number);

  if (typeof id_jenjang === "string") {
    return id_jenjang
      .split(",")
      .map((v) => Number(v))
      .filter(Boolean);
  }

  if (typeof id_jenjang === "number") {
    return [id_jenjang];
  }

  return [];
};
