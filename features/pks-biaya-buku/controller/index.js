const { col, Op } = require("sequelize");
const {
  successResponse,
  errorResponse,
  failResponse,
} = require("../../../common/response");
const {
  TrxBiayaBukuPks,
  TrxPks,
  LogPengajuan,
  TrxMahasiswa,
  TrxBatchBiayaBukuPks,
  TrxBiayaBuku,
} = require("../../../models");
const { getFileUrl } = require("../../../common/middleware/upload_middleware");

const puppeteer = require("puppeteer");
const {
  formatRupiah,
  parseBatchCode,
  parseBatchCodeBiayaBuku,
  terbilang,
  generateBatchCodeBiayaBuku,
} = require("../../../utils/stringFormatter");
const {
  formatTanggalIndo,
  currentMonth,
} = require("../../../utils/dateFormatter");
const { insertLogPengajuan } = require("../../../helpers/log_pengajuan");
const { default: axios } = require("axios");
const {
  getKepanjanganJenjang,
  getJumlahSemester,
} = require("../../../data/jenjangKuliah");
const { sequelize } = require("../../../core/db_config");

exports.getAllData = async (req, res) => {
  try {
    const { idTrxPks } = req.params;

    const biayaBuku = await TrxBiayaBukuPks.findAll({
      where: { id_trx_pks: idTrxPks },
      order: [["id", "ASC"]],
    });

    return successResponse(res, "Data berhasil dimuat", biayaBuku);
  } catch (error) {
    return errorResponse(res, "Internal Server Error");
  }
};

exports.create = async (req, res) => {
  try {
    const { id_trx_pks, semester, tahun, jumlah } = req.body;

    // validasi wajib
    if (!id_trx_pks || !semester || jumlah == null) {
      return failResponse(res, "Data tidak lengkap", 400);
    }

    // 🔴 CEK SEMESTER GANDA
    const exist = await TrxBiayaBukuPks.findOne({
      where: {
        id_trx_pks,
        semester,
        tahun,
      },
    });

    if (exist) {
      return errorResponse(
        res,
        `Biaya Buku semester ${semester} tahun ${tahun} sudah ada`,
        400,
      );
    }

    await TrxBiayaBukuPks.create({
      id_trx_pks,
      semester,
      jumlah,
      tahun,
    });

    return successResponse(res, "Data berhasil ditambahkan");
  } catch (error) {
    return errorResponse(res, "Internal Server Error", 500);
  }
};

exports.deleteById = async (req, res) => {
  try {
    const { id_biaya_buku } = req.params;

    const deleted = await TrxBiayaBukuPks.destroy({
      where: {
        id: id_biaya_buku,
      },
    });

    await TrxBiayaBuku.destroy({
      where: {
        id_trx_biaya_buku_pks: id_biaya_buku,
      },
    });

    const aksiLog = `${req.user.nama} menghapus pengajuan biaya buku`;

    await insertLogPengajuan({
      id_pengajuan: id_biaya_buku,
      section: "biaya_buku",
      aksi: aksiLog,
    });

    if (!deleted) {
      return errorResponse(res, "Data tidak ditemukan", 404);
    }

    return successResponse(res, "Data berhasil dihapus");
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error", 500);
  }
};

exports.getByPagination = async (req, res) => {
  try {
    const { id_lembaga_pendidikan, role } = req.user;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    let biayaWhere = search
      ? {
          [Op.or]: [{ nama: { [Op.like]: `%${search}%` } }],
        }
      : {};

    let pksWhere = {};
    if (role.includes(8) || role.includes(9)) {
      pksWhere.id_lembaga_pendidikan = id_lembaga_pendidikan;
    }

    const { count, rows } = await TrxBiayaBukuPks.findAndCountAll({
      where: biayaWhere,
      include: [
        {
          model: TrxPks,
          attributes: [],
          where: pksWhere,
          required: true,
        },
      ],
      attributes: [
        "id",
        "id_trx_pks",
        "semester",
        "tahun",
        "jumlah",
        "total_mahasiswa",
        "total_mahasiswa_aktif",
        "total_mahasiswa_tidak_aktif",
        "id_status",
        "status",
        "id_sub_status",
        "sub_status",
        "status_transfer",
        "last_update_lp",
        "verify_by_lp",
        "file_daftar_nominatif",
        "file_surat_penagihan",
        "file_pernyataan_keaktifan_mahasiswa",
        "catatan_verifikator",
        "diajukan_ke_verifikator_at",
        "diajukan_ke_verifikator_by",
        "diverifikasi_ppk_at",
        "diverifikasi_ppk_by",
        "diverifikasi_bendahara_at",
        "diverifikasi_bendahara_by",
        [col("TrxPk.no_pks"), "no_pks"],
        [col("TrxPk.lembaga_pendidikan"), "lembaga_pendidikan"],
        [col("TrxPk.tanggal_pks"), "tanggal_pks"],
        [col("TrxPk.jenjang"), "jenjang"],
        [col("TrxPk.biaya_buku"), "biaya_buku"],
      ],
      raw: true,
      limit,
      offset,
      order: [["id", "ASC"]],
    });

    const mappedRows = rows.map((item) => ({
      ...item,
      file_daftar_nominatif: getFileUrl(
        req,
        "verifikasi_pengajuan_biaya_buku",
        item.file_daftar_nominatif,
      ),
      file_surat_penagihan: getFileUrl(
        req,
        "verifikasi_pengajuan_biaya_buku",
        item.file_surat_penagihan,
      ),
      file_pernyataan_keaktifan_mahasiswa: getFileUrl(
        req,
        "verifikasi_pengajuan_biaya_buku",
        item.file_pernyataan_keaktifan_mahasiswa,
      ),
    }));

    return successResponse(res, "Data berhasil dimuat", {
      result: mappedRows,
      total: count,
      current_page: page,
      total_pages: Math.ceil(count / limit),
    });
  } catch (error) {
    return errorResponse("Internal Server Error");
  }
};

