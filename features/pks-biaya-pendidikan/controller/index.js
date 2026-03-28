const { col, Op } = require("sequelize");
const {
  successResponse,
  errorResponse,
  failResponse,
} = require("../../../common/response");
const {
  TrxBiayaPendidikanPks,
  TrxPks,
  LogPengajuan,
  TrxMahasiswa,
  TrxBiayaPendidikan,
} = require("../../../models");
const { getFileUrl } = require("../../../common/middleware/upload_middleware");

const puppeteer = require("puppeteer");
const {
  formatRupiah,
  parseBatchCode,
  parseBatchCodeBiayaPendidikan,
  terbilang,
} = require("../../../utils/stringFormatter");
const { formatTanggalIndo } = require("../../../utils/dateFormatter");
const { insertLogPengajuan } = require("../../../helpers/log_pengajuan");
const { default: axios } = require("axios");
const { getKepanjanganJenjang } = require("../../../data/jenjangKuliah");
const TrxBatchBiayaPendidikanPks = require("../../../models/TrxBatchBiayaPendidikanPks");
const { sequelize } = require("../../../core/db_config");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  BorderStyle,
  ImageRun,
  Header,
} = require("docx");
const { getImageBufferFromUrl } = require("../../../utils/fileFormatter");

exports.getAllData = async (req, res) => {
  try {
    const { idTrxPks } = req.params;

    const biayaPendidikan = await TrxBiayaPendidikanPks.findAll({
      where: { id_trx_pks: idTrxPks },
      order: [["id", "ASC"]],
    });

    return successResponse(res, "Data berhasil dimuat", biayaPendidikan);
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
    const exist = await TrxBiayaPendidikanPks.findOne({
      where: {
        id_trx_pks,
        semester,
        tahun,
      },
    });

    if (exist) {
      return errorResponse(
        res,
        `Biaya Pendidikan semester ${semester} tahun ${tahun} sudah ada`,
        400,
      );
    }

    await TrxBiayaPendidikanPks.create({
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

    const { count, rows } = await TrxBiayaPendidikanPks.findAndCountAll({
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
        "file_laporan_kegiatan_semester",
        "file_sptjm",
        "file_bukti_kwitansi",
        "catatan_verifikator",
        "diajukan_ke_verifikator_by",
        "diajukan_ke_verifikator_at",
        "ttd_nominatif_ppk",
        "ttd_nominatif_bendahara",
        [col("TrxPk.no_pks"), "no_pks"],
        [col("TrxPk.lembaga_pendidikan"), "lembaga_pendidikan"],
        [col("TrxPk.tanggal_pks"), "tanggal_pks"],
        [col("TrxPk.jenjang"), "jenjang"],
        [col("TrxPk.biaya_pendidikan"), "biaya_pendidikan"],
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
        "verifikasi_pengajuan_biaya_pendidikan",
        item.file_daftar_nominatif,
      ),
      file_surat_penagihan: getFileUrl(
        req,
        "verifikasi_pengajuan_biaya_pendidikan",
        item.file_surat_penagihan,
      ),
      file_laporan_kegiatan_semester: getFileUrl(
        req,
        "verifikasi_pengajuan_biaya_pendidikan",
        item.file_laporan_kegiatan_semester,
      ),
      file_sptjm: getFileUrl(
        req,
        "verifikasi_pengajuan_biaya_pendidikan",
        item.file_sptjm,
      ),
      file_bukti_kwitansi: getFileUrl(
        req,
        "verifikasi_pengajuan_biaya_pendidikan",
        item.file_bukti_kwitansi,
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

exports.deleteById = async (req, res) => {
  try {
    const { id_biaya_pendidikan } = req.params;

    const deleted = await TrxBiayaPendidikanPks.destroy({
      where: {
        id: id_biaya_pendidikan,
      },
    });

    await TrxBiayaPendidikan.destroy({
      where: {
        id_trx_biaya_pendidikan_pks: id_biaya_pendidikan,
      },
    });

    const aksiLog = `${req.user.nama} menghapus pengajuan biaya pendidikan`;

    await insertLogPengajuan({
      id_pengajuan: id_biaya_pendidikan,
      section: "biaya_pendidikan",
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
    const { id_biaya_pendidikan } = req.params;
    const { verifikasi, catatan_revisi } = req.body;

    const trx = await TrxBiayaPendidikanPks.findOne({
      where: { id: id_biaya_pendidikan },
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

    await TrxBiayaPendidikanPks.update(
      {
        id_status,
        status,
        id_sub_status,
        sub_status,
        catatan_verifikator: catatanVerifikator,
        verify_by_lp: new Date(),
      },
      {
        where: { id: id_biaya_pendidikan },
      },
    );

    await insertLogPengajuan({
      id_pengajuan: trx.id,
      section: "biaya_pendidikan",
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

    const { daftar_nominatif, sptjm, bukti_kwitansi } = req.files || {};

    // 🔎 Cek data existing
    const exist = await TrxBiayaPendidikanPks.findOne({
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

        file_sptjm: sptjm?.[0]?.filename || exist.file_sptjm,

        file_bukti_kwitansi:
          bukti_kwitansi?.[0]?.filename || exist.file_bukti_kwitansi,

        last_update_lp: new Date(),
        id_status: 4,
        status: "Hasil Perbaikan Lembaga Pendidikan",
        catatan_verifikator: null,
      });

      await insertLogPengajuan({
        id_pengajuan: exist.id,
        section: "biaya_pendidikan",
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
        `Biaya Pendidikan semester ${semester} tahun ${tahun} sudah diajukan`,
        400,
      );
    }

    // 📎 Validasi file wajib (hanya untuk pengajuan baru)
    if (!daftar_nominatif?.[0]) {
      return errorResponse(res, "File daftar nominatif wajib diupload", 400);
    }

    const trxBiayaPendidikan = await TrxBiayaPendidikanPks.create({
      id_trx_pks,
      semester,
      tahun,
      jumlah: jumlah_nominal,
      total_mahasiswa,
      total_mahasiswa_aktif,
      total_mahasiswa_tidak_aktif,

      file_daftar_nominatif: daftar_nominatif[0].filename,
      file_sptjm: sptjm[0].filename,
      file_bukti_kwitansi: bukti_kwitansi[0].filename,

      last_update_lp: new Date(),
      id_status: 1,
      status: "Verifikasi Lembaga Pendidikan",
      diajukan_ke_verifikator_by: req.user.nama,
      diajukan_ke_verifikator_at: new Date(),
    });

    const lastInsertId = trxBiayaPendidikan.id;

    // Update ke mahasiswanya juga

    const mahasiswa = await TrxMahasiswa.findAll({
      where: { id_trx_pks },
    });

    const biayaPendidikanMahasiswa = mahasiswa.map((mhs) => ({
      id_trx_biaya_pendidikan_pks: lastInsertId,
      id_trx_mahasiswa: mhs.id,
      semester,
      tahun,
      nik: mhs.nik,
      jumlah: jumlah_nominal / total_mahasiswa_aktif,
      status_disetujui: "Dalam Proses Kampus",
    }));

    await TrxBiayaPendidikan.bulkCreate(biayaPendidikanMahasiswa);

    // insert log pengajuan
    await insertLogPengajuan({
      id_pengajuan: lastInsertId,
      section: "biaya_pendidikan",
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
    const { id_biaya_pendidikan } = req.params;

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

      aksiLog = `${req.user.nama} meneruskan pengajuan ke BPDP (Verifikator PJK)`;
      ttd = filename;
    } else {
      await TrxBiayaPendidikan.update(
        {
          status_disetujui: "Dalam Proses Kampus",
        },
        {
          where: { id_trx_biaya_pendidikan_pks: id_biaya_pendidikan },
        },
      );

      id_status = 3;
      status = "Revisi Lembaga Pendidikan";
      catatanVerifikator = catatan_revisi;

      aksiLog = `${req.user.nama} mengembalikan pengajuan untuk revisi`;
    }

    await TrxBiayaPendidikanPks.update(
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
      },
      {
        where: {
          id: id_biaya_pendidikan,
        },
      },
    );

    await insertLogPengajuan({
      id_pengajuan: id_biaya_pendidikan,
      section: "biaya_pendidikan",
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
    const { id_biaya_pendidikan } = req.params;

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
      id_sub_status = 4;
      sub_status = "TTD Pimpinan";

      aksiLog = `${req.user.nama} meneruskan pengajuan ke untuk ditandatangani pimpinan (PPK & Bendahara)`;
      ttd = req.file.filename;
    } else {
      id_status = 2;
      status = "Verifikasi BPDP";
      id_sub_status = 1;
      sub_status = "Staff Divisi Beasiswa";
      catatanVerifikator = catatan_revisi;

      aksiLog = `${req.user.nama} mengembalikan pengajuan ke Staff Beasiswa untuk revisi`;
    }

    await TrxBiayaPendidikanPks.update(
      {
        ttd_verifikator_pjk: ttd,
        id_sub_status: id_sub_status,
        sub_status: sub_status,
        id_status: id_status,
        status: status,
      },
      {
        where: {
          id: id_biaya_pendidikan,
        },
      },
    );

    await insertLogPengajuan({
      id_pengajuan: id_biaya_pendidikan,
      section: "biaya_pendidikan",
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
    const { id_biaya_pendidikan } = req.params;

    const log = await LogPengajuan.findAll({
      where: { id_pengajuan: id_biaya_pendidikan, section: "biaya_pendidikan" },
      order: [["timestamp", "ASC"]],
    });

    return successResponse(res, "Data berhasil dimuat", log);
  } catch (error) {
    return errorResponse(res, "Internal Server Error");
  }
};

exports.getTagihanSemesterLalu = async (req, res) => {
  try {
    const { id_biaya_pendidikan } = req.params;

    const biayaPendidikan = await TrxBiayaPendidikanPks.findOne({
      where: { id: id_biaya_pendidikan },
    });

    if (!biayaPendidikan) {
      return errorResponse(res, "Data tidak ditemukan");
    }

    const currentSemester = parseInt(biayaPendidikan.semester);
    const currentYear = biayaPendidikan.tahun;

    // Kalau semester 1, tidak ada semester sebelumnya
    if (!currentSemester || currentSemester === 1) {
      return successResponse(res, "Semester sebelumnya tidak ada", 0);
    }

    const semesterLalu = (currentSemester - 1).toString();

    const biayaSemesterLalu = await TrxBiayaPendidikanPks.findOne({
      where: {
        id_trx_pks: biayaPendidikan.id_trx_pks,
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

exports.ppkBendahara = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id_biaya_pendidikan } = req.params;
    const { actor } = req.body;

    if (!req.file) {
      return errorResponse(res, "File tanda tangan wajib diupload");
    }

    const file_ttd = req.file.filename;

    const data = await TrxBiayaPendidikanPks.findOne({
      where: { id: id_biaya_pendidikan },
      transaction,
    });

    if (!data) {
      return errorResponse(res, "Data biaya pendidikan tidak ditemukan");
    }

    // =====================================
    // Update kolom TTD sesuai actor
    // =====================================
    let updateData = {};

    if (actor === "ppk") {
      updateData.ttd_nominatif_ppk = file_ttd;
      updateData.diverifikasi_ppk_at = new Date();
      updateData.diverifikasi_ppk_by = req.user.nama;
    } else if (actor === "bendahara") {
      updateData.ttd_nominatif_bendahara = file_ttd;
      updateData.diverifikasi_bendahara_at = new Date();
      updateData.diverifikasi_bendahara_by = req.user.nama;
    } else {
      return errorResponse(res, "Actor tidak valid");
    }

    await data.update(updateData, { transaction });
    await data.reload({ transaction });

    // =====================================
    // Cek apakah dua-duanya sudah TTD
    // =====================================
    const isComplete = data.ttd_nominatif_ppk && data.ttd_nominatif_bendahara;

    if (!isComplete) {
      await transaction.commit();

      return successResponse(
        res,
        "Tanda tangan berhasil disimpan, menunggu pihak lainnya",
      );
    }

    // =====================================
    // Kalau sudah lengkap → set selesai
    // =====================================
    await data.update(
      {
        id_status: 5,
        status: "Selesai",
        id_sub_status: null,
        sub_status: null,
      },
      { transaction },
    );

    await TrxBiayaPendidikan.update(
      {
        status_disetujui: "Dalam Proses Pencairan",
      },
      {
        where: { id_trx_biaya_pendidikan_pks: data.id },
      },
    );

    const aksiLog = `${req.user.nama} menyelesaikan pengajuan biaya pendidikan`;

    await LogPengajuan.create(
      {
        id_pengajuan: data.id,
        section: "biaya_pendidikan",
        aksi: aksiLog,
      },
      { transaction },
    );

    await transaction.commit();

    return successResponse(res, "Pengajuan berhasil diselesaikan");
  } catch (error) {
    console.error(error);
    await transaction.rollback();
    return errorResponse(res, "Internal Server Error");
  }
};

exports.getLockData = async (req, res) => {
  try {
    const { id_trx_pks, semester, tahun } = req.body;

    const exist = await TrxBiayaPendidikanPks.findOne({
      where: {
        id_trx_pks,
        semester,
        tahun,
      },
    });

    console.log(exist);

    return successResponse(res, "Data berhasil di-update", exist ? "Y" : "N");
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error", 500);
  }
};

// =============== GENERATE FILE =================

exports.generateRab = async (req, res) => {
  try {
    const { id_biaya_pendidikan } = req.params;

    const biayaPendidikan = await TrxBiayaPendidikanPks.findOne({
      where: { id: id_biaya_pendidikan },
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
        [col("TrxPk.biaya_pendidikan"), "pagu"],
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

    await page.setContent(generateHtmlRab(req, biayaPendidikan), {
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
      "attachment; filename=RAB-Biaya-Pendidikan.pdf",
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
              <td>Biaya Pendidikan Peserta ${data.total_mahasiswa_aktif} org</td>
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
                  <td>Biaya Pendidikan Semester ${data.semester}</td>
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
  const fieldName = `biaya_pendidikan_semester_${semester}_per_mahasiswa`;

  const biayaPendidikan = pks[fieldName];

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
          DAFTAR PEMBIAYAAN PENDIDIKAN SEMESTER ${semester} <br />PESERTA PENERIMA PROGRAM
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
              <th>KABUPATEN</th>
              <th>PROVINSI</th>
              <th>BIAYA PENDIDIKAN SEMESTER ${semester}</th>
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
              <td style="text-align: right">${formatRupiah(biayaPendidikan)}</td>
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

exports.generateSptjm = async (req, res) => {
  try {
    const { id_trx_pks, nominal, total_mahasiswa_aktif } = req.body;

    const trxPks = await TrxPks.findOne({
      where: { id: id_trx_pks },
    });

    if (!trxPks) {
      throw new Error("Data PKS tidak ditemukan");
    }

    // 2️⃣ Ambil id lembaga
    const idLembaga = trxPks.id_lembaga_pendidikan;

    // 3️⃣ Call service master (pakai axios misalnya)
    const { data: perguruanTinggi } = await axios.get(
      `${process.env.MASTER_SERVICE_URL}/perguruan-tinggi/${idLembaga}`,
    );

    // 4️⃣ Gabungkan response
    const result = {
      ...trxPks.toJSON(),
      perguruan_tinggi: perguruanTinggi.data,
    };

    // Helper: font size 12pt = 24 half-points
    const fontSize = 22;
    const fontName = "Times New Roman";

    const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
    const noBorders = {
      top: noBorder,
      bottom: noBorder,
      left: noBorder,
      right: noBorder,
    };

    const run = (text, bold = false) =>
      new TextRun({ text, bold, size: fontSize, font: fontName });

    const para = (children, options = {}) =>
      new Paragraph({
        alignment: AlignmentType.JUSTIFY, // selalu ada
        children: Array.isArray(children) ? children : [run(children)],
        ...options,
      });

    const emptyLine = () =>
      new Paragraph({ children: [new TextRun({ size: fontSize })] });

    const logoKiriPath = result.perguruan_tinggi.logo_path;

    const kopSurat = await kopSuratSptjm(logoKiriPath, result);

    // Tabel identitas tanpa border, kolom kiri label, kolom tengah titik dua, kolom kanan nilai
    const identitasTable = new Table({
      width: { size: 9026, type: WidthType.DXA },
      columnWidths: [3200, 200, 5626],
      borders: {
        top: noBorder,
        bottom: noBorder,
        left: noBorder,
        right: noBorder,
        insideH: noBorder,
        insideV: noBorder,
      },
      rows: [
        identitasRow(
          "Nama Pimpinan/Ketua Lembaga",
          result.perguruan_tinggi.nama_pimpinan ?? "-",
          fontSize,
          fontName,
          noBorders,
        ),
        identitasRow(
          "Nama Lembaga",
          result.perguruan_tinggi.nama_pt ?? "-",
          fontSize,
          fontName,
          noBorders,
        ),
        identitasRow(
          "Alamat Lembaga",
          result.perguruan_tinggi.alamat ?? "-",
          fontSize,
          fontName,
          noBorders,
        ),
      ],
    });

    const doc = new Document({
      styles: {
        default: {
          document: { run: { font: fontName, size: fontSize } },
        },
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 }, // A4
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1800 },
            },
          },
          children: [
            ...kopSurat,

            emptyLine(),

            // JUDUL
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                run("SURAT PERNYATAAN TANGGUNG JAWAB MUTLAK (SPTJM)", true),
              ],
            }),

            emptyLine(),
            para("Yang bertandatangan di bawah ini:"),
            emptyLine(),

            // IDENTITAS (rata kiri karena dalam tabel)
            identitasTable,

            emptyLine(),
            para("Dengan ini menyatakan dengan sesungguhnya bahwa:"),
            emptyLine(),

            // POIN 1
            new Paragraph({
              alignment: AlignmentType.JUSTIFY,
              indent: { left: 360, hanging: 360 },
              children: [
                run(
                  `1.\tSaya bertanggungjawab penuh baik materil maupun non materil atas penggunaan dukungan dana dari Badan Pengelola Dana Perkebunan sebesar ${formatRupiah(nominal)} untuk biaya pendidikan semester (sesuai biaya yang diajukan) ${total_mahasiswa_aktif} peserta sesuai ${result.no_pks} tanggal ${formatTanggalIndo(result.tanggal_pks)}.`,
                ),
              ],
            }),

            emptyLine(),

            // POIN 2
            new Paragraph({
              alignment: AlignmentType.JUSTIFY,
              indent: { left: 360, hanging: 360 },
              children: [
                run(
                  "2.\tApabila dikemudian hari, atas penggunaan dukungan pendanaan dari Badan Pengelola Dana Perkebunan tersebut mengakibatkan kerugian Negara, maka saya bersedia dituntut penggantian kerugian Negara dimaksud sesuai dengan ketentuan peraturan perundang-undangan.",
                ),
              ],
            }),

            emptyLine(),

            // POIN 3
            new Paragraph({
              alignment: AlignmentType.JUSTIFY,
              indent: { left: 360, hanging: 360 },
              children: [
                run(
                  `3.\tBukti-bukti pengeluaran terkait penggunaan dukungan pendanaan dari Badan Pengelola Dana Perkebunan Tahun ${result.tahun_angkatan} disimpan sesuai dengan ketentuan pada penerima dukungan pendanaan untuk kelengkapan administrasi dan keperluan Aparat Pengawas Intern Pemerintah (APIP).`,
                ),
              ],
            }),

            emptyLine(),
            para(
              "Demikian surat pernyataan ini kami buat dengan sebenar-benarnya.",
            ),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    res.setHeader("Content-Disposition", "attachment; filename=SPTJM.docx");
    res.send(buffer);
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error");
  }
};

function identitasRow(label, value, fontSize, fontName, noBorders) {
  const cellPara = (text) =>
    new Paragraph({
      spacing: { after: 100 }, // kasih jarak antar baris
      children: [new TextRun({ text, size: fontSize, font: fontName })],
    });

  const valueLines = value.split("\n");
  const valueParagraphs = valueLines.map((line) => cellPara(line));

  const cellMargin = {
    top: 20,
    bottom: 20,
    left: 40, // <-- ini bikin gak mepet kiri
    right: 40, // <-- ini bikin gak mepet kanan
  };

  return new TableRow({
    children: [
      new TableCell({
        borders: noBorders,
        margins: cellMargin, // <-- TAMBAHKAN INI
        width: { size: 3200, type: WidthType.DXA },
        children: [cellPara(label)],
      }),
      new TableCell({
        borders: noBorders,
        margins: cellMargin,
        width: { size: 200, type: WidthType.DXA },
        children: [cellPara(":")],
      }),
      new TableCell({
        borders: noBorders,
        margins: cellMargin,
        width: { size: 5626, type: WidthType.DXA },
        children: valueParagraphs,
      }),
    ],
  });
}

async function kopSuratSptjm(logoKiriPath, data) {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const noBorders = {
    top: noBorder,
    bottom: noBorder,
    left: noBorder,
    right: noBorder,
    insideH: noBorder,
    insideV: noBorder,
  };

  const cellNoBorder = {
    top: noBorder,
    bottom: noBorder,
    left: noBorder,
    right: noBorder,
  };

  const logoKiri = await getImageBufferFromUrl(logoKiriPath);
  const logoKanan = await getImageBufferFromUrl(
    "https://dev-palma.my.id/svc-auth/uploads/kemendikbud.png",
  );

  // Teks kop bagian tengah
  const teksKop = new TableCell({
    borders: cellNoBorder,
    width: { size: 7000, type: WidthType.DXA },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "KEMENTERIAN PENDIDIKAN TINGGI, SAINS DAN TEKNOLOGI",
            size: 20,
            font: "Times New Roman",
            bold: true,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "YAYASAN PENDIDIKAN TINGGI KABUPATEN BOMBANA",
            size: 20,
            font: "Times New Roman",
            bold: true,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: data.perguruan_tinggi.nama_pt ?? "-",
            bold: true,
            size: 32,
            font: "Times New Roman",
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: data.perguruan_tinggi.alamat ?? "-",
            size: 18,
            font: "Times New Roman",
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `Prov. Sulawesi Tenggara -${data.perguruan_tinggi.kode_pos ?? "-"}; Telepon : ${data.perguruan_tinggi.no_telepon_pt ?? "-"}`,
            size: 18,
            font: "Times New Roman",
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `Website : ${data.perguruan_tinggi.website ?? "-"} | Email : ${data.perguruan_tinggi.email ?? "-"}`,
            size: 18,
            font: "Times New Roman",
          }),
        ],
      }),
    ],
  });

  const kopTable = new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [1013, 7000, 1013],
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          // Logo kiri
          new TableCell({
            borders: cellNoBorder,
            width: { size: 1013, type: WidthType.DXA },
            verticalAlign: "center",
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new ImageRun({
                    type: "png",
                    data: logoKiri,
                    transformation: { width: 80, height: 80 },
                    altText: {
                      title: "Logo Kemendikbud",
                      description: "Logo",
                      name: "LogoKiri",
                    },
                  }),
                ],
              }),
            ],
          }),
          // Teks tengah
          teksKop,
          // Logo kanan
          new TableCell({
            borders: cellNoBorder,
            width: { size: 1013, type: WidthType.DXA },
            verticalAlign: "center",
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new ImageRun({
                    type: "png",
                    data: logoKanan,
                    transformation: { width: 80, height: 80 },
                    altText: {
                      title: "Logo Polina",
                      description: "Logo",
                      name: "LogoKanan",
                    },
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Garis bawah kop (double border)
  const garisBawah = new Paragraph({
    border: {
      bottom: { style: BorderStyle.DOUBLE, size: 6, color: "000000", space: 1 },
    },
    children: [new TextRun("")],
  });

  return [kopTable, garisBawah];
}

exports.generateBuktiKwitansi = async (req, res) => {
  try {
    const { id_trx_pks, nominal, total_mahasiswa_aktif, semester } = req.body;

    const trxPks = await TrxPks.findOne({
      where: { id: id_trx_pks },
    });

    if (!trxPks) {
      throw new Error("Data PKS tidak ditemukan");
    }

    // 4️⃣ Gabungkan response
    const result = {
      ...trxPks.toJSON(),
    };

    // Helper: font size 12pt = 24 half-points
    const fontSize = 22;
    const fontName = "Times New Roman";

    const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
    const noBorders = {
      top: noBorder,
      bottom: noBorder,
      left: noBorder,
      right: noBorder,
    };

    const run = (text, bold = false) =>
      new TextRun({ text, bold, size: fontSize, font: fontName });

    const para = (children, options = {}) =>
      new Paragraph({
        alignment: AlignmentType.JUSTIFY, // selalu ada
        children: Array.isArray(children) ? children : [run(children)],
        ...options,
      });

    const emptyLine = () =>
      new Paragraph({ children: [new TextRun({ size: fontSize })] });

    const kopSurat = await kopSuratBuktiKwitansi();

    const lampiranTable = new Table({
      width: {
        size: 6000, // lebih kecil dari 9026
        type: WidthType.DXA,
      },
      alignment: AlignmentType.CENTER, // <-- supaya di tengah
      columnWidths: [2000, 200, 3800], // sesuaikan proporsinya
      borders: {
        top: noBorder,
        bottom: noBorder,
        left: noBorder,
        right: noBorder,
        insideH: noBorder,
        insideV: noBorder,
      },
      rows: [
        identitasRow("TAHUN ANGGARAN", "2026", fontSize, fontName, noBorders),
        identitasRow("NOMOR BUKTI", "", fontSize, fontName, noBorders),
        identitasRow(
          "MATA ANGGARAN",
          "4712.FAM.006.100.D.525117",
          fontSize,
          fontName,
          noBorders,
        ),
      ],
    });

    // Tabel identitas tanpa border, kolom kiri label, kolom tengah titik dua, kolom kanan nilai
    const infoTable = new Table({
      width: { size: 9026, type: WidthType.DXA },
      columnWidths: [3200, 200, 5626],
      borders: {
        top: noBorder,
        bottom: noBorder,
        left: noBorder,
        right: noBorder,
        insideH: noBorder,
        insideV: noBorder,
      },
      rows: [
        identitasRow(
          "Sudah terima dari",
          "PEJABAT PEMBUAT KOMITMEN BADAN PENGELOLA DANA PERKEBUNAN",
          fontSize,
          fontName,
          noBorders,
        ),
        identitasRow(
          "Jumlah Uang",
          formatRupiah(nominal),
          fontSize,
          fontName,
          noBorders,
        ),
        identitasRow(
          "Terbilang",
          terbilang(nominal) + " rupiah",
          fontSize,
          fontName,
          noBorders,
        ),
        identitasRow(
          "Untuk Pembayaran",
          `Biaya Pendidikan Semester ${semester} (${terbilang(semester)}) sebanyak ${total_mahasiswa_aktif} Mahasiswa Program ${result.jenjang} angkatan ${result.tahun_angkatan} sesuai surat perjanjian kerjasama nomor: ${result.no_pks} tanggal ${formatTanggalIndo(result.tanggal_pks)}`,
          fontSize,
          fontName,
          noBorders,
        ),
      ],
    });

    const doc = new Document({
      styles: {
        default: {
          document: { run: { font: fontName, size: fontSize } },
        },
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 }, // A4
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1800 },
            },
          },
          children: [
            ...kopSurat,

            emptyLine(),

            lampiranTable,

            emptyLine(),

            // JUDUL
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [run("KUITANSI/BUKTI PEMBAYARAN", true)],
            }),

            emptyLine(),

            // IDENTITAS (rata kiri karena dalam tabel)
            infoTable,
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    res.setHeader("Content-Disposition", "attachment; filename=SPTJM.docx");
    res.send(buffer);
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error");
  }
};

async function kopSuratBuktiKwitansi() {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const noBorders = {
    top: noBorder,
    bottom: noBorder,
    left: noBorder,
    right: noBorder,
    insideH: noBorder,
    insideV: noBorder,
  };

  const cellNoBorder = {
    top: noBorder,
    bottom: noBorder,
    left: noBorder,
    right: noBorder,
  };

  const logoKiri = await getImageBufferFromUrl(
    "https://dev-palma.my.id/svc-auth/uploads/kemenkeu.png",
  );

  // Teks kop bagian tengah
  const teksKop = new TableCell({
    borders: cellNoBorder,
    width: { size: 7000, type: WidthType.DXA },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "KEMENTERIAN KEUANGAN REPUBLIK INDONESIA",
            size: 28,
            font: "Times New Roman",
            bold: true,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "DIREKTORAT JENDERAL PERBENDAHARAAN",
            size: 28,
            font: "Times New Roman",
            bold: true,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "BADAN PENGELOLA DANA PERKEBUNAN",
            bold: true,
            size: 24,
            font: "Times New Roman",
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "GEDUNG SURACHMAN TJOKRODISURJO, JL. Medan Merdeka Timur No. 16, Jakarta Pusat 10110",
            size: 20,
            font: "Times New Roman",
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "Telp. (021) 84283099 Situs: www.bpdp.or.id",
            size: 20,
            font: "Times New Roman",
          }),
        ],
      }),
    ],
  });

  const kopTable = new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [1013, 7000, 1013],
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          // Logo kiri
          new TableCell({
            borders: cellNoBorder,
            width: { size: 1013, type: WidthType.DXA },
            verticalAlign: "center",
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new ImageRun({
                    type: "png",
                    data: logoKiri,
                    transformation: { width: 80, height: 80 },
                    altText: {
                      title: "Logo Kemenkeu",
                      description: "Logo",
                      name: "LogoKiri",
                    },
                  }),
                ],
              }),
            ],
          }),
          // Teks tengah
          teksKop,
        ],
      }),
    ],
  });

  // Garis bawah kop (double border)
  const garisBawah = new Paragraph({
    border: {
      bottom: { style: BorderStyle.DOUBLE, size: 6, color: "000000", space: 1 },
    },
    children: [new TextRun("")],
  });

  return [kopTable, garisBawah];
}
// =============== GENERATE FILE =================
