const { col, Op, QueryTypes } = require("sequelize");
const {
  successResponse,
  errorResponse,
  failResponse,
} = require("../../../common/response");
const {
  TrxBiayaHidupPks,
  TrxPks,
  LogPengajuan,
  TrxMahasiswa,
  TrxBiayaHidup,
} = require("../../../models");
const { getFileUrl } = require("../../../common/middleware/upload_middleware");

const puppeteer = require("puppeteer");
const {
  formatRupiah,
  parseBatchCode,
  parseBatchCodeBiayaHidup,
  terbilang,
  generateBatchCode,
} = require("../../../utils/stringFormatter");
const {
  formatTanggalIndo,
  currentMonth,
  currentYear,
  getNamaBulan,
  nextMonth,
} = require("../../../utils/dateFormatter");
const { insertLogPengajuan } = require("../../../helpers/log_pengajuan");
const { default: axios } = require("axios");
const {
  getKepanjanganJenjang,
  getJumlahSemester,
} = require("../../../data/jenjangKuliah");
const TrxBatchBiayaHidupPks = require("../../../models/TrxBatchBiayaHidupPks");
const { sequelize } = require("../../../core/db_config");
const ExcelJS = require("exceljs");

exports.getAllData = async (req, res) => {
  try {
    const { idTrxPks } = req.params;

    const biayaHidup = await TrxBiayaHidupPks.findAll({
      where: { id_trx_pks: idTrxPks },
      order: [["id", "ASC"]],
    });

    return successResponse(res, "Data berhasil dimuat", biayaHidup);
  } catch (error) {
    return errorResponse(res, "Internal Server Error");
  }
};

exports.create = async (req, res) => {
  try {
    const { id_trx_pks, bulan, tahun, jumlah } = req.body;

    // validasi wajib
    if (!id_trx_pks || !bulan || jumlah == null) {
      return failResponse(res, "Data tidak lengkap", 400);
    }

    // 🔴 CEK SEMESTER GANDA
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
      jumlah,
      tahun,
    });

    return successResponse(res, "Data berhasil ditambahkan");
  } catch (error) {
    return errorResponse(res, "Internal Server Error", 500);
  }
};