exports.ajukanKeBpdp = async (req, res) => {
  try {
    const { id_biaya_buku } = req.params;
    const { verifikasi, catatan_revisi } = req.body;

    const trx = await TrxBiayaBukuPks.findOne({
      where: { id: id_biaya_buku },
      attributes: ["id"], // PK tabel ini
    });

    if (!trx) {
      return errorResponse(res, "Data tidak ditemukan", 404);
    }

    let id_status;
    let status;
    let catatanVerifikator = null;
    let id_sub_status;
    let sub_status;
    let aksiLog;

    if (verifikasi === "setuju") {
      id_status = 2;
      status = "Verifikasi BPDP";
      id_sub_status = 1;
      sub_status = "Staff Divisi Beasiswa";

      aksiLog = `${req.user.nama} meneruskan pengajuan ke BPDP (Staff Beasiswa)`;
    } else {
      id_status = 3;
      status = "Revisi Lembaga Pendidikan";
      catatanVerifikator = catatan_revisi;

      aksiLog = `${req.user.nama} mengembalikan pengajuan untuk revisi`;
    }

    await TrxBiayaBukuPks.update(
      {
        id_status,
        status,
        id_sub_status,
        sub_status,
        catatan_verifikator: catatanVerifikator,
        verify_by_lp: new Date(),
      },
      {
        where: { id: id_biaya_buku },
      },
    );

    await TrxBiayaBuku.update(
      {
        status_disetujui: "Dalam Proses BPDP",
      },
      {
        where: { id_trx_biaya_buku_pks: id_biaya_buku },
      },
    );

    await insertLogPengajuan({
      id_pengajuan: trx.id,
      section: "biaya_buku",
      aksi: aksiLog,
      catatan: catatanVerifikator,
    });

    return successResponse(res, "Data berhasil di-update");
  } catch (error) {
    return errorResponse(res, "Internal Server Error", 500);
  }
};

exports.ajukanKeVerifikator = async (req, res) => {
  try {
    const {
      id_trx_pks,
      semester,
      tahun,
      jumlah_nominal,
      total_mahasiswa,
      total_mahasiswa_aktif,
      total_mahasiswa_tidak_aktif,
      status_verifikasi,
    } = req.body;

    const { daftar_nominatif } = req.files || {};

    // 🔎 Cek data existing
    const exist = await TrxBiayaBukuPks.findOne({
      where: { id_trx_pks, semester, tahun },
    });

    /**
     * =========================
     * 🔁 MODE REVISI (UPDATE)
     * =========================
     */
    if (status_verifikasi === "hasil_perbaikan") {
      if (!exist) {
        return errorResponse(res, "Data tidak ditemukan untuk diperbaiki", 404);
      }

      await exist.update({
        jumlah: jumlah_nominal,
        total_mahasiswa,
        total_mahasiswa_aktif,
        total_mahasiswa_tidak_aktif,

        file_daftar_nominatif:
          daftar_nominatif?.[0]?.filename || exist.file_daftar_nominatif,

        last_update_lp: new Date(),
        id_status: 4,
        status: "Hasil Perbaikan Lembaga Pendidikan",
        catatan_verifikator: null,
      });

      await insertLogPengajuan({
        id_pengajuan: exist.id,
        section: "biaya_buku",
        aksi: `${req.user.nama} mengajukan hasil perbaikan ke verifikator lembaga pendidikan`,
      });

      return successResponse(
        res,
        "Perbaikan berhasil diajukan ke verifikator lembaga pendidikan",
      );
    }

    /**
     * =========================
     * 🆕 MODE PENGAJUAN BARU
     * =========================
     */
    if (exist) {
      return errorResponse(
        res,
        `Biaya Buku semester ${semester} tahun ${tahun} sudah diajukan`,
        400,
      );
    }

    // 📎 Validasi file wajib (hanya untuk pengajuan baru)
    if (!daftar_nominatif?.[0]) {
      return errorResponse(res, "File daftar nominatif wajib diupload", 400);
    }

    const trxBiayaBuku = await TrxBiayaBukuPks.create({
      id_trx_pks,
      semester,
      tahun,
      jumlah: jumlah_nominal,
      total_mahasiswa,
      total_mahasiswa_aktif,
      total_mahasiswa_tidak_aktif,

      file_daftar_nominatif: daftar_nominatif[0].filename,

      last_update_lp: new Date(),
      id_status: 1,
      status: "Verifikasi Lembaga Pendidikan",
      diajukan_ke_verifikator_by: req.user.nama,
      diajukan_ke_verifikator_at: new Date(),
    });

    const lastInsertId = trxBiayaBuku.id;

    // Update ke mahasiswanya juga

    const mahasiswa = await TrxMahasiswa.findAll({
      where: { id_trx_pks },
    });

    const biayaBukuMahasiswa = mahasiswa.map((mhs) => ({
      id_trx_biaya_buku_pks: lastInsertId,
      id_trx_mahasiswa: mhs.id,
      semester,
      tahun,
      nik: mhs.nik,
      jumlah: jumlah_nominal / total_mahasiswa_aktif,
      status_disetujui: "Dalam Proses Kampus",
    }));

    await TrxBiayaBuku.bulkCreate(biayaBukuMahasiswa);

    // insert log pengajuan
    await insertLogPengajuan({
      id_pengajuan: lastInsertId,
      section: "biaya_buku",
      aksi: `${req.user.nama} mengajukan ke verifikator lembaga pendidikan`,
    });

    return successResponse(
      res,
      "Data berhasil diajukan ke verifikator lembaga pendidikan",
    );
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error", 500);
  }
};

exports.staffBeasiswa = async (req, res) => {
  try {
    const { id_biaya_buku } = req.params;

    const {
      verifikasi,
      catatan_revisi,
      tagihan_semester_lalu,
      tagihan_semester_ini,
      tagihan_sd_semester_ini,
      tagihan_sisa_dana,
    } = req.body;

    const filename = req.file?.filename;

    let id_status;
    let status;
    let id_sub_status;
    let sub_status;
    let ttd;
    let catatanVerifikator;

    if (verifikasi === "setuju") {
      id_status = 2;
      status = "Verifikasi BPDP";
      id_sub_status = 2;
      sub_status = "Verifikator PJK";
      catatanVerifikator = null;

      aksiLog = `${req.user.nama} meneruskan pengajuan ke BPDP (Verifikator PJK)`;
      ttd = filename;
    } else {
      await TrxBiayaBuku.update(
        {
          status_disetujui: "Dalam Proses Kampus",
        },
        {
          where: { id_trx_biaya_hidup_pks: id_biaya_buku },
        },
      );

      id_status = 3;
      status = "Revisi Lembaga Pendidikan";
      catatanVerifikator = catatan_revisi;
      id_sub_status = null;
      sub_status = null;

      aksiLog = `${req.user.nama} mengembalikan pengajuan untuk revisi`;
    }

    await TrxBiayaBukuPks.update(
      {
        tagihan_semester_lalu,
        tagihan_semester_ini,
        tagihan_sd_semester_ini,
        tagihan_sisa_dana,
        id_status: id_status,
        status: status,
        id_sub_status: id_sub_status,
        sub_status: sub_status,
        ttd_staff_beasiswa: ttd,
        ttd_timestamp_staff_beasiswa: new Date(),
        nama_staff_beasiswa: req.user.nama,
        catatan_verifikator: catatanVerifikator,
      },
      {
        where: {
          id: id_biaya_buku,
        },
      },
    );

    await insertLogPengajuan({
      id_pengajuan: id_biaya_buku,
      section: "biaya_buku",
      aksi: aksiLog,
      catatan: catatanVerifikator,
    });

    return successResponse(res, "Data berhasil di-update");
  } catch (error) {
    return errorResponse(res, "Internal Server Error", 500);
  }
};

