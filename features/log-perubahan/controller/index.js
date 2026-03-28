const { default: axios } = require("axios");
const { getFileUrl } = require("../../../common/middleware/upload_middleware");
const { successResponse, errorResponse } = require("../../../common/response");
const { sequelize } = require("../../../core/db_config");
const {
  LogPerubahanRekening,
  TrxMahasiswa,
  LogPerubahanStatusAktif,
  LogPerubahanIpk,
  TrxIpk,
  LogPerubahanProfilLembaga,
} = require("../../../models");
const { safeSplit } = require("../../../utils/stringFormatter");

const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

exports.getLogRekening = async (req, res) => {
  try {
    const { id_mahasiswa } = req.params;

    const rows = await LogPerubahanRekening.findAll({
      where: { id_mahasiswa },
      raw: true,
    });

    const mappedRows = rows.map((item) => ({
      ...item,
      scan_buku_tabungan_sebelumnya: getFileUrl(
        req,
        "scan_buku_tabungan",
        item.scan_buku_tabungan_sebelumnya,
      ),
      scan_buku_tabungan_pengganti: getFileUrl(
        req,
        "scan_buku_tabungan",
        item.scan_buku_tabungan_pengganti,
      ),
    }));

    return successResponse(res, "Data berhasil dimuat", mappedRows);
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.postRekening = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      id_mahasiswa,
      id_trx_pks,
      nama_bank,
      nomor_rekening,
      nama_rekening,
    } = req.body;

    const mahasiswa = await TrxMahasiswa.findByPk(id_mahasiswa, {
      transaction: t,
    });

    if (!mahasiswa) {
      await t.rollback();
      return errorResponse(res, "Data mahasiswa tidak ditemukan", 404);
    }

    const perubahan = {};

    // =========================
    // CEK PERUBAHAN
    // =========================

    if (nama_bank && nama_bank !== mahasiswa.bank) {
      const [kodeBank, namaBank] = safeSplit(nama_bank);
      perubahan.nama_bank_sebelumnya = mahasiswa.bank;
      perubahan.nama_bank_pengganti = namaBank;
      perubahan.kode_bank_sebelumnya = mahasiswa.kode_bank;
      perubahan.kode_bank_pengganti = kodeBank;
    }

    if (nomor_rekening && nomor_rekening !== mahasiswa.no_rekening) {
      perubahan.nomor_rekening_sebelumnya = mahasiswa.no_rekening;
      perubahan.nomor_rekening_pengganti = nomor_rekening;
    }

    if (nama_rekening && nama_rekening !== mahasiswa.nama_rekening) {
      perubahan.nama_rekening_sebelumnya = mahasiswa.nama_rekening;
      perubahan.nama_rekening_pengganti = nama_rekening;
    }

    if (req.file) {
      perubahan.scan_buku_tabungan_sebelumnya =
        mahasiswa.file_scan_buku_tabungan;
      perubahan.scan_buku_tabungan_pengganti = req.file.filename;
    }

    if (Object.keys(perubahan).length === 0) {
      await t.rollback();
      return successResponse(res, "Tidak ada perubahan data");
    }

    // =========================
    // INSERT LOG
    // =========================
    await LogPerubahanRekening.create(
      {
        id_mahasiswa,
        id_trx_pks,
        ...perubahan,
        created_at: new Date(),
        created_by: req.user.nama,
        status: "Pending",
      },
      { transaction: t },
    );

    // =========================
    // UPDATE FLAG MAHASISWA
    // =========================

    await mahasiswa.update({ has_perubahan_rekening: 1 }, { transaction: t });

    await t.commit();

    return successResponse(
      res,
      "Perubahan rekening berhasil diajukan dan menunggu verifikasi",
    );
  } catch (error) {
    await t.rollback();
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.verifikasiPerubahanRekening = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id_log } = req.params;
    const verified_by = req.user.nama;

    const { status, catatan } = req.body;

    const log = await LogPerubahanRekening.findByPk(id_log, { transaction: t });

    if (!log) {
      await t.rollback();
      return errorResponse(res, "Log tidak ditemukan", 404);
    }

    const mahasiswa = await TrxMahasiswa.findByPk(log.id_mahasiswa, {
      transaction: t,
    });

    if (!mahasiswa) {
      await t.rollback();
      return errorResponse(res, "Mahasiswa tidak ditemukan", 404);
    }

    // =============================
    // UPDATE DATA MAHASISWA
    // =============================

    await mahasiswa.update(
      {
        ...(status === "Disetujui" && {
          bank: log.nama_bank_pengganti ?? mahasiswa.bank,
          kode_bank: log.kode_bank_pengganti ?? mahasiswa.kode_bank,
          no_rekening: log.nomor_rekening_pengganti ?? mahasiswa.no_rekening,
          nama_rekening: log.nama_rekening_pengganti ?? mahasiswa.nama_rekening,
          file_scan_buku_tabungan:
            log.scan_buku_tabungan_pengganti ??
            mahasiswa.file_scan_buku_tabungan,
        }),
        has_perubahan_rekening: 0,
      },
      { transaction: t },
    );

    // =============================
    // INSERT LOG BARU (JEJAK VERIFIKASI)
    // =============================

    await LogPerubahanRekening.update(
      {
        id_trx_pks: log.id_trx_pks,
        id_mahasiswa: log.id_mahasiswa,

        nama_bank_sebelumnya: log.nama_bank_sebelumnya,
        nama_bank_pengganti: log.nama_bank_pengganti,

        nomor_rekening_sebelumnya: log.nomor_rekening_sebelumnya,
        nomor_rekening_pengganti: log.nomor_rekening_pengganti,

        nama_rekening_sebelumnya: log.nama_rekening_sebelumnya,
        nama_rekening_pengganti: log.nama_rekening_pengganti,

        scan_buku_tabungan_sebelumnya: log.scan_buku_tabungan_sebelumnya,
        scan_buku_tabungan_pengganti: log.scan_buku_tabungan_pengganti,

        verified_by: verified_by,
        verified_at: new Date(),
        status: status,
        catatan: catatan,
      },
      { where: { id: id_log }, transaction: t },
    );

    await t.commit();

    return successResponse(res, "Perubahan berhasil diverifikasi");
  } catch (error) {
    await t.rollback();
    return errorResponse(res, "Internal Server Error");
  }
};