exports.getByPagination = async (req, res) => {
  try {
    const { id_lembaga_pendidikan, id_jenjang, role } = req.user;

    // ================= QUERY PARAM =================
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const search = req.query.search || "";
    const lpId = req.query.lpId || null;
    const jenjang = req.query.jenjang || null;
    const tahun = req.query.tahun || null;

    // ================= FILTER BIAYA =================
    let biayaWhere = {
      ...(search && {
        [Op.or]: [{ nama: { [Op.like]: `%${search}%` } }],
      }),
      ...(tahun && { tahun }),
    };

    // ================= FILTER PKS =================
    let pksWhere = {};

    // ===== ROLE BASED FILTER =====
    if (role.includes(8)) {
      pksWhere.id_jenjang = id_jenjang;
    }

    if (role.includes(8) || role.includes(9)) {
      pksWhere.id_lembaga_pendidikan = id_lembaga_pendidikan;
    }

    // ===== QUERY PARAM FILTER (ONLY IF NOT LOCKED BY ROLE) =====
    if (!role.includes(8) && !role.includes(9) && lpId) {
      pksWhere.id_lembaga_pendidikan = lpId;
    }

    if (!role.includes(8) && jenjang) {
      pksWhere.jenjang = jenjang;
    }

    // ================= QUERY =================
    const { count, rows } = await TrxBiayaHidupPks.findAndCountAll({
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
        "bulan",
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
        [col("TrxPk.biaya_hidup"), "biaya_hidup"],
      ],
      raw: true,
      limit,
      offset,
      order: [["id", "ASC"]],
    });

    // ================= MAP FILE URL =================
    const mappedRows = rows.map((item) => ({
      ...item,
      file_daftar_nominatif: getFileUrl(
        req,
        "verifikasi_pengajuan_biaya_hidup",
        item.file_daftar_nominatif,
      ),
      file_surat_penagihan: getFileUrl(
        req,
        "verifikasi_pengajuan_biaya_hidup",
        item.file_surat_penagihan,
      ),
      file_pernyataan_keaktifan_mahasiswa: getFileUrl(
        req,
        "verifikasi_pengajuan_biaya_hidup",
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
    return errorResponse(res, "Internal Server Error", 500);
  }
};

exports.deleteById = async (req, res) => {
  try {
    const { id_biaya_hidup } = req.params;

    const deleted = await TrxBiayaHidupPks.destroy({
      where: {
        id: id_biaya_hidup,
      },
    });

    await TrxBiayaHidup.destroy({
      where: {
        id_trx_biaya_hidup_pks: id_biaya_hidup,
      },
    });

    const aksiLog = `${req.user.nama} menghapus pengajuan biaya hidup`;

    await insertLogPengajuan({
      id_pengajuan: id_biaya_hidup,
      section: "biaya_hidup",
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

exports.ajukanKeBpdp = async (req, res) => {
  try {
    const { id_biaya_hidup } = req.params;
    const { verifikasi, catatan_revisi } = req.body;

    const trx = await TrxBiayaHidupPks.findOne({
      where: { id: id_biaya_hidup },
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

    await TrxBiayaHidupPks.update(
      {
        id_status,
        status,
        id_sub_status,
        sub_status,
        catatan_verifikator: catatanVerifikator,
        verify_by_lp: new Date(),
      },
      {
        where: { id: id_biaya_hidup },
      },
    );

    await TrxBiayaHidup.update(
      {
        status_disetujui: "Dalam Proses BPDP",
      },
      {
        where: { id_trx_biaya_hidup_pks: id_biaya_hidup },
      },
    );

    await insertLogPengajuan({
      id_pengajuan: trx.id,
      section: "biaya_hidup",
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
      bulan,
      tahun,
      jumlah_nominal,
      total_mahasiswa,
      total_mahasiswa_aktif,
      total_mahasiswa_tidak_aktif,
      status_verifikasi,
    } = req.body;

    const { daftar_nominatif } = req.files || {};

    // 🔎 Cek data existing
    const exist = await TrxBiayaHidupPks.findOne({
      where: { id_trx_pks, bulan, tahun },
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
        section: "biaya_hidup",
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
        `Biaya Hidup bulan ${bulan} tahun ${tahun} sudah diajukan`,
        400,
      );
    }

    // 📎 Validasi file wajib (hanya untuk pengajuan baru)
    if (!daftar_nominatif?.[0]) {
      return errorResponse(res, "File daftar nominatif wajib diupload", 400);
    }

    const trxBiayaHidup = await TrxBiayaHidupPks.create({
      id_trx_pks,
      bulan,
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

    const lastInsertId = trxBiayaHidup.id;

    // Update ke mahasiswanya juga

    const mahasiswa = await TrxMahasiswa.findAll({
      where: { id_trx_pks },
    });

    const biayaHidupMahasiswa = mahasiswa.map((mhs) => ({
      id_trx_biaya_hidup_pks: lastInsertId,
      id_trx_mahasiswa: mhs.id,
      bulan,
      tahun,
      nik: mhs.nik,
      jumlah: jumlah_nominal / total_mahasiswa_aktif,
      status_disetujui: "Dalam Proses Kampus",
    }));

    await TrxBiayaHidup.bulkCreate(biayaHidupMahasiswa);

    // insert log pengajuan
    await insertLogPengajuan({
      id_pengajuan: lastInsertId,
      section: "biaya_hidup",
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
    const { id_biaya_hidup } = req.params;

    const {
      verifikasi,
      catatan_revisi,
      tagihan_bulan_lalu,
      tagihan_bulan_ini,
      tagihan_sd_bulan_ini,
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
      await TrxBiayaHidup.update(
        {
          status_disetujui: "Dalam Proses Kampus",
        },
        {
          where: { id_trx_biaya_hidup_pks: id_biaya_hidup },
        },
      );

      id_status = 3;
      status = "Revisi Lembaga Pendidikan";
      catatanVerifikator = catatan_revisi;
      id_sub_status = null;
      sub_status = null;

      aksiLog = `${req.user.nama} mengembalikan pengajuan untuk revisi`;
    }

    await TrxBiayaHidupPks.update(
      {
        tagihan_bulan_lalu,
        tagihan_bulan_ini,
        tagihan_sd_bulan_ini,
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
          id: id_biaya_hidup,
        },
      },
    );

    await insertLogPengajuan({
      id_pengajuan: id_biaya_hidup,
      section: "biaya_hidup",
      aksi: aksiLog,
      catatan: catatanVerifikator,
    });

    return successResponse(res, "Data berhasil di-update");
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error", 500);
  }
};

exports.verifikatorPjk = async (req, res) => {
  try {
    const { id_biaya_hidup } = req.params;

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

    await TrxBiayaHidupPks.update(
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
          id: id_biaya_hidup,
        },
      },
    );

    await insertLogPengajuan({
      id_pengajuan: id_biaya_hidup,
      section: "biaya_hidup",
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
    const { id_biaya_hidup } = req.params;

    const log = await LogPengajuan.findAll({
      where: { id_pengajuan: id_biaya_hidup, section: "biaya_hidup" },
      order: [["timestamp", "ASC"]],
    });

    return successResponse(res, "Data berhasil dimuat", log);
  } catch (error) {
    return errorResponse(res, "Internal Server Error");
  }
};

exports.autoBatchBiayaHidup = async (req, res) => {
  try {
    const now = new Date();
    const bulanSekarang = now.getMonth() + 2;
    const tahunSekarang = now.getFullYear();
    const tanggal = now.getDate();

    const kategori = tanggal <= 20 ? "NORMAL" : "SUSULAN";

    // Ambil semua data eligible
    const data = await TrxBiayaHidupPks.findAll({
      where: {
        id_status: 2,
        id_sub_status: 3,
        id_batch: null,
        bulan: getNamaBulan(bulanSekarang),
        tahun: tahunSekarang,
      },
      include: [
        {
          model: TrxPks,
          attributes: ["id", "jenjang"],
          required: true, // INNER JOIN
        },
      ],
    });

    if (data.length === 0) {
      return successResponse(res, "Tidak ada data untuk dibatching");
    }

    const grouped = {};

    for (const item of data) {
      const jenjang = item.TrxPk.jenjang;

      if (!grouped[jenjang]) {
        grouped[jenjang] = [];
      }

      grouped[jenjang].push(item);
    }

    for (const jenjang in grouped) {
      const items = grouped[jenjang];

      // Generate batch code pakai function kamu
      const bulanNama = getNamaBulan(bulanSekarang);

      const code = generateBatchCode({
        tahun: tahunSekarang,
        bulan: bulanNama,
        jenjang,
      });

      const batchCode = `${code}-${kategori}`;

      // Cek apakah batch sudah ada
      let batch = await TrxBatchBiayaHidupPks.findOne({
        where: {
          nama: batchCode,
        },
      });

      // Jika belum ada → buat
      if (!batch) {
        batch = await TrxBatchBiayaHidupPks.create({
          nama: batchCode,
          bulan: getNamaBulan(bulanSekarang),
          tahun: tahunSekarang,
          jenjang,
          kategori,
        });
      }

      const ids = items.map((i) => i.id);

      // Bulk update
      await TrxBiayaHidupPks.update(
        {
          id_batch: batch.id,
          id_sub_status: 4,
          sub_status: "TTD Pimpinan",
        },
        {
          where: {
            id: ids,
          },
        },
      );
    }

    return successResponse(res, "Auto batching berhasil");
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
    const { count, rows } = await TrxBatchBiayaHidupPks.findAndCountAll({
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

    const { count, rows } = await TrxBiayaHidupPks.findAndCountAll({
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
        "bulan",
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
        "verifikasi_pengajuan_biaya_hidup",
        item.file_daftar_nominatif,
      ),
      file_surat_penagihan: getFileUrl(
        req,
        "verifikasi_pengajuan_biaya_hidup",
        item.file_surat_penagihan,
      ),
      file_pernyataan_keaktifan_mahasiswa: getFileUrl(
        req,
        "verifikasi_pengajuan_biaya_hidup",
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

exports.ppkBendahara = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id_batch } = req.params;
    const { actor } = req.body;

    if (!req.file) {
      return errorResponse(res, "File tanda tangan wajib diupload");
    }

    const file_ttd = req.file.filename; // sesuai config multer

    const batch = await TrxBatchBiayaHidupPks.findOne({
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
    // Update verifikasi di semua TrxBiayaHidupPks dalam batch
    // =====================================
    const dataBiaya = await TrxBiayaHidupPks.findAll({
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

    await TrxBiayaHidupPks.update(biayaUpdateData, {
      where: { id: idsArray },
      transaction,
    });

    // =====================================
    // Cek apakah semua sudah TTD
    // =====================================
    const batchAfterUpdate = await TrxBatchBiayaHidupPks.findOne({
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
    // Kalau sudah lengkap → set selesai semua TrxBiayaHidupPks
    // =====================================
    await TrxBiayaHidupPks.update(
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

    const aksiLog = `${req.user.nama} menyelesaikan pengajuan biaya hidup`;

    const logs = idsArray.map((id) => ({
      id_pengajuan: id,
      section: "biaya_hidup",
      aksi: aksiLog,
    }));

    await TrxBiayaHidup.update(
      {
        status_disetujui: "Dalam Proses Pencairan",
      },
      {
        where: { id_trx_biaya_hidup_pks: idsArray },
      },
    );

    await LogPengajuan.bulkCreate(logs, { transaction });

    await transaction.commit();

    return successResponse(res, "Batch berhasil diselesaikan");
  } catch (error) {
    console.error(error);
    await transaction.rollback();
    return errorResponse(res, "Internal Server Error");
  }
};

exports.getTagihanBulanLalu = async (req, res) => {
  try {
    const { id_biaya_hidup } = req.params;

    const biayaHidup = await TrxBiayaHidupPks.findOne({
      where: { id: id_biaya_hidup },
    });

    if (!biayaHidup) {
      return errorResponse(res, "Data tidak ditemukan");
    }

    const currenMonth = biayaHidup.bulan;
    const currentYear = biayaHidup.tahun;

    const bulanIndo = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];

    const currentIndex = bulanIndo.indexOf(currenMonth);

    let bulanLalu;
    let tahunLalu = currentYear;

    if (currentIndex === 0) {
      bulanLalu = bulanIndo[11];
      tahunLalu = currentYear - 1;
    } else {
      bulanLalu = bulanIndo[currentIndex - 1];
    }

    const biayaBulanLalu = await TrxBiayaHidupPks.findOne({
      where: {
        id_trx_pks: biayaHidup.id_trx_pks,
        bulan: bulanLalu,
        tahun: tahunLalu,
      },
    });

    if (!biayaBulanLalu) {
      return successResponse(res, "Data bulan lalu tidak ditemukan", 0);
    }

    return successResponse(
      res,
      "Data berhasil dimuat",
      biayaBulanLalu.tagihan_bulan_ini,
    );
  } catch (error) {
    return errorResponse(res, "Internal Server Error");
  }
};

exports.getMonitoringPengajuan = async (req, res) => {
  try {
    // ===============================
    // 1️⃣ Ambil Query Params
    // ===============================
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const bulan = req.query.bulan;
    const tahun = req.query.tahun;

    // ===============================
    // 2️⃣ Ambil Master Perguruan Tinggi (Driving Data)
    // ===============================
    const { data: masterResponse } = await axios.get(
      `${process.env.MASTER_SERVICE_URL}/perguruan-tinggi`,
      {
        params: {
          page,
          limit,
          search,
        },
      },
    );

    const masterList = masterResponse.data.result || [];
    const total = masterResponse.data.total || 0;
    const totalPages = masterResponse.data.total_pages || 0;

    // Kalau tidak ada data master
    if (masterList.length === 0) {
      return res.status(200).json({
        message: "Data monitoring berhasil dimuat",
        data: {
          result: [],
          total,
          current_page: page,
          total_pages: totalPages,
        },
      });
    }

    // ===============================
    // 3️⃣ Ambil ID Lembaga untuk Aggregate
    // ===============================
    const lembagaIds = masterList.map((pt) => pt.id_pt);

    // ===============================
    // 4️⃣ Query Aggregate PKS + Biaya Buku
    // ===============================
    const monitoringData = await sequelize.query(
      `
  SELECT 
    tp.id_lembaga_pendidikan,

    COUNT(DISTINCT tp.id) AS total_pks,

    COUNT(DISTINCT tb.id_trx_pks) AS pks_sudah_diajukan

  FROM trx_pks tp

  LEFT JOIN trx_biaya_hidup_pks tb
    ON tb.id_trx_pks = tp.id
    AND (:bulan IS NULL OR tb.bulan = :bulan)
    AND (:tahun IS NULL OR tb.tahun = :tahun)

  WHERE tp.id_lembaga_pendidikan IN (:lembagaIds)

  GROUP BY tp.id_lembaga_pendidikan
  `,
      {
        replacements: {
          lembagaIds,
          bulan: bulan || null,
          tahun: tahun || null,
        },
        type: QueryTypes.SELECT,
      },
    );

    // ===============================
    // 5️⃣ Buat Map untuk Akses Cepat
    // ===============================
    const monitoringMap = {};

    monitoringData.forEach((item) => {
      monitoringMap[item.id_lembaga_pendidikan] = item;
    });

    // ===============================
    // 6️⃣ Merge Data (LEFT JOIN versi Microservice)
    // ===============================

    const finalResult = masterList.map((pt) => {
      const monitoring = monitoringMap[pt.id_pt] || {};

      const totalPks = parseInt(monitoring.total_pks || 0);
      const sudah = parseInt(monitoring.pks_sudah_diajukan || 0);

      const belum = totalPks - sudah;

      return {
        id: pt.id_pt,
        nama: pt.nama_pt,
        total_pks: totalPks,
        pks_sudah_diajukan: sudah,
        pks_belum_diajukan: belum > 0 ? belum : 0,
      };
    });
    // ===============================
    // 7️⃣ Return Response
    // ===============================

    return successResponse(res, "Data berhasil dimuat", {
      result: finalResult,
      total,
      current_page: page,
      total_pages: totalPages,
    });
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error");
  }
};

// =============== GENERATE FILE =================
exports.generateRab = async (req, res) => {
  try {
    const { id_biaya_hidup } = req.params;

    const biayaHidup = await TrxBiayaHidupPks.findOne({
      where: { id: id_biaya_hidup },
      attributes: [
        "id",
        "jumlah",
        "bulan",
        "tahun",
        "total_mahasiswa",
        "total_mahasiswa_aktif",
        "tagihan_bulan_lalu",
        "tagihan_bulan_ini",
        "tagihan_sd_bulan_ini",
        "tagihan_sisa_dana",
        "ttd_staff_beasiswa",
        "ttd_verifikator_pjk",
        "nama_staff_beasiswa",
        "nama_verifikator_pjk",
        "ttd_timestamp_staff_beasiswa",
        [col("TrxPk.no_pks"), "no_pks"],
        [col("TrxPk.tanggal_pks"), "tanggal_pks"],
        [col("TrxPk.jenjang"), "jenjang"],
        [col("TrxPk.biaya_hidup"), "pagu"],
        [col("TrxPk.jenjang"), "jenjang"],
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

    await page.setContent(generateHtmlRab(req, biayaHidup), {
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
      "attachment; filename=RAB-Biaya-Hidup.pdf",
    );

    res.end(pdfBuffer);
  } catch (error) {
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

  const jumlahBulan = getJumlahSemester(data.jenjang) * 6;

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
              <th style="text-align: center">Tagihan s.d Bln Lalu</th>
              <th style="text-align: center">Tagihan Bln Ini</th>
              <th style="text-align: center">Tagihan s.d Bln Ini</th>
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
              <td>Biaya Hidup Peserta ${data.total_mahasiswa_aktif} org x ${jumlahBulan} Bulan</td>
              <td style="text-align: end">${formatRupiah(data.pagu)}</td>
              <td style="text-align: end">${formatRupiah(data.tagihan_bulan_lalu)}</td>
              <td style="text-align: end">${formatRupiah(data.tagihan_bulan_ini)}</td>
              <td style="text-align: end">${formatRupiah(data.tagihan_sd_bulan_ini)}</td>
              <td style="text-align: end">${formatRupiah(data.pagu - data.tagihan_sd_bulan_ini)}</td>
            </tr>
            <tr>
              <td></td>
              <td style="text-align: center">JUMLAH I</td>
              <td style="text-align: end">${formatRupiah(data.pagu)}</td>
              <td style="text-align: end">${formatRupiah(data.tagihan_bulan_lalu)}</td>
              <td style="text-align: end">${formatRupiah(data.tagihan_bulan_ini)}</td>
              <td style="text-align: end">${formatRupiah(data.tagihan_sd_bulan_ini)}</td>
              <td style="text-align: end">${formatRupiah(data.pagu - data.tagihan_sd_bulan_ini)}</td>
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
              <td style="text-align: end">${formatRupiah(data.pagu - data.tagihan_sd_bulan_ini)}</td>
            </tr>
          </tbody>
        </table>

        <div style="display: flex; margin-top: 10px">
          <div style="width: 65%">
            <div style="display: flex; justify-content: space-between">
              <span style="font-weight: bold">Total dibayarkan saat ini</span>
              <div>${formatRupiah(data.tagihan_bulan_ini)}</div>
            </div>
            <div
              style="
                border: 1.5px solid black;
                padding: 10px;
                margin-top: 10px;
                border-left: 0px;
              "
            >
              ${terbilang(data.tagihan_bulan_ini)} rupiah
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
                  <td>Biaya Hidup Bulan ${data.bulan} ${data.tahun}</td>
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
    const { id_trx_pks } = req.params;

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

    await page.setContent(generateHtmlNominatif(pks, listMahasiswa), {
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

const generateHtmlNominatif = (pks, listMahasiswa) => {
  const bulanDepan = nextMonth();

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
          DAFTAR PEMBIAYAAN HIDUP BULAN ${bulanDepan.toUpperCase()} ${pks.tahun_angkatan}<br />PESERTA PENERIMA PROGRAM
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
              <th>KABUPATEN <br/>/ KOTA</th>
              <th>PROVINSI</th>
              <th>BIAYA HIDUP BULAN ${bulanDepan.toUpperCase()}</th>
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
              <td style="text-align: center">${pks.jenjang ?? "-"} - ${listMahasiswa[i].prodi ?? "-"}</td>
              <td style="text-align: center">${listMahasiswa[i].asal_kota ?? "-"}</td>
              <td style="text-align: center">${listMahasiswa[i].asal_provinsi ?? "-"}</td>
              <td style="text-align: right">${formatRupiah(pks.biaya_hidup_per_bulan_per_mahasiswa)}</td>
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
    const { id_trx_pks, jumlah_nominal, total_mahasiswa_aktif } = req.body;

    console.log(req.body);

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

      jumlah_nominal,
      total_mahasiswa_aktif,
    };

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    await page.setContent(generateHtmlSuratPenagihan(data), {
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
      "attachment; filename=Surat-Penagihan.pdf",
    );

    res.end(pdfBuffer);
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: "Gagal generate PDF" });
  }
};

const generateHtmlSuratPenagihan = (data) => {
  const bulanSekarang = currentMonth();
  const tahunSekarang = currentYear();

  let html = "";

  html += `<!doctype html>
    <html lang="id">
    <head>
      <meta charset="UTF-8" />
      <title>Surat Penagihan</title>
    </head>

    <style>
      body {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 14px;
      }

      .header {
        display: flex;
        align-items: center;
        gap: 20px;
        border-bottom: 3px solid #2d4a88;
        padding-bottom: 15px;
        color: #2d4a88;
      }

      .header img {
        height: 90px;
      }

      .header-text {
        font-size: 13px;
      }

      .header-text .title {
        font-size: 20px;
        font-weight: bold;
      }

      .info-table {
        margin-top: 20px;
      }

      .info-table td {
        padding: 2px 4px;
        vertical-align: top;
      }

      .content {
        text-align: justify;
        margin-top: 15px;
      }

      .closing {
        margin-top: 40px;
        display: flex;
        justify-content: space-between;
      }

      .signature {
        width: 45%;
        text-align: center;
      }

      .spacer {
        height: 80px;
      }
    </style>

    <body>
      <div class="container">
        <div class="header">
          <img src="${data.logo_pt}" />
          <div class="header-text">
            <div><strong>YAYASAN PENDIDIKAN PERKEBUNAN YOGYAKARTA</strong></div>
            <div class="title">${data.nama_pt}</div>
            <div>
              ${data.alamat_pt} ${data.kode_pos_pt}<br />
              Telepon: ${data.no_telepon_pt} | Fax: ${data.fax_pt}<br />
              Website: ${data.website_pt} | Email: ${data.email_pt}
            </div>
          </div>
        </div>

        <div style="text-align:right; margin-top:15px;">
          ${data.kota_pt},  ${bulanSekarang} ${tahunSekarang}
        </div>

        <table class="info-table">
          <tr>
            <td>Nomor</td>
            <td>:</td>
            <td>-</td>
          </tr>
          <tr>
            <td>Lampiran</td>
            <td>:</td>
            <td>2 (dua) berkas</td>
          </tr>
          <tr>
            <td>Hal</td>
            <td>:</td>
            <td><strong>Biaya Hidup Bulan ${bulanSekarang} Tahun ${tahunSekarang} Program ${data.jenjang}</strong></td>
          </tr>
        </table>

        <div class="content">
          <p>
          <strong>
            Yth. Direktur Utama<br/>
            Badan Pengelola Dana Perkebunan (BPDP)<br/>
            Gedung Surachman Tjokrodisurjo<br/>
            Jl. Medan Merdeka Timur No. 16, RT 07/RW 01, Kec. Gambir,<br/>
            Jakarta Pusat, DKI Jakarta 10110
            </strong>
          </p>

          <p>
            Bersama ini kami sampaikan bahwa mahasiswa penerima beasiswa dari Badan Pengelola Dana Perkebunan (BPDP)
            tahun ${tahunSekarang} (Angkatan VII) Program ${data.jenjang} sebanyak
            ${data.total_mahasiswa_aktif} (${terbilang(data.total_mahasiswa_aktif)}) orang
            telah aktif menjalani perkuliahan di ${data.nama_pt}
          </p>

          <p>
            Sehubungan dengan hal tersebut, berdasarkan Perjanjian Kerjasama antara BPDP
            dengan YPPY Nomor: PRJ-67/BPDP/2025 dan Nomor: 29/YPPY/SPK/VIII/2025, tanggal 15 Agustus 2025 tentang Pendanaan Beasiswa Program
            ${data.jenjang}, dengan ini kami sampaikan permohonan pembayaran sebagai berikut:
          </p>

          <ul>
            <li>
              Biaya Hidup untuk bulan ${bulanSekarang} tahun ${tahunSekarang} sebesar
              <strong>${formatRupiah(data.jumlah_nominal)}</strong>
            </li>
          </ul>

          <p>
            Jadi, jumlah biaya yang ditransfer adalah sebesar
            <strong>${formatRupiah(data.jumlah_nominal)}</strong> kepada mahasiswa beasiswa program ${data.jenjang} ${data.nama_pt} (sesuai dengan daftar terlampir)
            agar dapat di transfer ke rekening masing-masing mahasiswa.
          </p>

          <p>
            Demikian, atas perhatian dan fasilitas yang diberikan kami sampaikan terima kasih.
          </p>
        </div>
      </div>
    </body>
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

const generateHtmlPernyataanKeaktifanMahasiswa = (data) => `
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
    }

    .letter {
      width: 700px;
      margin: 40px auto;
      line-height: 1.6;
      font-size: 14px;
    }

    .title {
      margin-bottom: 16px;
    }

    .identity {
      border-collapse: collapse;
      margin-bottom: 20px;
    }

    .identity td {
      vertical-align: top;
      padding: 2px 4px;
    }

    .identity td:first-child {
      vertical-align: top;
      padding: 2px 0px;
    }

    .label {
      width: 220px;
    }

    .colon {
      width: 10px;
    }

    .value {
      width: 450px;
    }

    .content {
      text-align: justify;
      margin-bottom: 12px;
    }

    .closing {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      margin-top: 40px;
    }

    .position {
      margin-bottom: 60px;
    }

    .spacer {
      height: 40px;
    }
  </style>

  <body>
    <div
      style="
        display: flex;
        align-items: center;
        gap: 30px;
        color: #2d4a88;
        padding-bottom: 20px;
        border-bottom: 4px solid #2d4a88;
      "
    >
      <img src="${data.logo_pt}" style="width: auto; height: 100px" />
      <div>
        <span style="font-weight: bold; font-size: 16px"
          >YAYASAN PENDIDIKAN PERKEBUNAN YOGYAKARTA</span
        ><br />
        <span style="font-weight: bold; font-size: 22px"
          >${data.nama_pt}</span
        ><br />
        <div style="font-size: 12px">
          <span>${data.alamat_pt} ${data.kode_pos_pt}</span><br />
          <span>Telepon: ${data.no_telepon_pt}. Facsimile: ${data.fax_pt}</span><br />
          <span>Website: ${data.website_pt}. Email: ${data.email_pt}</span><br />
        </div>
      </div>
    </div>

    <div>
      <p style="font-size: 14px; font-weight: bold; text-align: center">
        SURAT PERNYATAAN KEAKTIFAN<br />MAHASISWA PENERIMA BEASISWA PROGRAM
${data.jenjang} KELAPA SAWIT ${data.singkatan_pt}<br />ANGKATAN VII
        (TAHUN ${data.tahun_angkatan})
      </p>
    </div>

    <div class="letter">
      <p class="title">Yang bertandatangan di bawah ini:</p>

      <table class="identity">
        <tr>
          <td class="label">Nama</td>
          <td class="colon">:</td>
          <td class="value">${data.nama_pimpinan_pt}</td>
        </tr>
        <tr>
          <td class="label">Jabatan</td>
          <td class="colon">:</td>
          <td class="value">${data.jabatan_pimpinan ?? "-"}</td>
        </tr>
        <tr>
          <td class="label">No. Telp/HP</td>
          <td class="colon">:</td>
          <td class="value">${data.no_telepon_pimpinan}</td>
        </tr>
        <tr>
          <td class="label">Nama Perguruan Tinggi</td>
          <td class="colon">:</td>
          <td class="value">${data.nama_pt}</td>
        </tr>
        <tr>
          <td class="label">Alamat Perguruan Tinggi</td>
          <td class="colon">:</td>
          <td class="value">${data.alamat_pt} ${data.kode_pos_pt}</td>
        </tr>
        <tr>
          <td class="label">No. Telepon Perguruan Tinggi</td>
          <td class="colon">:</td>
          <td class="value">${data.no_telepon_pt}</td>
        </tr>
      </table>

      <p class="content">
        Dengan ini menyatakan bahwa sampai dengan Semester I sebanyak 90
        mahasiswa peserta Beasiswa ${data.jenjang} Kelapa Sawit ${data.singkatan_pt} Tahun Ajaran
        ${data.tahun_angkatan} aktif mengikuti kegiatan perkuliahan.
      </p>

      <p class="content">
        Demikian surat pernyataan ini kami buat dengan sebenarnya dan penuh rasa
        tanggung jawab.
      </p>
    </div>

    <div class="closing">
      <span class="date">${data.kota_pt},  September 2025</span><br />

      <span class="position">${data.jabatan_pimpinan},</span>

      <div class="spacer"></div>

      <span class="name">
        <strong>${data.nama_pimpinan_pt}</strong>
      </span>
    </div>
  </body>
</html>
`;

exports.generateNominatifGabungan = async (req, res) => {
  try {
    const { id_batch } = req.params;

    // 1️⃣ Ambil data dari TrxBiayaHidupPks berdasarkan id_batch
    const listBiayaHidup = await TrxBiayaHidupPks.findAll({
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

    const dataBatch = await TrxBatchBiayaHidupPks.findOne({
      where: { id: id_batch },
    });

    if (!listBiayaHidup || listBiayaHidup.length === 0) {
      return res.status(404).json({
        message: "Data batch tidak ditemukan",
      });
    }

    let allMahasiswa = [];

    for (const biaya of listBiayaHidup) {
      const pks = biaya.TrxPk;
      if (!pks) continue;

      for (const mhs of pks.TrxMahasiswas) {
        allMahasiswa.push({
          ...mhs.toJSON(),
          tahun_angkatan: pks.tahun_angkatan,
          jenjang: pks.jenjang,
          lembaga_pendidikan: pks.lembaga_pendidikan,
          biaya_hidup: pks.biaya_hidup_per_bulan_per_mahasiswa,
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

    const firstPks = listBiayaHidup[0]?.TrxPk;

    const jenjang = firstPks?.jenjang || "PKS";
    const bulan = dataBatch.bulan.toUpperCase();
    const tahun = dataBatch.tahun;

    const filename = `DAFTAR_NOMINATIF_BIAYA_HIDUP_${jenjang}_BULAN_${bulan}_TAHUN_${tahun}.pdf`;

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
  console.log(dataBatch.bulan);
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
      DAFTAR PEMBIAYAAN HIDUP BULAN ${dataBatch.bulan.toUpperCase()} TAHUN ${dataBatch.tahun}
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
          <th>BIAYA HIDUP</th>
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
        <td style="text-align:right">${formatRupiah(mhs.biaya_hidup)}</td>
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

    const data = await TrxBiayaHidupPks.findAll({
      where: { id_batch },
      include: [{ model: TrxPks }],
      order: [
        ["tahun", "ASC"],
        ["bulan", "ASC"],
      ],
    });

    if (!data || data.length === 0) {
      return res.status(404).json({
        message: "Data tidak ditemukan untuk batch ini",
      });
    }

    const dataBatch = await TrxBatchBiayaHidupPks.findOne({
      where: { id: id_batch },
    });

    let grandTotal = 0;

    const rows = data.map((item, index) => {
      const pks = item.TrxPk;
      const jumlah = Number(item.jumlah || 0);
      grandTotal += jumlah;

      return {
        no: index + 1,
        jenis_biaya: "Biaya Hidup",
        periode: item.bulan,
        tahun: item.tahun,
        jenjang: pks?.jenjang || "-",
        angkatan: pks?.tahun_angkatan || "-",
        lembaga: pks?.lembaga_pendidikan || "-",
        jumlah_mhs: item.total_mahasiswa_aktif || 0,
        biaya_per_orang: Number(pks?.biaya_hidup_per_bulan_per_mahasiswa || 0),
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
    const bulan = dataBatch.bulan.toUpperCase();
    const tahun = dataBatch.tahun;

    const filename = `REKAPITULASI_PENAGIHAN_BIAYA_HIDUP_JENJANG_${jenjang}_BULAN_${bulan}_TAHUN_${tahun}.pdf`;

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

    <h2>REKAPITULASI PENAGIHAN BIAYA HIDUP PER JENJANG</h2>

    <table>
      <thead>
        <tr>
          <th>No</th>
          <th>Jenis Biaya</th>
          <th>Periode</th>
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
            <td>${r.jenis_biaya}</td>
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