exports.verifikatorPjk = async (req, res) => {
  try {
    const { id_biaya_buku } = req.params;

    const { verifikasi, catatan_revisi } = req.body;

    let id_status;
    let status;
    let id_sub_status;
    let sub_status;
    let ttd;
    let catatanVerifikator;

    if (verifikasi === "setuju") {
      id_status = 2;
      status = "Verifikasi BPDP";
      id_sub_status = 3;
      sub_status = "Batching";

      aksiLog = `${req.user.nama} meneruskan pengajuan ke untuk di-batching (Verifikator PJK)`;
      ttd = req.file.filename;
    } else {
      id_status = 2;
      status = "Verifikasi BPDP";
      id_sub_status = 1;
      sub_status = "Staff Divisi Beasiswa";
      catatanVerifikator = catatan_revisi;

      aksiLog = `${req.user.nama} mengembalikan pengajuan ke Staff Beasiswa untuk revisi`;
    }

    await TrxBiayaBukuPks.update(
      {
        nama_verifikator_pjk: req.user.nama,
        ttd_verifikator_pjk: ttd,
        id_sub_status: id_sub_status,
        sub_status: sub_status,
        id_status: id_status,
        status: status,
      },
      {
        where: {
          id: id_biaya_buku,
        },
      },
    );

    await insertLogPengajuan({
      id_pengajuan: id_biaya_buku,
      section: "biaya_buku",
      aksi: aksiLog,
      catatan: catatanVerifikator,
    });

    return successResponse(res, "Data berhasil di-update");
  } catch (error) {
    return errorResponse(res, "Internal Server Error", 500);
  }
};

exports.getLog = async (req, res) => {
  try {
    const { id_biaya_buku } = req.params;

    const log = await LogPengajuan.findAll({
      where: { id_pengajuan: id_biaya_buku, section: "biaya_buku" },
      order: [["timestamp", "ASC"]],
    });

    return successResponse(res, "Data berhasil dimuat", log);
  } catch (error) {
    return errorResponse(res, "Internal Server Error");
  }
};