exports.setujuiSemuaPerubahanRekening = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const verified_by = req.user.nama;

    const status = "Disetujui";
    const catatan = "";

    // ambil semua log yang belum diverifikasi
    const logs = await LogPerubahanRekening.findAll({
      where: { status: "Pending" },
      transaction: t,
    });

    if (!logs.length) {
      await t.rollback();
      return errorResponse(
        res,
        "Tidak ada data perubahan yang perlu diverifikasi",
      );
    }

    for (const log of logs) {
      const mahasiswa = await TrxMahasiswa.findByPk(log.id_mahasiswa, {
        transaction: t,
      });

      if (!mahasiswa) continue;

      // =============================
      // UPDATE DATA MAHASISWA
      // =============================
      await mahasiswa.update(
        {
          ...(status === "Disetujui" && {
            bank: log.nama_bank_pengganti ?? mahasiswa.bank,
            kode_bank: log.kode_bank_pengganti ?? mahasiswa.kode_bank,
            no_rekening: log.nomor_rekening_pengganti ?? mahasiswa.no_rekening,
            nama_rekening:
              log.nama_rekening_pengganti ?? mahasiswa.nama_rekening,
            file_scan_buku_tabungan:
              log.scan_buku_tabungan_pengganti ??
              mahasiswa.file_scan_buku_tabungan,
          }),
          has_perubahan_rekening: 0,
        },
        { transaction: t },
      );

      // =============================
      // UPDATE LOG
      // =============================
      await LogPerubahanRekening.update(
        {
          verified_by: verified_by,
          verified_at: new Date(),
          status: status,
          catatan: catatan,
        },
        {
          where: { id: log.id },
          transaction: t,
        },
      );
    }

    await t.commit();

    return successResponse(
      res,
      `${logs.length} perubahan rekening berhasil diverifikasi`,
    );
  } catch (error) {
    console.log(error);
    await t.rollback();
    return errorResponse(res, "Internal Server Error");
  }
};