exports.autoBatchBiayaBuku = async (req, res) => {
  try {
    const now = new Date();
    const tahunSekarang = now.getFullYear();
    const tanggalSekarang = now.getDate();
    const semesterSekarang = now.getMonth() + 1; // 1 = Januari

    // Ambil semua data eligible
    const data = await TrxBiayaBukuPks.findAll({
      where: {
        id_status: 2,
        id_sub_status: 3,
        id_batch: null,
      },
      include: [
        {
          model: TrxPks,
          attributes: ["id", "jenjang"],
          required: true,
        },
      ],
    });

    if (data.length === 0) {
      return successResponse(res, "Tidak ada data untuk dibatching");
    }

    const grouped = {};

    for (const item of data) {
      const jenjang = item.TrxPk.jenjang;
      const semester = item.semester;

      const key = `${jenjang}-${semester}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    }

    for (const key in grouped) {
      const items = grouped[key];
      const [jenjang, semester] = key.split("-");

      // Tentukan kategori NORMAL/SUSULAN berdasarkan semester
      let kategori = "NORMAL";
      if (parseInt(semester) % 2 === 1) {
        // Semester ganjil → batas 20 September
        if (
          semesterSekarang > 9 ||
          (semesterSekarang === 9 && tanggalSekarang > 20)
        ) {
          kategori = "SUSULAN";
        }
      } else {
        // Semester genap → batas 20 Maret
        if (
          semesterSekarang > 3 ||
          (semesterSekarang === 3 && tanggalSekarang > 20)
        ) {
          kategori = "SUSULAN";
        }
      }

      // Generate batch code
      const code = generateBatchCodeBiayaBuku({
        tahun: tahunSekarang,
        semester,
        jenjang,
      });

      const batchCode = `${code}-${kategori}`;

      // Cek apakah batch sudah ada
      let batch = await TrxBatchBiayaBukuPks.findOne({
        where: { nama: batchCode },
      });

      if (!batch) {
        batch = await TrxBatchBiayaBukuPks.create({
          nama: batchCode,
          tahun: tahunSekarang,
          jenjang,
          semester,
          kategori,
        });
      }

      const ids = items.map((i) => i.id);

      // Bulk update
      await TrxBiayaBukuPks.update(
        {
          id_batch: batch.id,
          id_sub_status: 4,
          sub_status: "TTD Pimpinan",
        },
        { where: { id: ids } },
      );
    }

    return successResponse(res, "Auto batching Biaya Buku berhasil");
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.getBatchByPagination = async (req, res) => {
  try {
    // Ambil parameter page dan limit dari query, default ke 1 dan 10
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";
    const whereCondition = search
      ? {
          [Op.or]: [{ nama: { [Op.like]: `%${search}%` } }],
        }
      : {};

    // Ambil data role + total count
    const { count, rows } = await TrxBatchBiayaBukuPks.findAndCountAll({
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
    console.log(error);
    return res.status(500).json(errorResponse("Internal Server Error"));
  }
};

exports.getByBatchAndPagination = async (req, res) => {
  try {
    const { id_lembaga_pendidikan, role } = req.user;

    const { id_batch } = req.params;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    let biayaWhere = {
      id_batch: id_batch,
    };

    if (search) {
      biayaWhere[Op.or] = [{ nama: { [Op.like]: `%${search}%` } }];
    }

    let pksWhere = {};
    if (role.includes(8) || role.includes(9)) {
      pksWhere.id_lembaga_pendidikan = id_lembaga_pendidikan;
    }

    const { count, rows } = await TrxBiayaBukuPks.findAndCountAll({
      where: biayaWhere, // id_status filter untuk role 6 akan masuk sini
      include: [
        {
          model: TrxPks,
          attributes: [],
          where: pksWhere, // hanya id_lembaga_pendidikan untuk role 8/9
          required: true,
        },
      ],
      attributes: [
        "id",
        "id_trx_pks",
        "semester",
        "tahun",
        "jumlah",
        "total_mahasiswa",
        "total_mahasiswa_aktif",
        "total_mahasiswa_tidak_aktif",
        "id_status",
        "status",
        "id_sub_status",
        "sub_status",
        "status_transfer",
        "last_update_lp",
        "verify_by_lp",
        "file_daftar_nominatif",
        "file_surat_penagihan",
        "file_pernyataan_keaktifan_mahasiswa",
        "catatan_verifikator",
        [col("TrxPk.no_pks"), "no_pks"],
        [col("TrxPk.lembaga_pendidikan"), "lembaga_pendidikan"],
        [col("TrxPk.tanggal_pks"), "tanggal_pks"],
        [col("TrxPk.jenjang"), "jenjang"],
      ],
      raw: true,
      limit,
      offset,
      order: [["id", "ASC"]],
    });

    const mappedRows = rows.map((item) => ({
      ...item,
      file_daftar_nominatif: getFileUrl(
        req,
        "verifikasi_pengajuan_biaya_buku",
        item.file_daftar_nominatif,
      ),
      file_surat_penagihan: getFileUrl(
        req,
        "verifikasi_pengajuan_biaya_buku",
        item.file_surat_penagihan,
      ),
      file_pernyataan_keaktifan_mahasiswa: getFileUrl(
        req,
        "verifikasi_pengajuan_biaya_buku",
        item.file_pernyataan_keaktifan_mahasiswa,
      ),
    }));

    return successResponse(res, "Data berhasil dimuat", {
      result: mappedRows,
      total: count,
      current_page: page,
      total_pages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.log(error);
    return errorResponse("Internal Server Error");
  }
};

exports.ppkBendahara = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id_batch } = req.params;
    const { actor } = req.body;

    if (!req.file) {
      return errorResponse(res, "File tanda tangan wajib diupload");
    }

    const file_ttd = req.file.filename; // sesuai config multer

    const batch = await TrxBatchBiayaBukuPks.findOne({
      where: { id: id_batch },
      transaction,
    });

    if (!batch) {
      return errorResponse(res, "Batch tidak ditemukan");
    }

    // =====================================
    // Update kolom TTD di batch
    // =====================================
    let batchUpdateData = {};

    if (actor === "ppk") {
      batchUpdateData.ttd_nominatif_ppk = file_ttd;
    } else if (actor === "bendahara") {
      batchUpdateData.ttd_nominatif_bendahara = file_ttd;
    } else {
      return errorResponse(res, "Actor tidak valid");
    }

    await batch.update(batchUpdateData, { transaction });
    await batch.reload({ transaction });

    // =====================================
    // Update verifikasi di semua TrxBiayaBukuPks dalam batch
    // =====================================
    const dataBiaya = await TrxBiayaBukuPks.findAll({
      where: { id_batch },
      attributes: ["id"],
      transaction,
    });

    const idsArray = dataBiaya.map((item) => item.id);

    let biayaUpdateData = {};
    const now = new Date();

    if (actor === "ppk") {
      biayaUpdateData.diverifikasi_ppk_by = req.user.nama;
      biayaUpdateData.diverifikasi_ppk_at = now;
    } else if (actor === "bendahara") {
      biayaUpdateData.diverifikasi_bendahara_by = req.user.nama;
      biayaUpdateData.diverifikasi_bendahara_at = now;
    }

    await TrxBiayaBukuPks.update(biayaUpdateData, {
      where: { id: idsArray },
      transaction,
    });

    // =====================================
    // Cek apakah semua sudah TTD di batch
    // =====================================
    const batchAfterUpdate = await TrxBatchBiayaBukuPks.findOne({
      where: { id: id_batch },
      transaction,
    });

    const isComplete =
      batchAfterUpdate.ttd_nominatif_ppk &&
      batchAfterUpdate.ttd_nominatif_bendahara;

    if (!isComplete) {
      await transaction.commit();
      return successResponse(
        res,
        "Tanda tangan berhasil disimpan, menunggu pihak lainnya",
      );
    }

    // =====================================
    // Kalau sudah lengkap → set selesai semua TrxBiayaBukuPks
    // =====================================
    await TrxBiayaBukuPks.update(
      {
        id_status: 5,
        status: "Selesai",
        id_sub_status: null,
        sub_status: null,
      },
      {
        where: { id: idsArray },
        transaction,
      },
    );

    const aksiLog = `${req.user.nama} menyelesaikan pengajuan biaya buku`;

    const logs = idsArray.map((id) => ({
      id_pengajuan: id,
      section: "biaya_buku",
      aksi: aksiLog,
    }));

    await LogPengajuan.bulkCreate(logs, { transaction });

    await transaction.commit();

    return successResponse(res, "Batch berhasil diselesaikan");
  } catch (error) {
    console.error(error);
    await transaction.rollback();
    return errorResponse(res, "Internal Server Error");
  }
};

exports.getTagihanSemesterLalu = async (req, res) => {
  try {
    const { id_biaya_buku } = req.params;

    const biayaBuku = await TrxBiayaBukuPks.findOne({
      where: { id: id_biaya_buku },
    });

    if (!biayaBuku) {
      return errorResponse(res, "Data tidak ditemukan");
    }

    const currentSemester = parseInt(biayaBuku.semester);
    const currentYear = biayaBuku.tahun;

    // Kalau semester 1, tidak ada semester sebelumnya
    if (!currentSemester || currentSemester === 1) {
      return successResponse(res, "Semester sebelumnya tidak ada", 0);
    }

    const semesterLalu = (currentSemester - 1).toString();

    const biayaSemesterLalu = await TrxBiayaBukuPks.findOne({
      where: {
        id_trx_pks: biayaBuku.id_trx_pks,
        semester: semesterLalu,
        tahun: currentYear,
      },
    });

    if (!biayaSemesterLalu) {
      return successResponse(res, "Data semester lalu tidak ditemukan", 0);
    }

    return successResponse(
      res,
      "Data berhasil dimuat",
      biayaSemesterLalu.tagihan_semester_ini,
    );
  } catch (error) {
    return errorResponse(res, "Internal Server Error");
  }
};

exports.getLockData = async (req, res) => {
  try {
    const { id_trx_pks, semester, tahun } = req.body;

    const exist = await TrxBiayaBukuPks.findOne({
      where: {
        id_trx_pks,
        semester,
        tahun,
      },
    });

    return successResponse(res, "Data berhasil di-update", exist ? "Y" : "N");
  } catch (error) {
    return errorResponse(res, "Internal Server Error", 500);
  }
};

// =============== GENERATE FILE =================
exports.generateRab = async (req, res) => {
  try {
    const { id_biaya_buku } = req.params;

    const biayaBuku = await TrxBiayaBukuPks.findOne({
      where: { id: id_biaya_buku },
      attributes: [
        "id",
        "semester",
        "tahun",
        "jumlah",
        "total_mahasiswa",
        "total_mahasiswa_aktif",
        "tagihan_semester_lalu",
        "tagihan_semester_ini",
        "tagihan_sd_semester_ini",
        "tagihan_sisa_dana",
        "ttd_staff_beasiswa",
        "nama_staff_beasiswa",
        "ttd_timestamp_staff_beasiswa",
        "ttd_verifikator_pjk",
        "nama_verifikator_pjk",
        [col("TrxPk.no_pks"), "no_pks"],
        [col("TrxPk.tanggal_pks"), "tanggal_pks"],
        [col("TrxPk.jenjang"), "jenjang"],
        [col("TrxPk.biaya_buku"), "pagu"],
        [col("TrxPk.lembaga_pendidikan"), "lembaga_pendidikan"],
      ],
      include: [
        {
          model: TrxPks,
          attributes: [],
        },
      ],
      raw: true,
    });

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    await page.setContent(generateHtmlRab(req, biayaBuku), {
      waitUntil: "networkidle0",
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: {
        top: "20mm",
        bottom: "20mm",
        left: "15mm",
        right: "15mm",
      },
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=RAB-Biaya-Buku.pdf",
    );

    res.end(pdfBuffer);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Gagal generate PDF" });
  }
};

const generateHtmlRab = (req, data) => {
  const ttd_staff_beasiswa = data.ttd_staff_beasiswa
    ? getFileUrl(req, "ttd_staff_beasiswa", data.ttd_staff_beasiswa)
    : null;

  const ttd_verifikator_pjk = data.ttd_verifikator_pjk
    ? getFileUrl(req, "ttd_staff_beasiswa", data.ttd_verifikator_pjk)
    : null;

  const ttd_timestamp_staff_beasiswa = formatTanggalIndo(
    data.ttd_timestamp_staff_beasiswa,
  );

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
  </head>

  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
    }
    .no-border {
      border: none;
    }

    table.nominal {
      width: 100%;
      border-collapse: collapse;
      border: none; /* ⬅️ penting */
    }

    .wrapper {
      border: 2px solid black;
    }

    /* Table inner */
    table.nominal th,
    table.nominal td {
      border: 1.5px solid black;
    }

    table.nominal tr td:first-child,
    table.nominal tr th:first-child {
      border-left: none;
    }

    table.nominal tr td:last-child,
    table.nominal tr th:last-child {
      border-right: none;
    }

    table.nominal tr.no-bottom-border > td {
      border-bottom: none !important;
    }

    table.nominal tr.no-top-border > td {
      border-top: none !important;
    }
  </style>

  <body>
    <div class="wrapper">
      <div class="header" style="text-align: center">
        <h3 style="text-decoration: underline">
          LEMBAR MONITORING ANGGARAN PEMBIAYAAN BEASISWA PENDIDIKAN ${data.jenjang}
        </h3>
        <p>${data.no_pks}</p>
      </div>

      <div>
        <table class="nominal">
          <thead>
            <tr>
              <th style="text-align: center">NO</th>
              <th style="text-align: center">SURAT PERMOHONAN</th>
              <th style="text-align: center">PAGU</th>
              <th style="text-align: center">Tagihan s.d Semester Lalu</th>
              <th style="text-align: center">Tagihan Semester Ini</th>
              <th style="text-align: center">Tagihan s.d Semester Ini</th>
              <th style="text-align: center">SISA DANA</th>
            </tr>
            <tr>
              <th style="text-align: center">1</th>
              <th style="text-align: center">2</th>
              <th style="text-align: center">3</th>
              <th style="text-align: center">4</th>
              <th style="text-align: center">5</th>
              <th style="text-align: center">6</th>
              <th style="text-align: center">7</th>
            </tr>
          </thead>
          <tbody>
            <tr class="no-bottom-border">
              <td style="text-align: center; vertical-align: top">I</td>
              <td>
                <span style="text-decoration: underline">Nomor :</span><br />
                <span>${data.no_pks}</span><br />
                <span>${formatTanggalIndo(data.tanggal_pks)}</span>
              </td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
            </tr>

            <tr class="no-top-border" style="padding-top: 10px">
              <td></td>
              <td>Biaya Buku Peserta ${data.total_mahasiswa_aktif} org</td>
              <td style="text-align: end">${formatRupiah(data.pagu)}</td>
              <td style="text-align: end">${formatRupiah(data.tagihan_semester_lalu)}</td>
              <td style="text-align: end">${formatRupiah(data.tagihan_semester_ini)}</td>
              <td style="text-align: end">${formatRupiah(data.tagihan_sd_semester_ini)}</td>
              <td style="text-align: end">${formatRupiah(data.pagu - data.tagihan_sd_semester_ini)}</td>
            </tr>
            <tr>
              <td></td>
              <td style="text-align: center">JUMLAH I</td>
              <td style="text-align: end">${formatRupiah(data.pagu)}</td>
              <td style="text-align: end">${formatRupiah(data.tagihan_semester_lalu)}</td>
              <td style="text-align: end">${formatRupiah(data.tagihan_semester_ini)}</td>
              <td style="text-align: end">${formatRupiah(data.tagihan_sd_semester_ini)}</td>
              <td style="text-align: end">${formatRupiah(data.pagu - data.tagihan_sd_semester_ini)}</td>
            </tr>
            <tr>
              <td style="text-align: center; vertical-align: top">II</td>
              <td>
                <span style="text-decoration: underline">Pajak :</span><br />
                <span>PPN</span><br />
                <span>PPH 23</span>
              </td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
            <tr>
              <td></td>
              <td style="text-align: center">JUMLAH II</td>
              <td style="text-align: end"></td>
              <td style="text-align: end"></td>
              <td style="text-align: end"></td>
              <td style="text-align: end"></td>
              <td style="text-align: end">${formatRupiah(data.pagu - data.tagihan_sd_semester_ini)}</td>
            </tr>
          </tbody>
        </table>

        <div style="display: flex; margin-top: 10px">
          <div style="width: 65%">
            <div style="display: flex; justify-content: space-between">
              <span style="font-weight: bold">Total dibayarkan saat ini</span>
              <div>${formatRupiah(data.tagihan_semester_ini)}</div>
            </div>
            <div
              style="
                border: 1.5px solid black;
                padding: 10px;
                margin-top: 10px;
                border-left: 0px;
              "
            >
              ${terbilang(data.tagihan_semester_ini)} rupiah
            </div>
            <div style="margin-top: 10px">
              <table>
                <tr>
                  <td>Lembaga Pendidikan</td>
                  <td>:</td>
                  <td>${data.lembaga_pendidikan}</td>
                </tr>
                <tr>
                  <td>Untuk Pembayaran</td>
                  <td>:</td>
                  <td>Biaya Buku Semester ${data.semester}</td>
                </tr>
              </table>
            </div>
          </div>
          <div style="width: 35%;">
          <!-- Tanggal -->
          <div style="width: 100%; text-align: center; margin-bottom: 10px">
            <span>Jakarta, ${ttd_timestamp_staff_beasiswa}</span>
          </div>

          <!-- Area TTD -->
          <div style="width: 100%; display: flex; justify-content: space-between;">

            <!-- Staff Divisi Beasiswa -->
            <div style="width: 50%; display: flex; justify-content: center">
              <div style="padding: 20px; text-align: center">
                <span>Staff Divisi Beasiswa,</span><br />

                <!-- SLOT TTD -->
                <div
                  style="
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 10px 0;
                  "
                >
                  ${
                    ttd_staff_beasiswa
                      ? `<img src="${ttd_staff_beasiswa}" style="max-height: 40px; max-width: 120px" />`
                      : ``
                  }
                </div>

                <span style="display: block">${data.nama_staff_beasiswa}</span>
              </div>
            </div>

            <!-- Verifikator PJK -->
            <div style="width: 50%; display: flex; justify-content: center">
              <div style="padding: 20px; text-align: center">
                <span>Verifikator PJK,</span><br />

                <!-- SLOT TTD -->
                <div
                  style="
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 10px 0;
                  "
                >
                  ${
                    ttd_verifikator_pjk
                      ? `<img src="${ttd_verifikator_pjk}" style="max-height: 40px; max-width: 120px" />`
                      : ``
                  }
                </div>

                <span style="display: block">${data.nama_verifikator_pjk ?? "-"}</span>
              </div>
            </div>

          </div>
          </div>
        </div>

        <div style="border-top: 1.5px solid black; height: 100px">
          <span style="font-weight: bold">${data.total_mahasiswa_aktif} Penerima Beasiswa</span>
        </div>
      </div>
    </div>
  </body>
</html>
`;
};

exports.generateNominatif = async (req, res) => {
  try {
    const { id_trx_pks, semester } = req.body;

    const pks = await TrxPks.findOne({
      where: { id: id_trx_pks },
    });

    if (!pks) {
      return res.status(404).json({ message: "PKS tidak ditemukan" });
    }

    const listMahasiswa = await TrxMahasiswa.findAll({
      where: { id_trx_pks: id_trx_pks, status: "1" },
    });

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    await page.setContent(generateHtmlNominatif(pks, semester, listMahasiswa), {
      waitUntil: "networkidle0",
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      landscape: true,
      margin: {
        top: "20mm",
        bottom: "20mm",
        left: "15mm",
        right: "15mm",
      },
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Daftar-Nominatif.pdf",
    );

    res.end(pdfBuffer);
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: "Gagal generate PDF" });
  }
};

const generateHtmlNominatif = (pks, semester, listMahasiswa) => {
  let html = "";

  html += `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Document</title>
      </head>
      <style>
        body {
          font-family: Arial, Helvetica, sans-serif;
        }

        table {
          border-collapse: collapse;
          margin-bottom: 20px;
          width: 100%;
        }

        table td,
        table th {
          vertical-align: middle;
          padding: 2px 4px;
          border: 1px solid black;
          font-size: 12px;
        }
      </style>
      <body>
        <p style="font-weight: bold; font-size: 16px; text-align: center">
          DAFTAR PEMBIAYAAN BUKU SEMESTER ${semester} <br />PESERTA PENERIMA PROGRAM
          BEASISWA PENDIDIKAN ${getKepanjanganJenjang(pks.jenjang)} ANGKATAN ${pks.tahun_angkatan}<br />
          TAHUN AJARAN ${
            pks.tahun_angkatan
              ? `${pks.tahun_angkatan}/${Number(pks.tahun_angkatan) + 1}`
              : "-"
          }
        </p>
        <table>
          <thead>
            <tr>
              <th>NO</th>
              <th>NAMA PENERIMA</th>
              <th>NIK</th>
              <th>JENIS KELAMIN <br />(L/P)</th>
              <th>NOMOR REGISTRASI MAHASISWA</th>
              <th>LEMBAGA PENDIDIKAN</th>
              <th>PROGRAM DAN JURUSAN</th>
              <th>KABUPATEN <br />/ KOTA</th>
              <th>PROVINSI</th>
              <th>BIAYA BUKU SEMESTER ${semester}</th>
              <th>NAMA BANK</th>
              <th>NOMOR REKENING</th>
              <th>NAMA REKENING</th>
            </tr>
          </thead>
          <tbody>`;

  for (let i = 0; i < listMahasiswa.length; i++) {
    html += `<tr>
              <td>${i + 1}</td>
              <td>${listMahasiswa[i].nama}</td>
              <td>${listMahasiswa[i].nik}</td>
              <td style="text-align: center">${listMahasiswa[i].jenis_kelamin ?? "-"}</td>
              <td>${listMahasiswa[i].nim ?? "-"}</td>
              <td>${pks.lembaga_pendidikan ?? "-"}</td>
              <td style="text-align: center">${pks.jenjang ?? "-"} - ${listMahasiswa[i].prodi}</td></td>
              <td style="text-align: center">${listMahasiswa[i].asal_kota ?? "-"}</td>
              <td style="text-align: center">${listMahasiswa[i].asal_provinsi ?? "-"}</td>
              <td style="text-align: right">${formatRupiah(pks.biaya_buku_per_semester_per_mahasiswa)}</td>
              <td>${listMahasiswa[i].bank}</td>
              <td>${listMahasiswa[i].no_rekening}</td>
              <td>${listMahasiswa[i].nama_rekening ?? "-"}</td>
            </tr>`;
  }

  html += `</tbody>
        </table>
      </body>
    </html>`;

  return html;
};

exports.generateSuratPenagihan = async (req, res) => {
  try {
    const { id_trx_pks } = req.params;

    const pks = await TrxPks.findOne({
      where: { id: id_trx_pks },
    });

    if (!pks) {
      return res.status(404).json({ message: "PKS tidak ditemukan" });
    }

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    await page.setContent(generateHtmlSuratPenagihan(), {
      waitUntil: "networkidle0",
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      landscape: true,
      margin: {
        top: "20mm",
        bottom: "20mm",
        left: "15mm",
        right: "15mm",
      },
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Surat-Penagihan.pdf",
    );

    res.end(pdfBuffer);
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: "Gagal generate PDF" });
  }
};

const generateHtmlSuratPenagihan = () => {
  let html = "";

  html += `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Document</title>
      </head>
      <body>
       <h1><strong>CONTOH SURAT PENAGIHAN</strong></h1>
    </html>`;

  return html;
};

exports.generatePernyataanKeaktifanMahasiswa = async (req, res) => {
  try {
    const { id_trx_pks } = req.params;

    const pks = await TrxPks.findOne({
      where: { id: id_trx_pks },
    });

    if (!pks) {
      return res.status(404).json({ message: "PKS tidak ditemukan" });
    }

    const { data: ptResponse } = await axios.get(
      `${process.env.MASTER_SERVICE_URL}/perguruan-tinggi/${pks.id_lembaga_pendidikan}`,
    );

    const pt = ptResponse.data;

    const data = {
      nomor_pks: pks.nomor_pks,
      tahun_angkatan: pks.tahun_angkatan,
      jenjang: getKepanjanganJenjang(pks.jenjang),

      nama_pt: pt.nama_pt,
      singkatan_pt: pt.singkatan,
      jenis_pt: pt.jenis,
      alamat_pt: pt.alamat,
      kode_pos_pt: pt.kode_pos,
      kota_pt: pt.kota,
      no_telepon_pt: pt.no_telepon_pt,
      fax_pt: pt.fax_pt,
      email_pt: pt.email,
      website_pt: pt.website,
      nama_pimpinan_pt: pt.nama_pimpinan,
      no_telepon_pimpinan: pt.no_telepon_pimpinan,
      logo_pt: pt.logo_path,
    };

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    await page.setContent(generateHtmlPernyataanKeaktifanMahasiswa(data), {
      waitUntil: "networkidle0",
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20mm",
        bottom: "20mm",
        left: "15mm",
        right: "15mm",
      },
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Surat-Pernyataan-Keaktifan-Mahasiswa.pdf",
    );

    res.end(pdfBuffer);
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: "Gagal generate PDF" });
  }
};