exports.getLogStatusAktif = async (req, res) => {
  try {
    const { id_mahasiswa } = req.params;

    const rows = await LogPerubahanStatusAktif.findAll({
      where: { id_mahasiswa },
      raw: true,
    });

    const mappedRows = rows.map((item) => ({
      ...item,
      file_pendukung_sebelumnya: getFileUrl(
        req,
        "file_pendukung",
        item.file_pendukung_sebelumnya,
      ),
      file_pendukung_pengganti: getFileUrl(
        req,
        "file_pendukung",
        item.file_pendukung_pengganti,
      ),
    }));

    return successResponse(res, "Data berhasil dimuat", mappedRows);
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.postStatusAktif = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      id_mahasiswa,
      id_trx_pks,
      status_aktif,
      alasan_tidak_aktif,
      keterangan_tidak_aktif,
    } = req.body;

    const mahasiswa = await TrxMahasiswa.findByPk(id_mahasiswa, {
      transaction: t,
    });

    if (!mahasiswa) {
      await t.rollback();
      return errorResponse(res, "Data mahasiswa tidak ditemukan", 404);
    }

    const perubahan = {};

    // =========================
    // CEK PERUBAHAN STATUS
    // =========================

    const statusAktifBaru = Number(status_aktif);

    if (statusAktifBaru !== mahasiswa.status) {
      perubahan.status_aktif_sebelumnya = mahasiswa.status;
      perubahan.status_aktif_pengganti = statusAktifBaru;
    }

    // Jika tidak aktif, simpan alasan & file
    if (statusAktifBaru === 0) {
      const [idAlasanTidakAktif, namaAlasanTidakAktif] =
        safeSplit(alasan_tidak_aktif);

      perubahan.id_alasan_tidak_aktif_sebelumnya =
        mahasiswa.id_alasan_tidak_aktif;
      perubahan.id_alasan_tidak_aktif_pengganti = idAlasanTidakAktif;
      perubahan.alasan_tidak_aktif_sebelumnya = mahasiswa.alasan_tidak_aktif;
      perubahan.alasan_tidak_aktif_pengganti = namaAlasanTidakAktif;

      perubahan.keterangan_tidak_aktif_sebelumnya =
        mahasiswa.keterangan_tidak_aktif;
      perubahan.keterangan_tidak_aktif_pengganti = keterangan_tidak_aktif;

      if (req.file) {
        perubahan.file_pendukung_sebelumnya = mahasiswa.file_pendukung;
        perubahan.file_pendukung_pengganti = req.file.filename;
      }
    }

    if (Object.keys(perubahan).length === 0) {
      await t.rollback();
      return successResponse(res, "Tidak ada perubahan data");
    }

    // =========================
    // INSERT LOG
    // =========================
    await LogPerubahanStatusAktif.create(
      {
        id_mahasiswa,
        id_trx_pks,
        ...perubahan,
        created_at: new Date(),
        created_by: req.user.nama,
        status: "Pending",
      },
      { transaction: t },
    );

    // =========================
    // UPDATE FLAG MAHASISWA
    // =========================
    await mahasiswa.update(
      { has_perubahan_status_aktif: 1 },
      { transaction: t },
    );

    await t.commit();

    return successResponse(
      res,
      "Perubahan status aktif berhasil diajukan dan menunggu verifikasi",
    );
  } catch (error) {
    await t.rollback();
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.verifikasiPerubahanStatusAktif = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id_log } = req.params;
    const { status, catatan } = req.body;
    const verified_by = req.user.nama;

    const log = await LogPerubahanStatusAktif.findByPk(id_log, {
      transaction: t,
    });

    if (!log) {
      await t.rollback();
      return errorResponse(res, "Log tidak ditemukan", 404);
    }

    if (log.status !== "Pending") {
      await t.rollback();
      return errorResponse(res, "Log sudah diverifikasi sebelumnya");
    }

    const mahasiswa = await TrxMahasiswa.findByPk(log.id_mahasiswa, {
      transaction: t,
    });

    if (!mahasiswa) {
      await t.rollback();
      return errorResponse(res, "Mahasiswa tidak ditemukan", 404);
    }

    // =============================
    // UPDATE DATA MAHASISWA JIKA DISETUJUI
    // =============================

    if (status === "Disetujui") {
      await mahasiswa.update(
        {
          status: log.status_aktif_pengganti ?? mahasiswa.status,

          id_alasan_tidak_aktif:
            log.id_alasan_tidak_aktif_pengganti ??
            mahasiswa.id_alasan_tidak_aktif,

          alasan_tidak_aktif:
            log.alasan_tidak_aktif_pengganti ?? mahasiswa.alasan_tidak_aktif,

          keterangan_tidak_aktif:
            log.keterangan_tidak_aktif_pengganti ??
            mahasiswa.keterangan_tidak_aktif,

          file_pendukung:
            log.file_pendukung_pengganti ?? mahasiswa.file_pendukung,

          has_perubahan_status_aktif: 0,
        },
        { transaction: t },
      );
    } else {
      // Jika ditolak, hanya reset flag
      await mahasiswa.update(
        { has_perubahan_status_aktif: 0 },
        { transaction: t },
      );
    }

    // =============================
    // UPDATE LOG (JEJAK VERIFIKASI)
    // =============================

    await log.update(
      {
        verified_by,
        verified_at: new Date(),
        status,
        catatan,
      },
      { transaction: t },
    );

    await t.commit();

    return successResponse(res, "Perubahan status aktif berhasil diverifikasi");
  } catch (error) {
    await t.rollback();
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.setujuiSemuaPerubahanStatusAktif = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const status = "Disetujui";
    const catatan = "";
    const verified_by = req.user.nama;

    const logs = await LogPerubahanStatusAktif.findAll({
      where: { status: "Pending" },
      transaction: t,
    });

    if (!logs.length) {
      await t.rollback();
      return errorResponse(res, "Tidak ada log yang perlu diverifikasi");
    }

    for (const log of logs) {
      const mahasiswa = await TrxMahasiswa.findByPk(log.id_mahasiswa, {
        transaction: t,
      });

      if (!mahasiswa) continue;

      // =============================
      // UPDATE DATA MAHASISWA
      // =============================

      if (status === "Disetujui") {
        await mahasiswa.update(
          {
            status: log.status_aktif_pengganti ?? mahasiswa.status,

            id_alasan_tidak_aktif:
              log.id_alasan_tidak_aktif_pengganti ??
              mahasiswa.id_alasan_tidak_aktif,

            alasan_tidak_aktif:
              log.alasan_tidak_aktif_pengganti ?? mahasiswa.alasan_tidak_aktif,

            keterangan_tidak_aktif:
              log.keterangan_tidak_aktif_pengganti ??
              mahasiswa.keterangan_tidak_aktif,

            file_pendukung:
              log.file_pendukung_pengganti ?? mahasiswa.file_pendukung,

            has_perubahan_status_aktif: 0,
          },
          { transaction: t },
        );
      } else {
        await mahasiswa.update(
          { has_perubahan_status_aktif: 0 },
          { transaction: t },
        );
      }

      // =============================
      // UPDATE LOG
      // =============================

      await log.update(
        {
          verified_by,
          verified_at: new Date(),
          status,
          catatan,
        },
        { transaction: t },
      );
    }

    await t.commit();

    return successResponse(
      res,
      `${logs.length} perubahan status aktif berhasil diverifikasi`,
    );
  } catch (error) {
    await t.rollback();
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.getLogIpk = async (req, res) => {
  try {
    const { id_mahasiswa } = req.params;

    const rows = await LogPerubahanIpk.findAll({
      where: { id_mahasiswa },
      raw: true,
    });

    return successResponse(res, "Data berhasil dimuat", rows);
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.postIpk = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id_mahasiswa, id_trx_pks, data } = req.body;

    // ===============================
    // VALIDASI BASIC
    // ===============================
    if (!id_mahasiswa || !Array.isArray(data)) {
      await t.rollback();
      return errorResponse(res, "Payload tidak valid", 400);
    }

    // ===============================
    // CEK MAHASISWA
    // ===============================
    const mahasiswa = await TrxMahasiswa.findByPk(id_mahasiswa, {
      transaction: t,
    });

    if (!mahasiswa) {
      await t.rollback();
      return errorResponse(res, "Data mahasiswa tidak ditemukan", 404);
    }

    // ===============================
    // AMBIL IPK LAMA
    // ===============================
    const dataIpk = await TrxIpk.findAll({
      where: { id_trx_mahasiswa: id_mahasiswa },
      transaction: t,
    });

    // Mapping jadi object { semester: nilai }
    const ipkLamaMap = {};
    dataIpk.forEach((item) => {
      ipkLamaMap[item.semester] = parseFloat(item.nilai);
    });

    const perubahanList = [];

    // ===============================
    // LOOP DATA DARI FRONTEND
    // ===============================
    for (const item of data) {
      const semester = item.semester;
      const nilaiBaru = parseFloat(item.nilai);
      const nilaiLama = ipkLamaMap[semester] ?? null;

      if (nilaiBaru !== nilaiLama) {
        perubahanList.push({
          semester,
          nilai_sebelumnya: nilaiLama,
          nilai_pengganti: nilaiBaru,
        });
      }
    }

    // ===============================
    // CEK ADA PERUBAHAN
    // ===============================
    if (perubahanList.length === 0) {
      await t.rollback();
      return successResponse(res, "Tidak ada perubahan IPK");
    }

    // ===============================
    // INSERT LOG PER SEMESTER
    // ===============================
    const logData = {
      id_mahasiswa,
      id_trx_pks,
      status: "Pending",
      created_by: req.user.nama,
      created_at: new Date(),
    };

    // isi kolom sesuai semester yang berubah
    for (const perubahan of perubahanList) {
      const s = perubahan.semester;

      logData[`ipk_s${s}_sebelumnya`] = perubahan.nilai_sebelumnya;
      logData[`ipk_s${s}_pengganti`] = perubahan.nilai_pengganti;
    }

    // ===============================
    // INSERT 1 ROW SAJA
    // ===============================
    await LogPerubahanIpk.create(logData, { transaction: t });

    await TrxMahasiswa.update(
      { has_perubahan_ipk: 1 },
      { where: { id: id_mahasiswa }, transaction: t },
    );

    await t.commit();

    return successResponse(
      res,
      "Perubahan IPK berhasil diajukan dan menunggu verifikasi",
    );
  } catch (error) {
    await t.rollback();
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.verifikasiPerubahanIpk = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id_log } = req.params;
    const { status, catatan } = req.body;
    const verified_by = req.user.nama;

    if (!["Disetujui", "Ditolak"].includes(status)) {
      await t.rollback();
      return errorResponse(res, "Status tidak valid", 400);
    }

    const log = await LogPerubahanIpk.findByPk(id_log, {
      transaction: t,
    });

    if (!log) {
      await t.rollback();
      return errorResponse(res, "Log tidak ditemukan", 404);
    }

    if (log.status !== "Pending") {
      await t.rollback();
      return errorResponse(res, "Log sudah diverifikasi sebelumnya");
    }

    const mahasiswa = await TrxMahasiswa.findByPk(log.id_mahasiswa, {
      transaction: t,
    });

    if (!mahasiswa) {
      await t.rollback();
      return errorResponse(res, "Mahasiswa tidak ditemukan", 404);
    }

    // ====================================================
    // JIKA DISETUJUI → UPDATE trx_ipk
    // ====================================================
    if (status === "Disetujui") {
      for (let i = 1; i <= 8; i++) {
        const ipkBaru = log.get(`ipk_s${i}_pengganti`);

        if (ipkBaru !== null && ipkBaru !== undefined) {
          const existing = await TrxIpk.findOne({
            where: {
              id_trx_mahasiswa: log.id_mahasiswa,
              semester: i,
            },
            transaction: t,
          });

          if (existing) {
            await existing.update({ nilai: ipkBaru }, { transaction: t });
          } else {
            await TrxIpk.create(
              {
                id_trx_mahasiswa: log.id_mahasiswa,
                semester: i,
                nilai: ipkBaru,
              },
              { transaction: t },
            );
          }
        }
      }
    }

    // ====================================================
    // RESET FLAG (jika memang ada field ini)
    // ====================================================
    await mahasiswa.update({ has_perubahan_ipk: 0 }, { transaction: t });

    // ====================================================
    // UPDATE LOG (JEJAK VERIFIKASI)
    // ====================================================
    await log.update(
      {
        verified_by,
        verified_at: new Date(),
        status,
        catatan: catatan ?? null,
      },
      { transaction: t },
    );

    await t.commit();

    return successResponse(res, "Perubahan IPK berhasil diverifikasi");
  } catch (error) {
    await t.rollback();
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.setujuiSemuaPerubahanIpk = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const status = "Disetujui";
    const catatan = "";
    const verified_by = req.user.nama;

    if (!["Disetujui", "Ditolak"].includes(status)) {
      await t.rollback();
      return errorResponse(res, "Status tidak valid", 400);
    }

    const logs = await LogPerubahanIpk.findAll({
      where: { status: "Pending" },
      transaction: t,
    });

    if (!logs.length) {
      await t.rollback();
      return errorResponse(
        res,
        "Tidak ada log perubahan IPK yang perlu diverifikasi",
      );
    }

    for (const log of logs) {
      const mahasiswa = await TrxMahasiswa.findByPk(log.id_mahasiswa, {
        transaction: t,
      });

      if (!mahasiswa) continue;

      // ====================================================
      // JIKA DISETUJUI → UPDATE trx_ipk
      // ====================================================
      if (status === "Disetujui") {
        for (let i = 1; i <= 8; i++) {
          const ipkBaru = log.get(`ipk_s${i}_pengganti`);

          if (ipkBaru !== null && ipkBaru !== undefined) {
            const existing = await TrxIpk.findOne({
              where: {
                id_trx_mahasiswa: log.id_mahasiswa,
                semester: i,
              },
              transaction: t,
            });

            if (existing) {
              await existing.update({ nilai: ipkBaru }, { transaction: t });
            } else {
              await TrxIpk.create(
                {
                  id_trx_mahasiswa: log.id_mahasiswa,
                  semester: i,
                  nilai: ipkBaru,
                },
                { transaction: t },
              );
            }
          }
        }
      }

      // ====================================================
      // RESET FLAG
      // ====================================================
      await mahasiswa.update({ has_perubahan_ipk: 0 }, { transaction: t });

      // ====================================================
      // UPDATE LOG
      // ====================================================
      await log.update(
        {
          verified_by,
          verified_at: new Date(),
          status,
          catatan: catatan ?? null,
        },
        { transaction: t },
      );
    }

    await t.commit();

    return successResponse(
      res,
      `${logs.length} perubahan IPK berhasil diverifikasi`,
    );
  } catch (error) {
    await t.rollback();
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.getLogPt = async (req, res) => {
  try {
    const { id_pt } = req.params;

    const rows = await LogPerubahanProfilLembaga.findAll({
      where: { id_lembaga_pendidikan: id_pt },
    });

    const formatted = rows.map((item) => {
      const plain = item.toJSON();

      return {
        ...plain,
        logo_pengganti: plain.logo_pengganti
          ? getFileUrl(req, "logo_perguruan_tinggi", plain.logo_pengganti)
          : null,
        logo_sebelumnya: plain.logo_sebelumnya
          ? getFileUrl(req, "logo_perguruan_tinggi", plain.logo_sebelumnya)
          : null,
      };
    });

    return successResponse(res, "Data berhasil dimuat", formatted);
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.postPt = async (req, res) => {
  const t = await sequelize.transaction();
  const { id_pt } = req.params;

  try {
    const {
      nama_pt,
      kode_pt,
      singkatan,
      alamat,
      jenis,
      no_telepon_pt,
      fax_pt,
      kota,
      kode_pos,
      email,
      website,
      nama_pimpinan,
      jabatan_pimpinan,
      no_telepon_pimpinan,
      no_rekening,
      nama_bank,
      nama_penerima_transfer,
      npwp,
    } = req.body;

    const file = req.file;

    // =========================
    // GET DATA LAMA
    // =========================
    const { data: ptResponse } = await axios.get(
      `${process.env.MASTER_SERVICE_URL}/perguruan-tinggi/${id_pt}`,
    );

    if (!ptResponse || !ptResponse.data) {
      await t.rollback();
      return errorResponse(res, "Data perguruan tinggi tidak ditemukan", 404);
    }

    const ptLama = ptResponse.data;

    const perubahan = {};

    // =========================
    // CEK PERUBAHAN FIELD
    // =========================
    if (nama_pt && nama_pt !== ptLama.nama_pt) {
      perubahan.nama_sebelumnya = ptLama.nama_pt;
      perubahan.nama_pengganti = nama_pt;
    }

    if (kode_pt && kode_pt !== ptLama.kode_pt) {
      perubahan.kode_sebelumnya = ptLama.kode_pt;
      perubahan.kode_pengganti = kode_pt;
    }

    if (singkatan && singkatan !== ptLama.singkatan) {
      perubahan.singkatan_sebelumnya = ptLama.singkatan;
      perubahan.singkatan_pengganti = singkatan;
    }

    if (jenis && jenis !== ptLama.jenis) {
      perubahan.jenis_sebelumnya = ptLama.jenis;
      perubahan.jenis_pengganti = jenis;
    }

    if (alamat && alamat !== ptLama.alamat) {
      perubahan.alamat_sebelumnya = ptLama.alamat;
      perubahan.alamat_pengganti = alamat;
    }

    if (kota && kota !== ptLama.kota) {
      perubahan.kota_sebelumnya = ptLama.kota;
      perubahan.kota_pengganti = kota;
    }

    if (kode_pos && kode_pos !== ptLama.kode_pos) {
      perubahan.kode_pos_sebelumnya = ptLama.kode_pos;
      perubahan.kode_pos_pengganti = kode_pos;
    }

    if (no_telepon_pt && no_telepon_pt !== ptLama.no_telepon_pt) {
      perubahan.no_telepon_sebelumnya = ptLama.no_telepon_pt;
      perubahan.no_telepon_pengganti = no_telepon_pt;
    }

    if (fax_pt && fax_pt !== ptLama.fax_pt) {
      perubahan.fax_sebelumnya = ptLama.fax_pt;
      perubahan.fax_pengganti = fax_pt;
    }

    if (email && email !== ptLama.email) {
      perubahan.email_sebelumnya = ptLama.email;
      perubahan.email_pengganti = email;
    }

    if (website && website !== ptLama.website) {
      perubahan.website_sebelumnya = ptLama.website;
      perubahan.website_pengganti = website;
    }

    if (nama_pimpinan && nama_pimpinan !== ptLama.nama_pimpinan) {
      perubahan.nama_pimpinan_sebelumnya = ptLama.nama_pimpinan;
      perubahan.nama_pimpinan_pengganti = nama_pimpinan;
    }

    if (jabatan_pimpinan && jabatan_pimpinan !== ptLama.jabatan_pimpinan) {
      perubahan.jabatan_pimpinan_sebelumnya = ptLama.jabatan_pimpinan;
      perubahan.jabatan_pimpinan_pengganti = jabatan_pimpinan;
    }

    if (
      no_telepon_pimpinan &&
      no_telepon_pimpinan !== ptLama.no_telepon_pimpinan
    ) {
      perubahan.no_telepon_pimpinan_sebelumnya = ptLama.no_telepon_pimpinan;
      perubahan.no_telepon_pimpinan_pengganti = no_telepon_pimpinan;
    }

    if (no_rekening && no_rekening !== ptLama.no_rekening) {
      perubahan.no_rekening_sebelumnya = ptLama.no_rekening;
      perubahan.no_rekening_pengganti = no_rekening;
    }

    if (nama_bank && nama_bank !== ptLama.nama_bank) {
      perubahan.nama_bank_sebelumnya = ptLama.nama_bank;
      perubahan.nama_bank_pengganti = nama_bank;
    }

    if (
      nama_penerima_transfer &&
      nama_penerima_transfer !== ptLama.nama_penerima_transfer
    ) {
      perubahan.penerima_transfer_sebelumnya = ptLama.nama_penerima_transfer;
      perubahan.penerima_transfer_pengganti = nama_penerima_transfer;
    }

    if (npwp && npwp !== ptLama.npwp) {
      perubahan.npwp_sebelumnya = ptLama.npwp;
      perubahan.npwp_pengganti = npwp;
    }

    if (file) {
      perubahan.logo_sebelumnya = ptLama.logo_asli;
      perubahan.logo_pengganti = file.filename;
    }

    // =========================
    // JIKA TIDAK ADA PERUBAHAN
    // =========================

    if (Object.keys(perubahan).length === 0) {
      await t.rollback();
      return successResponse(res, "Tidak ada perubahan data");
    }

    // =========================
    // INSERT LOG
    // =========================

    await LogPerubahanProfilLembaga.create(
      {
        id_trx_pks: ptLama.id_trx_pks,
        id_lembaga_pendidikan: id_pt,
        ...perubahan,
        created_at: new Date(),
        created_by: req.user.nama,
        status: "Pending",
      },
      { transaction: t },
    );

    axios.post(
      `${process.env.MASTER_SERVICE_URL}/perguruan-tinggi/has-perubahan`,
      { id_pt: id_pt },
    );

    await t.commit();

    return successResponse(
      res,
      "Perubahan profil lembaga berhasil diajukan dan menunggu verifikasi",
    );
  } catch (error) {
    await t.rollback();
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.verifikasiPerubahanPt = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id_log } = req.params;
    const verified_by = req.user.nama;

    const { status, catatan } = req.body;

    const log = await LogPerubahanProfilLembaga.findByPk(id_log, {
      transaction: t,
    });

    if (!log) {
      await t.rollback();
      return errorResponse(res, "Log tidak ditemukan", 404);
    }

    const { data: ptResponse } = await axios.get(
      `${process.env.MASTER_SERVICE_URL}/perguruan-tinggi/${log.id_lembaga_pendidikan}`,
    );

    const pt = ptResponse.data;

    if (!pt) {
      await t.rollback();
      return errorResponse(res, "Perguruan Tinggi tidak ditemukan", 404);
    }

    if (status === "Disetujui") {
      const updateData = {
        nama_pt: log.nama_pengganti ?? pt.nama_pt,
        kode_pt: log.kode_pengganti ?? pt.kode_pt,
        singkatan: log.singkatan_pengganti ?? pt.singkatan,
        jenis: log.jenis_pengganti ?? pt.jenis,
        alamat: log.alamat_pengganti ?? pt.alamat,
        kota: log.kota_pengganti ?? pt.kota,
        no_telepon_pt: log.no_telepon_pengganti ?? pt.no_telepon_pt,
        fax_pt: log.fax_pengganti ?? pt.fax_pt,
        email: log.email_pengganti ?? pt.email,
        website: log.website_pengganti ?? pt.website,
        nama_pimpinan: log.nama_pimpinan_pengganti ?? pt.nama_pimpinan,
        jabatan_pimpinan: log.jabatan_pimpinan_pengganti ?? pt.jabatan_pimpinan,
        no_telepon_pimpinan:
          log.no_telepon_pimpinan_pengganti ?? pt.no_telepon_pimpinan,
        no_rekening: log.no_rekening_pengganti ?? pt.no_rekening,
        nama_bank: log.nama_bank_pengganti ?? pt.nama_bank,
        npwp: log.npwp_pengganti ?? pt.npwp,
        nama_penerima_transfer:
          log.penerima_transfer_pengganti ?? pt.nama_penerima_transfer,
      };

      const formData = new FormData();

      // append semua field biasa
      Object.keys(updateData).forEach((key) => {
        if (updateData[key] !== undefined && updateData[key] !== null) {
          formData.append(key, updateData[key]);
        }
      });

      // 🔥 jika ada logo baru
      if (log.logo_pengganti) {
        const filePath = path.resolve(
          process.env.FILE_URL,
          "logo_perguruan_tinggi",
          log.logo_pengganti,
        );

        console.log("FILE_URL:", process.env.FILE_URL);
        console.log("logo:", log.logo_pengganti);
        console.log("resolved path:", filePath);
        console.log("file exists:", fs.existsSync(filePath));

        if (fs.existsSync(filePath)) {
          formData.append("logo", fs.createReadStream(filePath));
        }
      }

      await axios({
        method: "put",
        url: `${process.env.MASTER_SERVICE_URL}/perguruan-tinggi/pengajuan/${log.id_lembaga_pendidikan}`,
        data: formData,
        headers: formData.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });
    }

    await LogPerubahanProfilLembaga.update(
      {
        verified_by: verified_by,
        verified_at: new Date(),
        status: status,
        catatan: catatan,
      },
      { where: { id: id_log }, transaction: t },
    );

    await t.commit();

    return successResponse(res, "Perubahan berhasil diverifikasi");
  } catch (error) {
    console.log(error);
    await t.rollback();
    return errorResponse(res, "Internal Server Error");
  }
};