const generateHtmlPernyataanKeaktifanMahasiswa = () => {
  let html = "";

  html += `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Document</title>
      </head>
      <body>
       <h1><strong>CONTOH PERNYATAAN KEAKTIFAN MAHASISWA</strong></h1>
    </html>`;

  return html;
};

exports.generateNominatifGabungan = async (req, res) => {
  try {
    const { id_batch } = req.params;

    // 1️⃣ Ambil data dari TrxBiayaBukuPks berdasarkan id_batch
    const listBiayaBuku = await TrxBiayaBukuPks.findAll({
      where: { id_batch },
      include: [
        {
          model: TrxPks,
          include: [
            {
              model: TrxMahasiswa,
              where: { status: "1" },
            },
          ],
        },
      ],
    });

    const dataBatch = await TrxBatchBiayaBukuPks.findOne({
      where: { id: id_batch },
    });

    if (!listBiayaBuku || listBiayaBuku.length === 0) {
      return res.status(404).json({
        message: "Data batch tidak ditemukan",
      });
    }

    let allMahasiswa = [];

    for (const biaya of listBiayaBuku) {
      const pks = biaya.TrxPk;
      if (!pks) continue;

      for (const mhs of pks.TrxMahasiswas) {
        allMahasiswa.push({
          ...mhs.toJSON(),
          tahun_angkatan: pks.tahun_angkatan,
          jenjang: pks.jenjang,
          lembaga_pendidikan: pks.lembaga_pendidikan,
          biaya_BUKU: pks.biaya_buku_per_semester_per_mahasiswa,
        });
      }
    }

    if (allMahasiswa.length === 0) {
      return res.status(404).json({
        message: "Tidak ada mahasiswa aktif dalam batch ini",
      });
    }

    // 3️⃣ Generate PDF
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    await page.setContent(
      generateHtmlNominatifGabungan(dataBatch, allMahasiswa),
      {
        waitUntil: "networkidle0",
      },
    );

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      landscape: true,
      margin: {
        top: "20mm",
        bottom: "20mm",
        left: "15mm",
        right: "15mm",
      },
    });

    await browser.close();

    const firstPks = listBiayaBuku[0]?.TrxPk;

    const jenjang = firstPks?.jenjang || "PKS";
    const semesterText =
      parseInt(dataBatch.semester) % 2 === 1 ? "GANJIL" : "GENAP";
    const tahun = dataBatch.tahun;

    const filename = `DAFTAR_NOMINATIF_BIAYA_BUKU_${jenjang}_SEMESTER_${semesterText}_TAHUN_${tahun}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    res.end(pdfBuffer);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Gagal generate PDF gabungan" });
  }
};

const generateHtmlNominatifGabungan = (dataBatch, listMahasiswa) => {
  console.log(dataBatch.semester);
  let html = `<!doctype html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body {
        font-family: Arial, Helvetica, sans-serif;
      }
      table {
        border-collapse: collapse;
        margin-bottom: 20px;
        width: 100%;
      }
      table td, table th {
        vertical-align: middle;
        padding: 2px 4px;
        border: 1px solid black;
        font-size: 12px;
      }
    </style>
  </head>
  <body>
    <p style="font-weight: bold; font-size: 16px; text-align: center">
      DAFTAR PEMBIAYAAN BUKU SEMESTER ${dataBatch.semester.toUpperCase()} TAHUN ${dataBatch.tahun}
    </p>

    <table>
      <thead>
        <tr>
          <th>NO</th>
          <th>NAMA</th>
          <th>NIK</th>
          <th>L/P</th>
          <th>NIM</th>
          <th>LEMBAGA PENDIDIKAN</th>
          <th>JENJANG</th>
          <th>ANGKATAN</th>
          <th>KABUPATEN <br/>/ KOTA</th>
          <th>PROVINSI</th>
          <th>BIAYA BUKU</th>
          <th>BANK</th>
          <th>NO REKENING</th>
          <th>NAMA REKENING</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (let i = 0; i < listMahasiswa.length; i++) {
    const mhs = listMahasiswa[i];

    html += `
      <tr>
        <td>${i + 1}</td>
        <td>${mhs.nama}</td>
        <td>${mhs.nik}</td>
        <td style="text-align:center">${mhs.jenis_kelamin ?? "-"}</td>
        <td>${mhs.nim ?? "-"}</td>
        <td>${mhs.lembaga_pendidikan ?? "-"}</td>
        <td style="text-align:center">${mhs.jenjang}</td>
        <td>${mhs.tahun_angkatan}</td>
        <td style="text-align:center">${mhs.asal_kota ?? "-"}</td>
        <td style="text-align:center">${mhs.asal_provinsi ?? "-"}</td>
        <td style="text-align:right">${formatRupiah(mhs.biaya_BUKU)}</td>
        <td>${mhs.bank ?? "-"}</td>
        <td>${mhs.no_rekening ?? "-"}</td>
        <td>${mhs.nama_rekening ?? "-"}</td>
      </tr>
    `;
  }

  html += `
      </tbody>
    </table>
  </body>
  </html>
  `;

  return html;
};

exports.generateRekap = async (req, res) => {
  try {
    const { id_batch } = req.params;

    const data = await TrxBiayaBukuPks.findAll({
      where: { id_batch },
      include: [{ model: TrxPks }],
      order: [
        ["tahun", "ASC"],
        ["semester", "ASC"],
      ],
    });

    if (!data || data.length === 0) {
      return res.status(404).json({
        message: "Data tidak ditemukan untuk batch ini",
      });
    }

    const dataBatch = await TrxBatchBiayaBukuPks.findOne({
      where: { id: id_batch },
    });

    let grandTotal = 0;

    const rows = data.map((item, index) => {
      const pks = item.TrxPk;
      const jumlah = Number(item.jumlah || 0);
      grandTotal += jumlah;

      return {
        no: index + 1,
        jenis_biaya: "Biaya Buku",
        periode: item.semester,
        tahun: item.tahun,
        jenjang: pks?.jenjang || "-",
        angkatan: pks?.tahun_angkatan || "-",
        lembaga: pks?.lembaga_pendidikan || "-",
        jumlah_mhs: item.total_mahasiswa_aktif || 0,
        biaya_per_orang: Number(
          pks?.biaya_buku_per_semester_per_mahasiswa || 0,
        ),
        jumlah,
      };
    });

    // 🚀 Launch Puppeteer
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    await page.setContent(generateHtmlRekap(dataBatch, rows, grandTotal), {
      waitUntil: "networkidle0",
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: {
        top: "20mm",
        bottom: "20mm",
        left: "15mm",
        right: "15mm",
      },
    });

    await browser.close();

    const firstPks = data[0]?.TrxPk;
    const jenjang = firstPks?.jenjang || "PKS";
    const semesterText =
      parseInt(dataBatch.semester) % 2 === 1 ? "GANJIL" : "GENAP";
    const tahun = dataBatch.tahun;

    const filename = `REKAPITULASI_PENAGIHAN_BIAYA_BUKU_JENJANG_${jenjang}_SEMESTER_${semesterText}_TAHUN_${tahun}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    res.setHeader("Content-Type", "application/pdf");
    // Supaya frontend bisa baca header filename
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    res.end(pdfBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Gagal generate rekap PDF" });
  }
};

function generateHtmlRekap(batch, rows, grandTotal) {
  return `
  <html>
  <head>
    <style>
      body {
        font-family: Arial, sans-serif;
        font-size: 12px;
      }

      h2 {
        text-align: center;
        margin-bottom: 20px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th, td {
        border: 1px solid #000;
        padding: 6px;
        text-align: center;
      }

      th {
        background-color: #e6f2ff;
      }

      .total-row {
        font-weight: bold;
        background-color: #fbe2d5;
      }

      .right {
        text-align: right;
      }
    </style>
  </head>
  <body>

    <h2>REKAPITULASI PENAGIHAN BIAYA BUKU PER JENJANG</h2>

    <table>
      <thead>
        <tr>
          <th>No</th>
          <th>Jenis Biaya</th>
          <th>Semester</th>
          <th>Tahun</th>
          <th>Jenjang</th>
          <th>Angkatan</th>
          <th>Lembaga</th>
          <th>Jumlah Mhs</th>
          <th>Biaya / Orang</th>
          <th>Jumlah</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `
          <tr>
            <td>${r.no}</td>
            <td>Biaya Buku</td>
            <td>${r.periode}</td>
            <td>${r.tahun}</td>
            <td>${r.jenjang}</td>
            <td>${r.angkatan}</td>
            <td>${r.lembaga}</td>
            <td>${r.jumlah_mhs}</td>
            <td class="right">${formatRupiah(r.biaya_per_orang)}</td>
            <td class="right">${formatRupiah(r.jumlah)}</td>
          </tr>
        `,
          )
          .join("")}

        <tr class="total-row">
          <td colspan="9">Jumlah</td>
          <td class="right">${formatRupiah(grandTotal)}</td>
        </tr>
      </tbody>
    </table>

  </body>
  </html>
  `;
}
// =============== GENERATE FILE =================
