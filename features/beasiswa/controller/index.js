const {
  successResponse,
  failResponse,
  errorResponse,
} = require("../../../common/response");
const axios = require("axios");
const { Op, where, fn, col, literal } = require("sequelize");
const {
  TrxBeasiswa,
  TrxDokumenUmum,
  TrxDokumenKhusus,
  TrxPilihanProgramStudi,
  TrxCatatanDataSection,
  TrxDokumenDinasDaerah,
  TrxCatatanVerifikasiSection,
  TrxSkDinasKabkota,
  TrxBaDinasKabkota,
  TrxLogKeputusan,
  sequelize
} = require("../../../models");
const { getFileUrl } = require("../../../common/middleware/upload_middleware");
const ExcelJS = require("exceljs");
const nodemailer = require("nodemailer");

const buildWilayahFilter = ({ kode_prov, kode_kab }) => {
  const filter = {};
  if (kode_prov) filter.tinggal_kode_prov = kode_prov;
  if (kode_kab) filter.tinggal_kode_kab = kode_kab;
  return filter;
};

exports.getRekapLulusAdministrasi = async (req, res) => {
  try {
    const { flag, page = 1, limit = 10, search = "" } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const whereCondition = {
      id_flow: 13
    };

    if (flag !== undefined && flag !== 'all') {
      whereCondition.flag_kewilayahn = parseInt(flag);
    }

    if (search) {
      whereCondition[Op.or] = [
        { tinggal_kab_kota: { [Op.like]: `%${search}%` } },
        { tinggal_prov: { [Op.like]: `%${search}%` } }
      ];
    }

    const rekap = await TrxBeasiswa.findAll({
      where: whereCondition,
      attributes: [
        "tinggal_prov",
        "tinggal_kab_kota",
        "tinggal_kode_kab",
        [
          sequelize.literal(`SUM(CASE WHEN id_flow = 13 THEN 1 ELSE 0 END)`),
          "jml_ktp"
        ],
        [
          sequelize.literal(`SUM(CASE WHEN kerja_kode_kab = tinggal_kode_kab AND id_flow = 13 THEN 1 ELSE 0 END)`),
          "jml_kebun"
        ]
      ],
      group: ["tinggal_kode_kab", "tinggal_prov", "tinggal_kab_kota"],
      order: [
        ["tinggal_prov", "ASC"],
        ["tinggal_kab_kota", "ASC"]
      ],
      limit: limitNum,
      offset: offset,
      raw: true
    });

    const totalData = await TrxBeasiswa.count({
      where: whereCondition,
      distinct: true,
      col: 'tinggal_kode_kab'
    });

    const totalPages = Math.ceil(totalData / limitNum);

    const responseData = {
      data: rekap,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalRows: totalData,
        totalPages: totalPages
      }
    };

    return successResponse(res, "Berhasil memuat rekapitulasi pendaftar", responseData);
  } catch (error) {
    console.error("Error getRekapLulusAdministrasi:", error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.getDetailLulusAdministrasi = async (req, res) => {
  try {
    const { tinggal_kode_kab } = req.params;

    const detail = await TrxBeasiswa.findAll({
      where: {
        tinggal_kode_kab: tinggal_kode_kab,
        id_flow: 13
      },
      attributes: [
        "id_trx_beasiswa",
        "nama_lengkap",
        "nama_beasiswa",
        ["tinggal_kab_kota", "ktp"],
        "kerja_kab_kota",
        ["flag_kewilayahn", "flag_kewilayahan"]
      ],
      raw: true
    });

    return successResponse(res, "Berhasil memuat detail pendaftar", detail);
  } catch (error) {
    console.error("Error getDetailLulusAdministrasi:", error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.updateFlagKewilayahan = async (req, res) => {
  try {
    const { id_trx_beasiswa, flag_kewilayahan, is_global } = req.body;

    if (flag_kewilayahan === undefined) {
      return failResponse(res, "Data tidak lengkap. flag_kewilayahan wajib diisi.");
    }

    let logKeterangan = "";
    const flagVal = parseInt(flag_kewilayahan);

    // 1. Siapkan payload update menggunakan literal
    // Ini memaksa MySQL mengambil nilai mentah dari kolom yang ada di row tersebut
    let updatePayload = {
      flag_kewilayahn: flagVal,
    };

    if (flagVal === 0) {
      // Jika SESUAI KTP (0)
      updatePayload.kode_dinas_provinsi = literal('tinggal_kode_prov');
      updatePayload.nama_dinas_provinsi = literal('tinggal_prov');
      updatePayload.kode_dinas_kabkota = literal('tinggal_kode_kab');
      updatePayload.nama_dinas_kabkota = literal('tinggal_kab_kota');
    } else if (flagVal === 1) {
      // Jika SESUAI KEBUN (1)
      updatePayload.kode_dinas_provinsi = literal('kerja_kode_prov');
      updatePayload.nama_dinas_provinsi = literal('kerja_prov');
      updatePayload.kode_dinas_kabkota = literal('kerja_kode_kab');
      updatePayload.nama_dinas_kabkota = literal('kerja_kab_kota');
    }

    // 2. Eksekusi Update Berdasarkan Kondisi (Global, Bulk, Single)
    if (is_global) {
      await TrxBeasiswa.update(
        updatePayload,
        { where: { id_flow: 13 } }
      );
      logKeterangan = `Update massal kewilayahan ke ${flagVal === 1 ? 'ALAMAT KEBUN' : 'ALAMAT KTP'}`;
    }
    else if (Array.isArray(id_trx_beasiswa)) {
      if (id_trx_beasiswa.length === 0) return failResponse(res, "Tidak ada data yang dipilih.");
      await TrxBeasiswa.update(
        updatePayload,
        { where: { id_trx_beasiswa: { [Op.in]: id_trx_beasiswa } } }
      );
      logKeterangan = `Update kewilayahan ${id_trx_beasiswa.length} pendaftar menjadi ${flagVal === 1 ? 'SESUAI KEBUN' : 'SESUAI KTP'}`;
    }
    else if (id_trx_beasiswa) {
      await TrxBeasiswa.update(
        updatePayload,
        { where: { id_trx_beasiswa: id_trx_beasiswa } }
      );
      logKeterangan = `Update kewilayahan 1 pendaftar menjadi ${flagVal === 1 ? 'SESUAI KEBUN' : 'SESUAI KTP'}`;
    } else {
      return failResponse(res, "Target update tidak valid.");
    }

    // 3. Insert ke tabel Log Keputusan
    await TrxLogKeputusan.create({
      jenis: "PEMBAGIAN_WILAYAH",
      ket: logKeterangan,
      timestamp: new Date()
    });

    return successResponse(res, "Kewilayahan dan kode dinas berhasil diubah");
  } catch (error) {
    console.error("Error updateFlagKewilayahan:", error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.getLastLogKeputusan = async (req, res) => {
  try {
    const log = await TrxLogKeputusan.findOne({
      where: { jenis: "PEMBAGIAN_WILAYAH" },
      order: [["timestamp", "DESC"]]
    });
    return successResponse(res, "Berhasil memuat log", log);
  } catch (error) {
    console.error("Error getLastLogKeputusan:", error);
    return errorResponse(res, "Internal Server Error");
  }
};

// Get semua transaksi beasiswa dengan pagination
exports.getTransaksiBeasiswaByPagination = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    const baseCondition = {};

    // Tambahkan pencarian jika ada search
    const whereCondition = search
      ? {
        ...baseCondition,
        [Op.or]: [
          { nama_beasiswa: { [Op.like]: `%${search}%` } },
          { nama_lengkap: { [Op.like]: `%${search}%` } },
        ],
      }
      : baseCondition;

    const { count, rows } = await TrxBeasiswa.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      order: [["id_trx_beasiswa", "ASC"]],
    });

    return successResponse(res, "Data berhasil dimuat", {
      result: rows,
      total: count,
      current_page: page,
      total_pages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal server error");
  }
};

// Get transaksi beasiswa dengan pagination yang sedang proses seleksi administrasi
exports.getTransaksiBeasiswaByPaginationSeleksiAdministrasi = async (
  req,
  res,
) => {
  try {
    const { idBeasiswa } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";
    const provinsi = req.query.kodeProvinsi || "";
    const kabkota = req.query.kodeKabkota || "";

    // const baseCondition = {
    //   id_ref_beasiswa: idBeasiswa,
    //   id_verifikator: req.user.id,
    //   [Op.or]: [{ id_flow: 2 }, { id_flow: 5 }, { id_flow: 3 }, { id_flow: 8 }],
    // };

    const baseCondition = {
      id_ref_beasiswa: idBeasiswa,
      id_verifikator: req.user.id,
      id_flow: {
        [Op.ne]: [{ id_flow: 0 }, { id_flow: 1 }],
      },
    };

    if (provinsi) {
      baseCondition.tinggal_kode_prov = provinsi;
    }

    if (kabkota) {
      baseCondition.tinggal_kode_kab = kabkota;
    }

    // Jika ada pencarian
    const whereCondition = search
      ? {
        ...baseCondition,
        [Op.or]: [
          { nama_beasiswa: { [Op.like]: `%${search}%` } },
          { nama_lengkap: { [Op.like]: `%${search}%` } },
          { kode_pendaftaran: { [Op.like]: `%${search}%` } },
        ],
      }
      : baseCondition;

    const { count, rows } = await TrxBeasiswa.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      order: [["id_trx_beasiswa", "ASC"]],
    });

    // Tambahkan URL foto jika ada
    const mappedRows = rows.map((item) => {
      const json = item.toJSON();
      return {
        ...json,
        foto: json.foto ? getFileUrl(req, "foto", json.foto) : null,
        foto_depan: json.foto_depan ? getFileUrl(req, "foto_depan", json.foto_depan) : null,
        foto_samping_kiri: json.foto_samping_kiri ? getFileUrl(req, "foto_samping_kiri", json.foto_samping_kiri) : null,
        foto_samping_kanan: json.foto_samping_kanan ? getFileUrl(req, "foto_samping_kanan", json.foto_samping_kanan) : null,
        foto_belakang: json.foto_belakang ? getFileUrl(req, "foto_belakang", json.foto_belakang) : null,
      };
    });


    return successResponse(res, "Data berhasil dimuat", {
      result: mappedRows,
      total: count,
      current_page: page,
      total_pages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal server error");
  }
};

exports.getTransaksiBeasiswaByPaginationSeleksiAdministrasiDaerah = async (
  req,
  res,
) => {
  try {
    const { idBeasiswa } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";
    const provinsi = req.query.kodeProvinsi || "";
    const kabkota = req.query.kodeKabkota || "";
    const dinas = req.query.Dinas || "";

    const baseCondition = {
      id_ref_beasiswa: idBeasiswa,
      // [Op.or]: [{ id_flow: 2 }, { id_flow: 5 }, { id_flow: 14 }],
    };

    if (kabkota) {
      baseCondition.kode_dinas_kabkota = kabkota;
    } else if (provinsi) {
      baseCondition.kode_dinas_provinsi = provinsi;
    }


    if (dinas == "kabkota") {
      baseCondition.id_flow = 6;
    } else if (dinas == "provinsi") {
      baseCondition.id_flow = 7;
    }
    console.log(baseCondition);

    // Jika ada pencarian
    const whereCondition = search
      ? {
        ...baseCondition,
        [Op.or]: [
          { nama_beasiswa: { [Op.like]: `%${search}%` } },
          { nama_lengkap: { [Op.like]: `%${search}%` } },
          { kode_pendaftaran: { [Op.like]: `%${search}%` } },
        ],
      }
      : baseCondition;

    const { count, rows } = await TrxBeasiswa.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      order: [["id_trx_beasiswa", "ASC"]],
    });

    // Tambahkan URL foto jika ada
    const mappedRows = rows.map((item) => {
      const json = item.toJSON();
      return {
        ...json,
        foto: json.foto ? getFileUrl(req, "foto", json.foto) : null,
        foto_depan: json.foto_depan ? getFileUrl(req, "foto_depan", json.foto_depan) : null,
        foto_samping_kiri: json.foto_samping_kiri ? getFileUrl(req, "foto_samping_kiri", json.foto_samping_kiri) : null,
        foto_samping_kanan: json.foto_samping_kanan ? getFileUrl(req, "foto_samping_kanan", json.foto_samping_kanan) : null,
        foto_belakang: json.foto_belakang ? getFileUrl(req, "foto_belakang", json.foto_belakang) : null,
      };
    });
    console.log("WHERE:", baseCondition);

    return successResponse(res, "Data berhasil dimuat", {
      result: mappedRows,
      total: count,
      current_page: page,
      total_pages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal server error");
  }
};

// Get transaksi beasiswa dengan pagination yang sedang proses seleksi administrasi
exports.getTransaksiBeasiswaByPaginationVerifikasiDinas = async (req, res) => {
  try {
    const { idBeasiswa } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";
    const { kode_prov, kode_kab } = req.user;

    const wilayahFilter = buildWilayahFilter({ kode_prov, kode_kab });

    const baseCondition = {
      id_ref_beasiswa: idBeasiswa,
      [Op.or]: [{ id_flow: 8 }, { id_flow: 10 }],
      status_lulus_administrasi: "Y",
      status_lulus_wawancara_akademik: "Y",
      kode_prov: kode_prov ?? null,
      kode_kab: kode_kab ?? null,
      ...wilayahFilter,
    };
    // Tambahkan pencarian jika ada search
    const whereCondition = search
      ? {
        ...baseCondition,
        [Op.or]: [
          { nama_beasiswa: { [Op.like]: `%${search}%` } },
          { nama_lengkap: { [Op.like]: `%${search}%` } },
        ],
      }
      : baseCondition;

    const { count, rows } = await TrxBeasiswa.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      order: [["id_trx_beasiswa", "ASC"]],
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

exports.createInitialTransaksi = async (req, res) => {
  try {
    const { id_ref_beasiswa, nama_beasiswa } = req.body;
    const { id: idUser } = req.user;

    // Cek apakah sudah ada data transaksi untuk user dan beasiswa ini
    let transaksi = await TrxBeasiswa.findOne({
      where: { id_ref_beasiswa, id_users: idUser },
    });

    // Jika belum ada, buat baru
    if (!transaksi) {
      const insertData = {
        id_ref_beasiswa,
        nama_beasiswa,
        id_users: idUser,
        id_flow: 0,
        flow: "Draft",
        created_at: new Date(),
      };

      transaksi = await TrxBeasiswa.create(insertData);
    }

    if (transaksi.foto) {
      transaksi.foto = getFileUrl(req, "foto", transaksi.foto);
    }
    if (transaksi.foto_depan) {
      transaksi.foto_depan = getFileUrl(req, "foto_depan", transaksi.foto_depan);
    }
    if (transaksi.foto_belakang) {
      transaksi.foto_belakang = getFileUrl(req, "foto_belakang", transaksi.foto_belakang);
    }
    if (transaksi.foto_samping_kanan) {
      transaksi.foto_samping_kanan = getFileUrl(req, "foto_samping_kanan", transaksi.foto_samping_kanan);
    }
    if (transaksi.foto_samping_kiri) {
      transaksi.foto_samping_kiri = getFileUrl(req, "foto_samping_kiri", transaksi.foto_samping_kiri);
    }

    const pilihanProgramStudi = await TrxPilihanProgramStudi.findAll({
      where: { id_trx_beasiswa: transaksi.id_trx_beasiswa },
    });

    transaksi = transaksi.toJSON();
    transaksi.pilihan_program_studi = pilihanProgramStudi ?? [];

    let sectionData = await TrxCatatanDataSection.findOne({
      where: { id_trx_beasiswa: transaksi.id_trx_beasiswa },
    });

    transaksi.catatan_data_section = sectionData ? sectionData.toJSON() : null;

    return successResponse(
      res,
      "Transaksi berhasil dibuat atau ditemukan",
      transaksi,
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json(errorResponse("Internal Server Error"));
  }
};


exports.getFullDataBeasiswa = async (req, res) => {
  try {
    const { idTrxBeasiswa } = req.params;

    const trxBeasiswa = await TrxBeasiswa.findOne({
      where: { id_trx_beasiswa: idTrxBeasiswa },
    });

    if (!trxBeasiswa) {
      return errorResponse(res, "Data beasiswa tidak ditemukan", 404);
    }

    // =========================
    // Dokumen
    // =========================
    const persyaratanUmum = await TrxDokumenUmum.findAll({
      where: { id_trx_beasiswa: idTrxBeasiswa },
    });

    const persyaratanKhusus = await TrxDokumenKhusus.findAll({
      where: { id_trx_beasiswa: idTrxBeasiswa },
    });

    const persyaratanDinas = await TrxDokumenDinasDaerah.findAll({
      where: { id_trx_beasiswa: idTrxBeasiswa },
    });

    const mappedPersyaratanUmum = persyaratanUmum.map((item) => ({
      ...item.toJSON(),
      file: getFileUrl(req, "persyaratan", item.file),
    }));

    const mappedPersyaratanKhusus = persyaratanKhusus.map((item) => ({
      ...item.toJSON(),
      file: getFileUrl(req, "persyaratan", item.file),
    }));

    const mappedPersyaratanDinas = persyaratanDinas.map((item) => ({
      ...item.toJSON(),
      file: getFileUrl(req, "persyaratan", item.file),
    }));

    // =========================
    // Pilihan Program Studi 🔥
    // =========================
    const pilihanProgramStudi = await TrxPilihanProgramStudi.findAll({
      where: { id_trx_beasiswa: idTrxBeasiswa },
    });

    // =========================
    // Beasiswa
    // =========================
    const beasiswaData = trxBeasiswa.toJSON();
    // console.log(beasiswaData);

    if (beasiswaData.foto) {
      beasiswaData.foto = getFileUrl(req, "foto", beasiswaData.foto);
    }
    if (beasiswaData.foto_depan)
      beasiswaData.foto_depan = getFileUrl(req, "foto_depan", beasiswaData.foto_depan);
    if (beasiswaData.foto_samping_kiri)
      beasiswaData.foto_samping_kiri = getFileUrl(req, "foto_samping_kiri", beasiswaData.foto_samping_kiri);
    if (beasiswaData.foto_samping_kanan)
      beasiswaData.foto_samping_kanan = getFileUrl(req, "foto_samping_kanan", beasiswaData.foto_samping_kanan);
    if (beasiswaData.foto_belakang)
      beasiswaData.foto_belakang = getFileUrl(req, "foto_belakang", beasiswaData.foto_belakang);

    // 🔥 tempelkan ke data_beasiswa
    beasiswaData.pilihan_program_studi = pilihanProgramStudi.map((item) =>
      item.toJSON(),
    );

    let sectionData = await TrxCatatanDataSection.findOne({
      where: { id_trx_beasiswa: beasiswaData.id_trx_beasiswa },
    });

    beasiswaData.catatan_data_section = sectionData
      ? sectionData.toJSON()
      : null;

    const returnData = {
      data_beasiswa: beasiswaData,
      persyaratan_umum: mappedPersyaratanUmum,
      persyaratan_khusus: mappedPersyaratanKhusus,
      persyaratan_dinas: mappedPersyaratanDinas,
    };

    return successResponse(res, "Transaksi berhasil ditemukan", returnData);
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

// exports.submitBeasiswa = async (req, res) => {
//   try {
//     const {
//       id_trx_beasiswa,
//       is_draft,
//       nama_lengkap,
//       nik,
//       nkk,
//       jenis_kelamin,
//       no_hp,
//       email,
//       tanggal_lahir,
//       tempat_lahir,
//       agama,
//       suku,
//       pekerjaan,
//       instansi_pekerjaan,
//       berat_badan,
//       tinggi_badan,

//       tinggal_provinsi,
//       tinggal_kabkot,
//       tinggal_kecamatan,
//       tinggal_kelurahan,
//       tinggal_dusun,
//       tinggal_kode_pos,
//       tinggal_rt,
//       tinggal_rw,
//       tinggal_alamat,
//       kerja_provinsi,
//       kerja_kabkot,
//       kerja_kecamatan,
//       kerja_kelurahan,
//       kerja_dusun,
//       kerja_kode_pos,
//       kerja_rt,
//       kerja_rw,
//       kerja_alamat,

//       alamat_kerja_sama_dengan_tinggal,

//       ayah_nama,
//       ayah_nik,
//       ayah_jenjang_pendidikan,
//       ayah_pekerjaan,
//       ayah_penghasilan,
//       ayah_status_hidup,
//       ayah_status_kekerabatan,
//       ayah_tempat_lahir,
//       ayah_tanggal_lahir,
//       ayah_no_hp,
//       ayah_email,
//       ayah_alamat,

//       ibu_nama,
//       ibu_nik,
//       ibu_jenjang_pendidikan,
//       ibu_pekerjaan,
//       ibu_penghasilan,
//       ibu_status_hidup,
//       ibu_status_kekerabatan,
//       ibu_tempat_lahir,
//       ibu_tanggal_lahir,
//       ibu_no_hp,
//       ibu_email,
//       ibu_alamat,

//       wali_nama,
//       wali_nik,
//       wali_jenjang_pendidikan,
//       wali_pekerjaan,
//       wali_penghasilan,
//       wali_status_hidup,
//       wali_status_kekerabatan,
//       wali_tempat_lahir,
//       wali_tanggal_lahir,
//       wali_no_hp,
//       wali_email,
//       wali_alamat,

//       sekolah_provinsi,
//       sekolah_kabkot,
//       jenjang_sekolah,
//       sekolah,
//       jurusan,
//       tahun_lulus,
//       nama_jurusan_sekolah,
//       id_verifikator,

//       kondisi_buta_warna,
//       pilihan_program_studi,

//       kode_dinas_provinsi,
//       kode_dinas_kabkota,

//       jalur,
//     } = req.body;

//     // Ambil file kalau ada
//     // const file = req.file;

//     // Helper untuk aman split string "id#nama"
//     const safeSplit = (value = "", delimiter = "#") => {
//       if (typeof value !== "string" || !value.includes(delimiter)) {
//         return [null, null];
//       }
//       const parts = value
//         .split(delimiter)
//         .map((v) => (v === "" || v === "null" ? null : v));
//       return [parts[0], parts[1]];
//     };

//     // Helper untuk ubah "" jadi null
//     const normalize = (val) => {
//       if (val === "" || val === "null" || val === undefined) return null;
//       return val;
//     };

//     const [idPekerjaan, namaPekerjaan] = safeSplit(pekerjaan);
//     const [idInstansiPekerjaan, namaInstansiPekerjaan] =
//       safeSplit(instansi_pekerjaan);

//     const [tinggalKodeProv, tinggalNamaProv] = safeSplit(tinggal_provinsi);
//     const [tinggalKodeKab, tinggalNamaKab] = safeSplit(tinggal_kabkot);
//     const [tinggalKodeKec, tinggalNamaKec] = safeSplit(tinggal_kecamatan);
//     const [tinggalKodeKel, tinggalNamaKel] = safeSplit(tinggal_kelurahan);
//     const [tinggalKodeDusun, tinggalNamaDusun] = safeSplit(tinggal_dusun);

//     const [kerjaKodeProv, kerjaNamaProv] = safeSplit(kerja_provinsi);
//     const [kerjaKodeKab, kerjaNamaKab] = safeSplit(kerja_kabkot);
//     const [kerjaKodeKec, kerjaNamaKec] = safeSplit(kerja_kecamatan);
//     const [kerjaKodeKel, kerjaNamaKel] = safeSplit(kerja_kelurahan);
//     const [kerjaKodeDusun, kerjaNamaDusun] = safeSplit(kerja_dusun);

//     const [ayahStatusHidup, ayahNamaStatusHidup] = safeSplit(ayah_status_hidup);
//     const [ayahStatusKekerabatan, ayahNamaStatusKekerabatan] = safeSplit(
//       ayah_status_kekerabatan,
//     );
//     const [ibuStatusHidup, ibuNamaStatusHidup] = safeSplit(ibu_status_hidup);
//     const [ibuStatusKekerabatan, ibuNamaStatusKekerabatan] = safeSplit(
//       ibu_status_kekerabatan,
//     );
//     const [waliStatusHidup, waliNamaStatusHidup] = safeSplit(wali_status_hidup);
//     const [waliStatusKekerabatan, waliNamaStatusKekerabatan] = safeSplit(
//       wali_status_kekerabatan,
//     );

//     const [sekolahKodeProv, sekolahNamaProv] = safeSplit(sekolah_provinsi);
//     const [sekolahKodeKab, sekolahNamaKab] = safeSplit(sekolah_kabkot);
//     const [idJenjangSekolah, jenjangSekolah] = safeSplit(jenjang_sekolah);

//     const [idJalur, namaJalur] = safeSplit(jalur);


//     const [idDinasprov, namaDinasprov] = safeSplit(kode_dinas_provinsi);
//     const [idDinaskabkota, namaDinaskabkota] = safeSplit(kode_dinas_kabkota);

//     const updateData = {
//       nama_lengkap: normalize(nama_lengkap),
//       nik: normalize(nik),
//       nkk: normalize(nkk),
//       jenis_kelamin: normalize(jenis_kelamin),
//       no_hp: normalize(no_hp),
//       email: normalize(email),
//       tanggal_lahir: normalize(tanggal_lahir),
//       tempat_lahir: normalize(tempat_lahir),
//       agama: normalize(agama),
//       suku: normalize(suku),
//       id_pekerjaan: normalize(idPekerjaan),
//       pekerjaan: normalize(namaPekerjaan),
//       id_instansi_pekerjaan: normalize(idInstansiPekerjaan),
//       instansi_pekerjaan: normalize(namaInstansiPekerjaan),
//       berat_badan: normalize(berat_badan),
//       tinggi_badan: normalize(tinggi_badan),

//       tinggal_kode_prov: normalize(tinggalKodeProv),
//       tinggal_prov: normalize(tinggalNamaProv),
//       tinggal_kode_kab: normalize(tinggalKodeKab),
//       tinggal_kab_kota: normalize(tinggalNamaKab),
//       tinggal_kode_kec: normalize(tinggalKodeKec),
//       tinggal_kec: normalize(tinggalNamaKec),
//       tinggal_kode_kel: normalize(tinggalKodeKel),
//       tinggal_kel: normalize(tinggalNamaKel),
//       tinggal_kode_dusun: normalize(tinggalKodeDusun),
//       tinggal_dusun: normalize(tinggalNamaDusun),
//       tinggal_kode_pos: normalize(tinggal_kode_pos),
//       tinggal_rt: normalize(tinggal_rt),
//       tinggal_rw: normalize(tinggal_rw),
//       tinggal_alamat: normalize(tinggal_alamat),
//       kerja_kode_prov: normalize(kerjaKodeProv),
//       kerja_prov: normalize(kerjaNamaProv),
//       kerja_kode_kab: normalize(kerjaKodeKab),
//       kerja_kab_kota: normalize(kerjaNamaKab),
//       kerja_kode_kec: normalize(kerjaKodeKec),
//       kerja_kec: normalize(kerjaNamaKec),
//       kerja_kode_kel: normalize(kerjaKodeKel),
//       kerja_kel: normalize(kerjaNamaKel),
//       kerja_kode_dusun: normalize(kerjaKodeDusun),
//       kerja_dusun: normalize(kerjaNamaDusun),
//       kerja_kode_pos: normalize(kerja_kode_pos),
//       kerja_rt: normalize(kerja_rt),
//       kerja_rw: normalize(kerja_rw),
//       kerja_alamat: normalize(kerja_alamat),

//       alamat_kerja_sama_dengan_tinggal: normalize(alamat_kerja_sama_dengan_tinggal),

//       ayah_nama: normalize(ayah_nama),
//       ayah_nik: normalize(ayah_nik),
//       ayah_jenjang_pendidikan: normalize(ayah_jenjang_pendidikan),
//       ayah_pekerjaan: normalize(ayah_pekerjaan),
//       ayah_penghasilan: normalize(ayah_penghasilan),
//       ayah_id_status_hidup: normalize(ayahStatusHidup),
//       ayah_status_hidup: normalize(ayahNamaStatusHidup),
//       ayah_id_status_kekerabatan: normalize(ayahStatusKekerabatan),
//       ayah_status_kekerabatan: normalize(ayahNamaStatusKekerabatan),
//       ayah_tempat_lahir: normalize(ayah_tempat_lahir),
//       ayah_tanggal_lahir: normalize(ayah_tanggal_lahir),
//       ayah_no_hp: normalize(ayah_no_hp),
//       ayah_email: normalize(ayah_email),
//       ayah_alamat: normalize(ayah_alamat),

//       ibu_nama: normalize(ibu_nama),
//       ibu_nik: normalize(ibu_nik),
//       ibu_jenjang_pendidikan: normalize(ibu_jenjang_pendidikan),
//       ibu_pekerjaan: normalize(ibu_pekerjaan),
//       ibu_penghasilan: normalize(ibu_penghasilan),
//       ibu_id_status_hidup: normalize(ibuStatusHidup),
//       ibu_status_hidup: normalize(ibuNamaStatusHidup),
//       ibu_id_status_kekerabatan: normalize(ibuStatusKekerabatan),
//       ibu_status_kekerabatan: normalize(ibuNamaStatusKekerabatan),
//       ibu_tempat_lahir: normalize(ibu_tempat_lahir),
//       ibu_tanggal_lahir: normalize(ibu_tanggal_lahir),
//       ibu_no_hp: normalize(ibu_no_hp),
//       ibu_email: normalize(ibu_email),
//       ibu_alamat: normalize(ibu_alamat),

//       wali_nama: normalize(wali_nama),
//       wali_nik: normalize(wali_nik),
//       wali_jenjang_pendidikan: normalize(wali_jenjang_pendidikan),
//       wali_pekerjaan: normalize(wali_pekerjaan),
//       wali_penghasilan: normalize(wali_penghasilan),
//       wali_id_status_hidup: normalize(waliStatusHidup),
//       wali_status_hidup: normalize(waliNamaStatusHidup),
//       wali_id_status_kekerabatan: normalize(waliStatusKekerabatan),
//       wali_status_kekerabatan: normalize(waliNamaStatusKekerabatan),
//       wali_tempat_lahir: normalize(wali_tempat_lahir),
//       wali_tanggal_lahir: normalize(wali_tanggal_lahir),
//       wali_no_hp: normalize(wali_no_hp),
//       wali_email: normalize(wali_email),
//       wali_alamat: normalize(wali_alamat),

//       sekolah_kode_prov: normalize(sekolahKodeProv),
//       sekolah_prov: normalize(sekolahNamaProv),
//       sekolah_kode_kab: normalize(sekolahKodeKab),
//       sekolah_kab_kota: normalize(sekolahNamaKab),
//       id_jenjang_sekolah: normalize(idJenjangSekolah),
//       jenjang_sekolah: normalize(jenjangSekolah),
//       sekolah: normalize(sekolah),
//       jurusan: normalize(jurusan),
//       tahun_lulus: normalize(tahun_lulus),
//       nama_jurusan_sekolah: normalize(nama_jurusan_sekolah),

//       kondisi_buta_warna: normalize(kondisi_buta_warna),

//       kode_dinas_provinsi: normalize(idDinasprov),
//       kode_dinas_kabkota: normalize(idDinaskabkota),

//       id_verifikator: normalize(id_verifikator),

//       id_jalur: normalize(idJalur),
//       jalur: normalize(namaJalur),
//       updated_at: new Date(),
//     };

//     // if (file) {
//     //   updateData.foto = file.filename; // atau file.path kalau ingin simpan path lengkap
//     // }

//     const files = req.files || {};
//     if (files["foto"]?.[0]) updateData.foto = files["foto"][0].filename;
//     if (files["foto_depan"]?.[0]) updateData.foto_depan = files["foto_depan"][0].filename;
//     if (files["foto_samping_kiri"]?.[0]) updateData.foto_samping_kiri = files["foto_samping_kiri"][0].filename;
//     if (files["foto_samping_kanan"]?.[0]) updateData.foto_samping_kanan = files["foto_samping_kanan"][0].filename;
//     if (files["foto_belakang"]?.[0]) updateData.foto_belakang = files["foto_belakang"][0].filename;

//     // Ambil current flow
//     const trxBeasiswa = await TrxBeasiswa.findOne({
//       where: { id_trx_beasiswa },
//       attributes: ["id_flow", "kode_pendaftaran"],
//     });

//     const currentFlow = trxBeasiswa?.id_flow;

//     const is_draftx = is_draft === "true";

//     if (!is_draftx) {
//       if (currentFlow === 1) {
//         updateData.id_flow = 2;
//         updateData.flow = "Verifikasi";

//         // Hanya generate jika belum punya kode pendaftaran
//         if (!trxBeasiswa.kode_pendaftaran) {
//           const kodePendaftaran = await generateKodePendaftaran(idJalur);
//           updateData.kode_pendaftaran = kodePendaftaran;
//         }
//       } else if (currentFlow === 4) {
//         updateData.id_flow = 5;
//         updateData.flow = "Verifikasi Hasil Perbaikan";
//       } else if (currentFlow === 9) {
//         updateData.id_flow = 10;
//         updateData.flow = "Verifikasi Hasil Perbaikan";
//       }
//     }


//     await TrxBeasiswa.update(updateData, {
//       where: { id_trx_beasiswa },
//     });

//     // Untuk Pilihan Prodi
//     await TrxPilihanProgramStudi.destroy({
//       where: { id_trx_beasiswa },
//     });

//     const pilihan_program_studix = JSON.parse(req.body.pilihan_program_studi);

//     const insertDataPilihanProgramSudi = pilihan_program_studix.map((item) => {
//       const [id_pt, nama_pt] = safeSplit(item.perguruan_tinggi);
//       const [id_prodi, nama_prodi] = safeSplit(item.program_studi);

//       return {
//         id_trx_beasiswa,
//         id_pt: id_pt ? Number(id_pt) : null,
//         nama_pt,
//         id_prodi: id_prodi ? Number(id_prodi) : null,
//         nama_prodi,
//       };
//     });

//     if (insertDataPilihanProgramSudi.length > 0) {
//       await TrxPilihanProgramStudi.bulkCreate(insertDataPilihanProgramSudi);
//     }

//     return successResponse(res, "Transaksi berhasil diperbarui");
//   } catch (error) {
//     console.error(error);
//     return errorResponse(res, "Internal Server Error");
//   }
// };

// ============================================================
// PATCH untuk exports.submitBeasiswa
// Ganti seluruh fungsi submitBeasiswa di controller dengan ini
// ============================================================
// Asumsi: middleware diubah dari upload.single("foto")
// menjadi upload.fields([...]) — lihat konfigurasi middleware di bawah
// ============================================================
// ⚠️  Pastikan TrxDokumenUmum ada di destructure require models:
// const { TrxBeasiswa, TrxPilihanProgramStudi, TrxDokumenUmum } = require("../../../models");


exports.submitBeasiswa = async (req, res) => {
  try {
    const {
      id_trx_beasiswa,
      is_draft,
      nama_lengkap,
      nik,
      nkk,
      jenis_kelamin,
      no_hp,
      email,
      tanggal_lahir,
      tempat_lahir,
      agama,
      suku,
      pekerjaan,
      instansi_pekerjaan,
      berat_badan,
      tinggi_badan,

      tinggal_provinsi,
      tinggal_kabkot,
      tinggal_kecamatan,
      tinggal_kelurahan,
      tinggal_dusun,
      tinggal_kode_pos,
      tinggal_rt,
      tinggal_rw,
      tinggal_alamat,
      kerja_provinsi,
      kerja_kabkot,
      kerja_kecamatan,
      kerja_kelurahan,
      kerja_dusun,
      kerja_kode_pos,
      kerja_rt,
      kerja_rw,
      kerja_alamat,

      alamat_kerja_sama_dengan_tinggal,

      ayah_nama,
      ayah_nik,
      ayah_jenjang_pendidikan,
      ayah_pekerjaan,
      ayah_penghasilan,
      ayah_status_hidup,
      ayah_status_kekerabatan,
      ayah_tempat_lahir,
      ayah_tanggal_lahir,
      ayah_no_hp,
      ayah_email,
      ayah_alamat,

      ibu_nama,
      ibu_nik,
      ibu_jenjang_pendidikan,
      ibu_pekerjaan,
      ibu_penghasilan,
      ibu_status_hidup,
      ibu_status_kekerabatan,
      ibu_tempat_lahir,
      ibu_tanggal_lahir,
      ibu_no_hp,
      ibu_email,
      ibu_alamat,

      wali_nama,
      wali_nik,
      wali_jenjang_pendidikan,
      wali_pekerjaan,
      wali_penghasilan,
      wali_status_hidup,
      wali_status_kekerabatan,
      wali_tempat_lahir,
      wali_tanggal_lahir,
      wali_no_hp,
      wali_email,
      wali_alamat,

      sekolah_provinsi,
      sekolah_kabkot,
      jenjang_sekolah,
      sekolah,
      jurusan,
      tahun_lulus,
      nama_jurusan_sekolah,
      id_verifikator,

      kondisi_buta_warna,
      pilihan_program_studi,

      kode_dinas_provinsi,
      kode_dinas_kabkota,

      jalur,
    } = req.body;

    // ✅ Ambil file dari req.files (upload.fields)
    const files = req.files || {};
    const fotoFile = files["foto"]?.[0];
    const fotoDepanFile = files["foto_depan"]?.[0];
    const fotoKiriFile = files["foto_samping_kiri"]?.[0];
    const fotoKananFile = files["foto_samping_kanan"]?.[0];
    const fotoBelakangFile = files["foto_belakang"]?.[0];

    // Helper untuk aman split string "id#nama"
    const safeSplit = (value = "", delimiter = "#") => {
      if (typeof value !== "string" || !value.includes(delimiter)) {
        return [null, null];
      }
      const parts = value
        .split(delimiter)
        .map((v) => (v === "" || v === "null" ? null : v));
      return [parts[0], parts[1]];
    };

    // Helper untuk ubah "" jadi null
    const normalize = (val) => {
      if (val === "" || val === "null" || val === undefined) return null;
      return val;
    };

    const [idPekerjaan, namaPekerjaan] = safeSplit(pekerjaan);
    const [idInstansiPekerjaan, namaInstansiPekerjaan] = safeSplit(instansi_pekerjaan);

    const [tinggalKodeProv, tinggalNamaProv] = safeSplit(tinggal_provinsi);
    const [tinggalKodeKab, tinggalNamaKab] = safeSplit(tinggal_kabkot);
    const [tinggalKodeKec, tinggalNamaKec] = safeSplit(tinggal_kecamatan);
    const [tinggalKodeKel, tinggalNamaKel] = safeSplit(tinggal_kelurahan);
    const [tinggalKodeDusun, tinggalNamaDusun] = safeSplit(tinggal_dusun);

    const [kerjaKodeProv, kerjaNamaProv] = safeSplit(kerja_provinsi);
    const [kerjaKodeKab, kerjaNamaKab] = safeSplit(kerja_kabkot);
    const [kerjaKodeKec, kerjaNamaKec] = safeSplit(kerja_kecamatan);
    const [kerjaKodeKel, kerjaNamaKel] = safeSplit(kerja_kelurahan);
    const [kerjaKodeDusun, kerjaNamaDusun] = safeSplit(kerja_dusun);

    const [ayahStatusHidup, ayahNamaStatusHidup] = safeSplit(ayah_status_hidup);
    const [ayahStatusKekerabatan, ayahNamaStatusKekerabatan] = safeSplit(ayah_status_kekerabatan);
    const [ibuStatusHidup, ibuNamaStatusHidup] = safeSplit(ibu_status_hidup);
    const [ibuStatusKekerabatan, ibuNamaStatusKekerabatan] = safeSplit(ibu_status_kekerabatan);
    const [waliStatusHidup, waliNamaStatusHidup] = safeSplit(wali_status_hidup);
    const [waliStatusKekerabatan, waliNamaStatusKekerabatan] = safeSplit(wali_status_kekerabatan);

    const [sekolahKodeProv, sekolahNamaProv] = safeSplit(sekolah_provinsi);
    const [sekolahKodeKab, sekolahNamaKab] = safeSplit(sekolah_kabkot);
    const [idJenjangSekolah, jenjangSekolah] = safeSplit(jenjang_sekolah);

    const [idJalur, namaJalur] = safeSplit(jalur);
    const [idDinasprov, namaDinasprov] = safeSplit(kode_dinas_provinsi);
    const [idDinaskabkota, namaDinaskabkota] = safeSplit(kode_dinas_kabkota);

    const updateData = {
      nama_lengkap: normalize(nama_lengkap),
      nik: normalize(nik),
      nkk: normalize(nkk),
      jenis_kelamin: normalize(jenis_kelamin),
      no_hp: normalize(no_hp),
      email: normalize(email),
      tanggal_lahir: normalize(tanggal_lahir),
      tempat_lahir: normalize(tempat_lahir),
      agama: normalize(agama),
      suku: normalize(suku),
      id_pekerjaan: normalize(idPekerjaan),
      pekerjaan: normalize(namaPekerjaan),
      id_instansi_pekerjaan: normalize(idInstansiPekerjaan),
      instansi_pekerjaan: normalize(namaInstansiPekerjaan),
      berat_badan: normalize(berat_badan),
      tinggi_badan: normalize(tinggi_badan),

      tinggal_kode_prov: normalize(tinggalKodeProv),
      tinggal_prov: normalize(tinggalNamaProv),
      tinggal_kode_kab: normalize(tinggalKodeKab),
      tinggal_kab_kota: normalize(tinggalNamaKab),
      tinggal_kode_kec: normalize(tinggalKodeKec),
      tinggal_kec: normalize(tinggalNamaKec),
      tinggal_kode_kel: normalize(tinggalKodeKel),
      tinggal_kel: normalize(tinggalNamaKel),
      tinggal_kode_dusun: normalize(tinggalKodeDusun),
      tinggal_dusun: normalize(tinggalNamaDusun),
      tinggal_kode_pos: normalize(tinggal_kode_pos),
      tinggal_rt: normalize(tinggal_rt),
      tinggal_rw: normalize(tinggal_rw),
      tinggal_alamat: normalize(tinggal_alamat),

      kerja_kode_prov: normalize(kerjaKodeProv),
      kerja_prov: normalize(kerjaNamaProv),
      kerja_kode_kab: normalize(kerjaKodeKab),
      kerja_kab_kota: normalize(kerjaNamaKab),
      kerja_kode_kec: normalize(kerjaKodeKec),
      kerja_kec: normalize(kerjaNamaKec),
      kerja_kode_kel: normalize(kerjaKodeKel),
      kerja_kel: normalize(kerjaNamaKel),
      kerja_kode_dusun: normalize(kerjaKodeDusun),
      kerja_dusun: normalize(kerjaNamaDusun),
      kerja_kode_pos: normalize(kerja_kode_pos),
      kerja_rt: normalize(kerja_rt),
      kerja_rw: normalize(kerja_rw),
      kerja_alamat: normalize(kerja_alamat),

      alamat_kerja_sama_dengan_tinggal: normalize(alamat_kerja_sama_dengan_tinggal),

      ayah_nama: normalize(ayah_nama),
      ayah_nik: normalize(ayah_nik),
      ayah_jenjang_pendidikan: normalize(ayah_jenjang_pendidikan),
      ayah_pekerjaan: normalize(ayah_pekerjaan),
      ayah_penghasilan: normalize(ayah_penghasilan),
      ayah_id_status_hidup: normalize(ayahStatusHidup),
      ayah_status_hidup: normalize(ayahNamaStatusHidup),
      ayah_id_status_kekerabatan: normalize(ayahStatusKekerabatan),
      ayah_status_kekerabatan: normalize(ayahNamaStatusKekerabatan),
      ayah_tempat_lahir: normalize(ayah_tempat_lahir),
      ayah_tanggal_lahir: normalize(ayah_tanggal_lahir),
      ayah_no_hp: normalize(ayah_no_hp),
      ayah_email: normalize(ayah_email),
      ayah_alamat: normalize(ayah_alamat),

      ibu_nama: normalize(ibu_nama),
      ibu_nik: normalize(ibu_nik),
      ibu_jenjang_pendidikan: normalize(ibu_jenjang_pendidikan),
      ibu_pekerjaan: normalize(ibu_pekerjaan),
      ibu_penghasilan: normalize(ibu_penghasilan),
      ibu_id_status_hidup: normalize(ibuStatusHidup),
      ibu_status_hidup: normalize(ibuNamaStatusHidup),
      ibu_id_status_kekerabatan: normalize(ibuStatusKekerabatan),
      ibu_status_kekerabatan: normalize(ibuNamaStatusKekerabatan),
      ibu_tempat_lahir: normalize(ibu_tempat_lahir),
      ibu_tanggal_lahir: normalize(ibu_tanggal_lahir),
      ibu_no_hp: normalize(ibu_no_hp),
      ibu_email: normalize(ibu_email),
      ibu_alamat: normalize(ibu_alamat),

      wali_nama: normalize(wali_nama),
      wali_nik: normalize(wali_nik),
      wali_jenjang_pendidikan: normalize(wali_jenjang_pendidikan),
      wali_pekerjaan: normalize(wali_pekerjaan),
      wali_penghasilan: normalize(wali_penghasilan),
      wali_id_status_hidup: normalize(waliStatusHidup),
      wali_status_hidup: normalize(waliNamaStatusHidup),
      wali_id_status_kekerabatan: normalize(waliStatusKekerabatan),
      wali_status_kekerabatan: normalize(waliNamaStatusKekerabatan),
      wali_tempat_lahir: normalize(wali_tempat_lahir),
      wali_tanggal_lahir: normalize(wali_tanggal_lahir),
      wali_no_hp: normalize(wali_no_hp),
      wali_email: normalize(wali_email),
      wali_alamat: normalize(wali_alamat),

      sekolah_kode_prov: normalize(sekolahKodeProv),
      sekolah_prov: normalize(sekolahNamaProv),
      sekolah_kode_kab: normalize(sekolahKodeKab),
      sekolah_kab_kota: normalize(sekolahNamaKab),
      id_jenjang_sekolah: normalize(idJenjangSekolah),
      jenjang_sekolah: normalize(jenjangSekolah),
      sekolah: normalize(sekolah),
      jurusan: normalize(jurusan),
      tahun_lulus: normalize(tahun_lulus),
      nama_jurusan_sekolah: normalize(nama_jurusan_sekolah),

      kondisi_buta_warna: normalize(kondisi_buta_warna),

      kode_dinas_provinsi: normalize(idDinasprov),
      kode_dinas_kabkota: normalize(idDinaskabkota),

      id_jalur: normalize(idJalur),
      jalur: normalize(namaJalur),
      updated_at: new Date(),
    };

    // ✅ Update foto hanya jika file dikirim (tidak overwrite jika tidak ada)
    if (fotoFile) updateData.foto = fotoFile.filename;
    if (fotoDepanFile) updateData.foto_depan = fotoDepanFile.filename;
    if (fotoKiriFile) updateData.foto_samping_kiri = fotoKiriFile.filename;
    if (fotoKananFile) updateData.foto_samping_kanan = fotoKananFile.filename;
    if (fotoBelakangFile) updateData.foto_belakang = fotoBelakangFile.filename;

    // Ambil current flow
    const trxBeasiswa = await TrxBeasiswa.findOne({
      where: { id_trx_beasiswa },
      attributes: ["id_flow", "kode_pendaftaran"],
    });

    const currentFlow = trxBeasiswa?.id_flow;
    const is_draftx = is_draft === "true";

    if (!is_draftx) {
      if (currentFlow === 0) {
        updateData.id_flow = 1;
        updateData.flow = "Draft";

        if (!trxBeasiswa.kode_pendaftaran) {
          const kodePendaftaran = await generateKodePendaftaran(idJalur);
          updateData.kode_pendaftaran = kodePendaftaran;
        }
      }
      if (currentFlow === 1) {
        updateData.id_flow = 2;
        updateData.flow = "Verifikasi";
      } else if (currentFlow === 4) {
        updateData.id_flow = 5;
        updateData.flow = "Verifikasi Hasil Perbaikan";
      } else if (currentFlow === 9) {
        updateData.id_flow = 10;
        updateData.flow = "Verifikasi Hasil Perbaikan";
      }
    }

    if (!is_draftx) {
      const existingTrx = await TrxBeasiswa.findOne({
        where: { id_trx_beasiswa },
        attributes: ["sequence"],
      });

      if (!existingTrx?.sequence) {
        const lastSeq = await TrxBeasiswa.findOne({
          where: { id_jalur: normalize(idJalur), sequence: { [Op.ne]: null } },
          order: [["sequence", "DESC"]],
          attributes: ["sequence"],
        });

        updateData.sequence = lastSeq ? lastSeq.sequence + 1 : 1;
      }
    }
    // ✅ Sync tag_sktm: cek apakah dokumen SKTM (id_ref_dokumen=13) sudah ada
    const sktmDoc = await TrxDokumenUmum.findOne({
      where: { id_trx_beasiswa, id_ref_dokumen: 13 },
      attributes: ["id"],
    });
    updateData.tag_sktm = sktmDoc ? "1" : "0";

    await TrxBeasiswa.update(updateData, {
      where: { id_trx_beasiswa },
    });

    // Pilihan Prodi
    await TrxPilihanProgramStudi.destroy({
      where: { id_trx_beasiswa },
    });

    const pilihan_program_studix = JSON.parse(req.body.pilihan_program_studi);

    const insertDataPilihanProgramSudi = pilihan_program_studix.map((item) => {
      const [id_pt, nama_pt] = safeSplit(item.perguruan_tinggi);
      const [id_prodi, nama_prodi] = safeSplit(item.program_studi);

      return {
        id_trx_beasiswa,
        id_pt: id_pt ? Number(id_pt) : null,
        nama_pt,
        id_prodi: id_prodi ? Number(id_prodi) : null,
        nama_prodi,
      };
    });

    if (insertDataPilihanProgramSudi.length > 0) {
      await TrxPilihanProgramStudi.bulkCreate(insertDataPilihanProgramSudi);
    }

    // 🚀 --- BLOK KIRIM EMAIL NOTIFIKASI JIKA BUKAN DRAFT --- 🚀
    if (!is_draftx && normalize(email)) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
          secure: process.env.SMTP_SECURE === "true",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        const finalKodePendaftaran = updateData.kode_pendaftaran || trxBeasiswa.kode_pendaftaran || "Sedang Diproses";

        const mailOptions = {
          from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_USER}>`,
          to: normalize(email),
          subject: "Pendaftaran Beasiswa Berhasil - Aplikasi Palma",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
              <h2 style="color: #2e7d32; text-align: center;">Pendaftaran Berhasil Disubmit</h2>
              <p>Halo <b>${normalize(nama_lengkap)}</b>,</p>
              <p>Selamat! Data pendaftaran beasiswa Anda telah berhasil kami terima dan saat ini telah masuk ke tahap verifikasi.</p>
              
              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 5px 0;"><b>Kode Pendaftaran:</b> ${finalKodePendaftaran}</p>
                <p style="margin: 5px 0;"><b>Jalur Pendaftaran:</b> ${normalize(namaJalur) || '-'}</p>
              </div>

              <p>Silakan pantau status kelulusan dan tahapan proses verifikasi Anda secara berkala melalui dashboard akun Palma Beasiswa Anda.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.BASE_URL || 'https://beasiswa.dev-palma.my.id'}" style="background-color: #2e7d32; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Masuk ke Dashboard</a>
              </div>
              
              <hr style="border: 0; border-top: 1px solid #eee; margin-top: 30px;" />
              <p style="font-size: 12px; color: #888; text-align: center;">&copy; ${new Date().getFullYear()} Aplikasi Palma Beasiswa. All rights reserved.</p>
            </div>
          `,
        };

        transporter.sendMail(mailOptions).catch(err => {
          console.error("Gagal mengirim email notifikasi pendaftaran:", err);
        });

      } catch (err) {
        console.error("Error setting up email:", err);
      }
    }

    return successResponse(res, "Transaksi berhasil diperbarui");
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

async function generateKodePendaftaran(idJalur) {
  try {
    // Dapatkan 2 digit terakhir tahun saat ini
    const tahun = new Date().getFullYear().toString().slice(-2);

    // Format kode jalur jadi 2 digit (misal: 1 → 01, 12 → 12)
    const kodeJalur = String(idJalur || '00').padStart(2, '0');

    // Prefix: TAHUN + KODE_JALUR (misal: 2601)
    const prefix = `${tahun}${kodeJalur}`;

    // ✅ Cari sequence terakhir untuk tahun dan jalur yang sama
    const lastRecord = await TrxBeasiswa.findOne({
      where: {
        kode_pendaftaran: {
          [Op.like]: `${prefix}%`
        }
      },
      order: [['kode_pendaftaran', 'DESC']],
      attributes: ['kode_pendaftaran']
    });

    let nextSequence = 1;

    if (lastRecord && lastRecord.kode_pendaftaran) {
      // Extract 6 digit terakhir dan tambah 1
      const lastSequence = parseInt(
        lastRecord.kode_pendaftaran.slice(-6)
      );

      if (!isNaN(lastSequence)) {
        nextSequence = lastSequence + 1;
      }
    }

    // Format sequence jadi 6 digit (misal: 1 → 000001)
    const sequence = String(nextSequence).padStart(6, '0');

    // Gabungkan: TAHUN + KODE_JALUR + SEQUENCE
    const kodePendaftaran = `${prefix}${sequence}`;

    return kodePendaftaran;

  } catch (error) {
    console.error('Error in generateKodePendaftaran:', error);
    throw error;
  }
}

exports.updateFlowBeasiswa = async (req, res) => {
  try {
    const { idTrxBeasiswa } = req.params;
    const { id_flow, catatan, verifikator, verifikasi_data } = req.body;

    const safeSplit = (value = "", delimiter = "#") => {
      if (typeof value !== "string" || !value.includes(delimiter)) {
        return [null, null];
      }
      const parts = value
        .split(delimiter)
        .map((v) => (v === "" || v === "null" ? null : v));
      return [parts[0], parts[1]];
    };

    // Ambil data pendaftar untuk kebutuhan pengiriman email
    const pendaftar = await TrxBeasiswa.findOne({
      where: { id_trx_beasiswa: idTrxBeasiswa },
      attributes: ["email", "nama_lengkap", "kode_pendaftaran"]
    });

    let idDinasprov = null, namaDinasprov = null;
    let idDinaskabkota = null, namaDinaskabkota = null;

    if (verifikasi_data) {
      [idDinasprov, namaDinasprov] = safeSplit(verifikasi_data.kode_dinas_provinsi);
      [idDinaskabkota, namaDinaskabkota] = safeSplit(verifikasi_data.kode_dinas_kabkota);
    }

    const updateData = {};

    if (verifikator == "ditjenbun") {
      updateData.verifikator_catatan = catatan;
    } else if (verifikator == "dinas") {
      updateData.verifikator_dinas_catatan = catatan;
    }

    if (id_flow == 3) {
      updateData.id_flow = 3;
      updateData.flow = "Tolak";

      // 🚀 --- BLOK KIRIM EMAIL NOTIFIKASI PENOLAKAN --- 🚀
      if (pendaftar && pendaftar.email) {
        try {
          const transporter = require("nodemailer").createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_SECURE === "true",
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          });

          const mailOptions = {
            from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_USER}>`,
            to: pendaftar.email,
            subject: "Pemberitahuan Hasil Verifikasi Administrasi - Aplikasi Palma",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <h2 style="color: #d32f2f; text-align: center;">Pemberitahuan Verifikasi Administrasi</h2>
                <p>Halo <b>${pendaftar.nama_lengkap}</b>,</p>
                <p>Terima kasih atas partisipasi Anda dalam pendaftaran Beasiswa. Setelah melakukan verifikasi dan penelaahan terhadap berkas pendaftaran Anda (Kode Pendaftaran: <b>${pendaftar.kode_pendaftaran || '-'}</b>), dengan berat hati kami sampaikan bahwa pendaftaran Anda <b>TIDAK LULUS</b> (Ditolak).</p>
                
                <div style="background-color: #fff3f3; border-left: 4px solid #d32f2f; padding: 15px; margin: 20px 0;">
                  <p style="margin: 0; color: #d32f2f; font-size: 14px;"><b>Alasan Penolakan / Catatan Verifikator:</b></p>
                  <p style="margin: 5px 0 0 0; color: #333;"><i>"${catatan || 'Tidak ada catatan tambahan.'}"</i></p>
                </div>

                <p>Jangan patah semangat dan teruslah berusaha. Terima kasih atas ketertarikan Anda pada program beasiswa kami.</p>
                
                <hr style="border: 0; border-top: 1px solid #eee; margin-top: 30px;" />
                <p style="font-size: 12px; color: #888; text-align: center;">&copy; ${new Date().getFullYear()} Aplikasi Palma Beasiswa. All rights reserved.</p>
              </div>
            `,
          };

          // Kirim secara asinkron agar tidak membuat aplikasi loading lama
          transporter.sendMail(mailOptions).catch(err => {
            console.error("Gagal mengirim email penolakan:", err);
          });

        } catch (err) {
          console.error("Error setting up email untuk penolakan:", err);
        }
      }
      // ---------------------------------------------------------

    } else if (id_flow == 4) {
      updateData.id_flow = 4;
      updateData.flow = "Perlu Perbaikan";
    } else if (id_flow == 7) {
      updateData.id_flow = 7;
      updateData.flow = "Verifikasi Dinas Provinsi";
      updateData.status_lulus_administrasi = "Y";
      updateData.kode_dinas_provinsi = idDinasprov;
      updateData.kode_dinas_kabkota = idDinaskabkota;
      updateData.nama_dinas_provinsi = namaDinasprov;
      updateData.nama_dinas_kabkota = namaDinaskabkota;
      updateData.timestamp_dinas_provinsi = new Date();
    } else if (id_flow == 6) {
      updateData.id_flow = 6;
      updateData.flow = "Verifikasi Dinas Kabupaten/Kota";
      updateData.status_lulus_administrasi = "Y";
      updateData.kode_dinas_provinsi = idDinasprov;
      updateData.kode_dinas_kabkota = idDinaskabkota;
      updateData.nama_dinas_provinsi = namaDinasprov;
      updateData.nama_dinas_kabkota = namaDinaskabkota;
      updateData.timestamp_dinas_kabkota = new Date();
    } else if (id_flow == 9) {
      updateData.id_flow = 9;
      updateData.flow = "Proses Analisa Rasio";
    } else if (id_flow == 10) {
      updateData.id_flow = 10;
      updateData.flow = "Proses Wawancara & Test Akademik";
    } else if (id_flow == 72) {
      updateData.status_dari_verifikator_dinas = "Y";
    } else if (id_flow == 13) {
      updateData.id_flow = 13;
      updateData.flow = "Lulus Administrasi - Pembagian Wilayah";
    } else if (id_flow == 11) {
      updateData.id_flow = 11;
      updateData.flow = "Analisa dan Penelaahan";
    }

    await TrxBeasiswa.update(updateData, {
      where: { id_trx_beasiswa: idTrxBeasiswa },
    });

    // Data section
    if (verifikasi_data) {
      const insertDataSection = {
        id_trx_beasiswa: idTrxBeasiswa,
        data_pribadi_is_valid: verifikasi_data.data_pribadi_is_valid,
        data_pribadi_catatan: verifikasi_data.data_pribadi_catatan,
        data_tempat_tinggal_is_valid: verifikasi_data.data_tempat_tinggal_is_valid,
        data_tempat_tinggal_catatan: verifikasi_data.data_tempat_tinggal_catatan,
        data_tempat_bekerja_is_valid: verifikasi_data.data_tempat_bekerja_is_valid,
        data_tempat_bekerja_catatan: verifikasi_data.data_tempat_bekerja_catatan,
        data_tempat_tinggal_bekerja_is_valid: verifikasi_data.data_tempat_tinggal_bekerja_is_valid,
        data_tempat_tinggal_bekerja_catatan: verifikasi_data.data_tempat_tinggal_bekerja_catatan,
        data_orang_tua_is_valid: verifikasi_data.data_orang_tua_is_valid,
        data_orang_tua_catatan: verifikasi_data.data_orang_tua_catatan,
        data_pendidikan_is_valid: verifikasi_data.data_pendidikan_is_valid,
        data_pendidikan_catatan: verifikasi_data.data_pendidikan_catatan,
        data_program_studi_is_valid: verifikasi_data.data_program_studi_is_valid,
        data_program_studi_catatan: verifikasi_data.data_program_studi_catatan,
        created_at: new Date(),
        created_by: req.user.nama,
      };

      // Cek apakah sudah ada record untuk id_trx_beasiswa ini
      const existingRecord = await TrxCatatanDataSection.findOne({
        where: { id_trx_beasiswa: idTrxBeasiswa },
      });

      if (existingRecord) {
        await TrxCatatanDataSection.update(insertDataSection, {
          where: { id_trx_beasiswa: idTrxBeasiswa },
        });
      } else {
        await TrxCatatanDataSection.create(insertDataSection);
      }
    }

    // Data catatan persyaratan
    const semuaPersyaratan = [
      ...(req.body.verifikasi_data?.data_persyaratan_umum || []),
      ...(req.body.verifikasi_data?.data_persyaratan_khusus || []),
    ];

    for (const item of semuaPersyaratan) {
      const { id: idTrxDokumen, kategori, catatan, is_valid } = item;

      const updatePersyaratanData = {};

      const kategoriUpper = kategori.toUpperCase();

      if (verifikator === "ditjenbun") {
        updatePersyaratanData.status_verifikasi =
          is_valid === "Y" ? "sesuai" : "tidak sesuai";
        if (catatan) updatePersyaratanData.verifikator_catatan = catatan;
        if (req.user?.nama) updatePersyaratanData.verifikator_nama = req.user.nama;
        updatePersyaratanData.verifikator_timestamp = new Date();
      } else if (verifikator === "dinas") {
        updatePersyaratanData.verifikator_dinas_is_valid = is_valid;
        if (catatan) updatePersyaratanData.verifikator_dinas_catatan = catatan;
        if (req.user?.nama) updatePersyaratanData.verifikator_dinas_nama = req.user.nama;
        updatePersyaratanData.verifikator_dinas_timestamp = new Date();
      }

      if (kategoriUpper === "UMUM") {
        await TrxDokumenUmum.update(updatePersyaratanData, {
          where: { id: idTrxDokumen },
        });
      } else if (kategoriUpper === "KHUSUS") {
        await TrxDokumenKhusus.update(updatePersyaratanData, {
          where: { id: idTrxDokumen },
        });
      }
    }

    return successResponse(res, "Berhasil melakukan verifikasi");
  } catch (error) {
    console.error(error);
    return errorResponse("Internal Server Error");
  }
};

exports.updateTaggingBeasiswa = async (req, res) => {
  try {
    const { idTrxBeasiswa } = req.params;
    const { tagging_alamat_kebun, tagging_alamat_bekerja } = req.body;

    const updateData = {
      tagging_alamat_kebun,
      tagging_alamat_bekerja,
    };

    await TrxBeasiswa.update(updateData, {
      where: { id_trx_beasiswa: idTrxBeasiswa },
    });

    return successResponse(res, "Berhasil melakukan perubahan data");
  } catch (error) {
    console.error(error);
    return errorResponse("Internal Server Error");
  }
};

exports.downloadExcelSeleksiWawancara = async (req, res) => {
  try {
    // Ambil semua data yang lolos administrasi
    const rows = await TrxBeasiswa.findAll({
      where: {
        id_flow: 7,
        status_lulus_administrasi: "Y",
      },
      order: [["id_trx_beasiswa", "ASC"]],
    });

    // Buat workbook Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data Seleksi");

    // Tambahkan catatan pertama di baris 1
    worksheet.mergeCells("A1:R1");
    const noteCell1 = worksheet.getCell("A1");
    noteCell1.value =
      'Ubah status lulus wawancara di kolom paling kanan: "Y" Jika lulus dan "N" jika tidak lulus';
    noteCell1.font = { color: { argb: "FF000000" } };
    noteCell1.alignment = { horizontal: "left", vertical: "middle" };
    noteCell1.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFFE0" },
    };

    // Tambahkan catatan kedua di baris 2
    worksheet.mergeCells("A2:R2");
    const noteCell2 = worksheet.getCell("A2");
    noteCell2.value = "Jangan ubah data lain!";
    noteCell2.font = { color: { argb: "FFFF0000" } };
    noteCell2.alignment = { horizontal: "left", vertical: "middle" };
    noteCell2.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFFE0" },
    };

    // Tentukan kolom Excel di baris ke-4
    worksheet.getRow(4).values = [
      "No",
      "NIK",
      "Nama Lengkap",
      "Email",
      "No HP",
      "Provinsi",
      "Kabupaten/Kota",
      "Kecamatan",
      "Kelurahan",
      "Alamat",
      "Jalur",
      "Tagging Alamat Kebun",
      "Tagging Alamat Bekerja",
      "Jenjang Sekolah",
      "Nama Sekolah",
      "Perguruan Tinggi",
      "Program Studi",
      "Status Lulus Wawancara",
    ];

    // Set lebar kolom
    worksheet.columns = [
      { key: "no", width: 6 },
      { key: "nik", width: 25 },
      { key: "nama_lengkap", width: 25 },
      { key: "email", width: 25 },
      { key: "no_hp", width: 25 },
      { key: "prov", width: 25 },
      { key: "kab_kota", width: 25 },
      { key: "kec", width: 25 },
      { key: "kel", width: 25 },
      { key: "alamat", width: 25 },
      { key: "jalur", width: 25 },
      { key: "tagging_alamat_kebun", width: 25 },
      { key: "tagging_alamat_bekerja", width: 25 },
      { key: "jenjang_sekolah", width: 25 },
      { key: "nama_sekolah", width: 25 },
      { key: "perguruan_tinggi", width: 25 },
      { key: "program_studi", width: 25 },
      { key: "status_lulus_wawancara", width: 25 },
    ];

    // Tambahkan isi data ke Excel mulai dari baris ke-5
    rows.forEach((row, index) => {
      worksheet.addRow({
        no: index + 1,
        nik: row.nik || "-",
        nama_lengkap: row.nama_lengkap || "-",
        email: row.email || "-",
        no_hp: row.no_hp || "-",
        prov: row.prov || "-",
        kab_kota: row.kab_kota || "-",
        kec: row.kec || "-",
        kel: row.kel || "-",
        alamat: row.alamat || "-",
        jalur: row.jalur || "-",
        tagging_alamat_kebun: row.tagging_alamat_kebun || "-",
        tagging_alamat_bekerja: row.tagging_alamat_bekerja || "-",
        jenjang_sekolah: row.jenjang_sekolah || "-",
        nama_sekolah: row.nama_sekolah || "-",
        perguruan_tinggi: row.perguruan_tinggi || "-",
        program_studi: row.program_studi || "-",
        status_lulus_wawancara: "",
      });
    });

    // Styling header (baris ke-4)
    worksheet.getRow(4).eachCell((cell) => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center" };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0F0FF" },
      };
    });

    // Set response agar langsung download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=data_seleksi.xlsx",
    );

    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Gagal mengunduh file Excel");
  }
};

exports.uploadExcelSeleksiWawancara = async (req, res) => {
  try {
    // Validasi file upload
    if (!req.file) {
      return errorResponse(res, "File Excel tidak ditemukan");
    }

    // Baca file Excel
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.getWorksheet("Data Seleksi");

    if (!worksheet) {
      return errorResponse(res, "Sheet 'Data Seleksi' tidak ditemukan");
    }

    let successCount = 0;
    let failedCount = 0;
    const errors = [];

    // Mulai dari baris ke-5 (karena baris 1-2 catatan, baris 3 kosong, baris 4 header)
    for (let i = 5; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);

      // Skip jika baris kosong
      if (!row.getCell(2).value) continue;

      const nik = row.getCell(2).value?.toString().trim();
      const statusLulusWawancara = row
        .getCell(18)
        .value?.toString()
        .trim()
        .toUpperCase();

      // Validasi status lulus wawancara
      if (
        !statusLulusWawancara ||
        (statusLulusWawancara !== "Y" && statusLulusWawancara !== "N")
      ) {
        failedCount++;
        errors.push({
          row: i,
          nik: nik,
          message: `Status lulus wawancara harus diisi dengan "Y" atau "N"`,
        });
        continue;
      }

      try {
        // Cari data berdasarkan NIK
        const trxBeasiswa = await TrxBeasiswa.findOne({
          where: {
            nik: nik,
            id_flow: 7,
            status_lulus_administrasi: "Y",
          },
        });

        if (!trxBeasiswa) {
          failedCount++;
          errors.push({
            row: i,
            nik: nik,
            message: "Data tidak ditemukan atau tidak lolos administrasi",
          });
          continue;
        }

        // Update data
        await trxBeasiswa.update({
          id_flow: 8,
          flow: "Proses Verifikasi Dinas",
          status_lulus_wawancara_akademik: statusLulusWawancara,
        });

        successCount++;
      } catch (error) {
        failedCount++;
        errors.push({
          row: i,
          nik: nik,
          message: error.message,
        });
      }
    }

    return successResponse(res, "Berhasil mengupload file Excel");
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Gagal mengupload file Excel");
  }
};

exports.downloadExcelHasilVerifikasiDinas = async (req, res) => {
  try {
    // Ambil semua data yang lolos administrasi
    const rows = await TrxBeasiswa.findAll({
      where: {
        id_flow: 11,
        status_lulus_administrasi: "Y",
      },
      order: [["id_trx_beasiswa", "ASC"]],
    });

    // Buat workbook Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data Seleksi");

    // Tambahkan catatan pertama di baris 1
    worksheet.mergeCells("A1:R1");
    const noteCell1 = worksheet.getCell("A1");
    noteCell1.value =
      'Ubah status hasil analisa rasio di kolom paling kanan: "Y" Jika lulus dan "N" jika tidak lulus';
    noteCell1.font = { color: { argb: "FF000000" } };
    noteCell1.alignment = { horizontal: "left", vertical: "middle" };
    noteCell1.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFFE0" },
    };

    // Tambahkan catatan kedua di baris 2
    worksheet.mergeCells("A2:R2");
    const noteCell2 = worksheet.getCell("A2");
    noteCell2.value = "Jangan ubah data lain!";
    noteCell2.font = { color: { argb: "FFFF0000" } };
    noteCell2.alignment = { horizontal: "left", vertical: "middle" };
    noteCell2.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFFE0" },
    };

    // Tentukan kolom Excel di baris ke-4
    worksheet.getRow(4).values = [
      "No",
      "NIK",
      "Nama Lengkap",
      "Email",
      "No HP",
      "Provinsi",
      "Kabupaten/Kota",
      "Kecamatan",
      "Kelurahan",
      "Alamat",
      "Jalur",
      "Tagging Alamat Kebun",
      "Tagging Alamat Bekerja",
      "Jenjang Sekolah",
      "Nama Sekolah",
      "Perguruan Tinggi",
      "Program Studi",
      "Status Hasil Analisa Rasio",
    ];

    // Set lebar kolom
    worksheet.columns = [
      { key: "no", width: 6 },
      { key: "nik", width: 25 },
      { key: "nama_lengkap", width: 25 },
      { key: "email", width: 25 },
      { key: "no_hp", width: 25 },
      { key: "prov", width: 25 },
      { key: "kab_kota", width: 25 },
      { key: "kec", width: 25 },
      { key: "kel", width: 25 },
      { key: "alamat", width: 25 },
      { key: "jalur", width: 25 },
      { key: "tagging_alamat_kebun", width: 25 },
      { key: "tagging_alamat_bekerja", width: 25 },
      { key: "jenjang_sekolah", width: 25 },
      { key: "nama_sekolah", width: 25 },
      { key: "perguruan_tinggi", width: 25 },
      { key: "program_studi", width: 25 },
      { key: "status_hasil_analisa_rasio", width: 25 },
    ];

    // Tambahkan isi data ke Excel mulai dari baris ke-5
    rows.forEach((row, index) => {
      worksheet.addRow({
        no: index + 1,
        nik: row.nik || "-",
        nama_lengkap: row.nama_lengkap || "-",
        email: row.email || "-",
        no_hp: row.no_hp || "-",
        prov: row.prov || "-",
        kab_kota: row.kab_kota || "-",
        kec: row.kec || "-",
        kel: row.kel || "-",
        alamat: row.alamat || "-",
        jalur: row.jalur || "-",
        tagging_alamat_kebun: row.tagging_alamat_kebun || "-",
        tagging_alamat_bekerja: row.tagging_alamat_bekerja || "-",
        jenjang_sekolah: row.jenjang_sekolah || "-",
        nama_sekolah: row.nama_sekolah || "-",
        perguruan_tinggi: row.perguruan_tinggi || "-",
        program_studi: row.program_studi || "-",
        status_hasil_analisa_rasio: "",
      });
    });

    // Styling header (baris ke-4)
    worksheet.getRow(4).eachCell((cell) => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center" };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0F0FF" },
      };
    });

    // Set response agar langsung download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=data_seleksi.xlsx",
    );

    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Gagal mengunduh file Excel");
  }
};

exports.uploadExcelHasilVerifikasiDinas = async (req, res) => {
  try {
    // Validasi file upload
    if (!req.file) {
      return errorResponse(res, "File Excel tidak ditemukan");
    }

    // Baca file Excel
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.getWorksheet("Data Seleksi");

    if (!worksheet) {
      return errorResponse(res, "Sheet 'Data Seleksi' tidak ditemukan");
    }

    let successCount = 0;
    let failedCount = 0;
    const errors = [];

    // Mulai dari baris ke-5 (karena baris 1-2 catatan, baris 3 kosong, baris 4 header)
    for (let i = 5; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);

      // Skip jika baris kosong
      if (!row.getCell(2).value) continue;

      const nik = row.getCell(2).value?.toString().trim();
      const statusHasilAnalisaRasio = row
        .getCell(18)
        .value?.toString()
        .trim()
        .toUpperCase();

      // Validasi status lulus wawancara
      if (
        !statusHasilAnalisaRasio ||
        (statusHasilAnalisaRasio !== "Y" && statusHasilAnalisaRasio !== "N")
      ) {
        failedCount++;
        errors.push({
          row: i,
          nik: nik,
          message: `Status hasil analisa rasio harus diisi dengan "Y" atau "N"`,
        });
        continue;
      }

      try {
        // Cari data berdasarkan NIK
        const trxBeasiswa = await TrxBeasiswa.findOne({
          where: {
            nik: nik,
            id_flow: 11,
            status_dari_verifikator_dinas: "Y",
          },
        });

        if (!trxBeasiswa) {
          failedCount++;
          errors.push({
            row: i,
            nik: nik,
            message: "Data tidak ditemukan atau tidak lolos administrasi",
          });
          continue;
        }

        // Update data
        await trxBeasiswa.update({
          id_flow: 11,
          status_hasil_analisa_rasio: statusHasilAnalisaRasio,
        });

        successCount++;
      } catch (error) {
        failedCount++;
        errors.push({
          row: i,
          nik: nik,
          message: error.message,
        });
      }
    }

    return successResponse(res, "Berhasil mengupload file Excel");
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Gagal mengupload file Excel");
  }
};

exports.uploadBeritaAcaraDinas = async (req, res) => {
  try {
    // Validasi file upload
    if (!req.file) {
      return errorResponse(res, "File Excel tidak ditemukan");
    }

    const { filename } = req.file;

    // Ambil semua data yang status dari verifikator nya Y
    const trxBeasiswaList = await TrxBeasiswa.findAll({
      where: {
        id_flow: 8,
        status_dari_verifikator_dinas: "Y",
      },
    });

    // Update semua data trxBeasiswa ke 11
    for (const item of trxBeasiswaList) {
      await item.update({
        id_flow: 11,
        flow: "Proses Analisa Rasio",
        berita_acara_verifikator_dinas: filename,
      });
    }

    return successResponse(res, "Berhasil mengupload file Excel");
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Gagal mengupload file Excel");
  }
};

// controller/beasiswaController.js
exports.getTransaksiBeasiswaByWilayah = async (req, res) => {
  try {
    const { beasiswaId } = req.params;
    const { page = 1, search = "", kodeProvinsi, kodeKabkota } = req.query;

    const limit = 10;
    const offset = (page - 1) * limit;

    const whereCondition = {
      beasiswa_id: beasiswaId,
      status_aktif: true, // Sesuaikan dengan field status di tabel Anda
    };

    // Build where untuk user/mahasiswa
    const userWhere = {};

    if (search) {
      userWhere[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { nim: { [Op.like]: `%${search}%` } },
      ];
    }

    // Filter berdasarkan wilayah
    if (kodeProvinsi) {
      userWhere.kode_pro = kodeProvinsi;
    }

    if (kodeKabkota) {
      userWhere.kode_kab = kodeKabkota;
    }

    const { count, rows } = await TrxBeasiswa.findAndCountAll({
      where: whereCondition,
      include: [
        {
          model: User, // atau model Mahasiswa sesuai struktur Anda
          as: "user",
          where: userWhere,
          attributes: [
            "id",
            "name",
            "email",
            "nim",
            "kode_pro",
            "kode_kab",
            "kode_kec",
            "kode_kel",
          ],
          include: [
            {
              model: RefWilayah,
              as: "provinsi",
              foreignKey: "kode_pro",
              attributes: ["wilayah_id", "nama_wilayah"],
              required: false,
            },
            {
              model: RefWilayah,
              as: "kabkota",
              foreignKey: "kode_kab",
              attributes: ["wilayah_id", "nama_wilayah"],
              required: false,
            },
          ],
        },
        {
          model: Beasiswa,
          as: "beasiswa",
          attributes: ["id", "nama_beasiswa", "tahun_ajaran"],
        },
      ],
      limit,
      offset,
      order: [["created_at", "DESC"]],
      distinct: true,
    });

    const result = {
      result: rows,
      total: count,
      total_pages: Math.ceil(count / limit),
      current_page: parseInt(page),
    };

    return successResponse(res, "Data berhasil dimuat", result);
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error");
  }
};

// Get jumlah pendaftar per provinsi (hanya kode)
exports.getCountByProvinsi = async (req, res) => {
  try {
    const { beasiswaId } = req.params;

    const result = await TrxBeasiswa.findAll({
      where: {
        id_ref_beasiswa: beasiswaId,
        kode_dinas_provinsi: { [Op.ne]: null },
      },
      attributes: [
        "kode_dinas_provinsi",
        [
          fn("COUNT", col("id_trx_beasiswa")), // ✅ Gunakan fn dan col yang sudah di-import
          "jumlah_pendaftar",
        ],
      ],
      group: ["kode_dinas_provinsi"],
      order: [[literal("jumlah_pendaftar"), "DESC"]], // ✅ Gunakan literal yang sudah di-import
      raw: true,
    });

    return successResponse(res, "Data berhasil dimuat", result);
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.getCountByProvinsiProsesLembagaSeleksi = async (req, res) => {
  try {
    const { beasiswaId } = req.params;

    const result = await TrxBeasiswa.findAll({
      where: {
        id_ref_beasiswa: beasiswaId,
        id_flow: 10,
        kode_dinas_provinsi: { [Op.ne]: null },
      },
      attributes: [
        "kode_dinas_provinsi",
        [
          fn("COUNT", col("id_trx_beasiswa")), // ✅ Gunakan fn dan col yang sudah di-import
          "jumlah_pendaftar",
        ],
      ],
      group: ["kode_dinas_provinsi"],
      order: [[literal("jumlah_pendaftar"), "DESC"]], // ✅ Gunakan literal yang sudah di-import
      raw: true,
    });

    return successResponse(res, "Data berhasil dimuat", result);
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error");
  }
};

// Get jumlah pendaftar per kabkota (hanya kode)
exports.getCountByKabkota = async (req, res) => {
  try {
    const { beasiswaId, kodeProvinsi } = req.params;

    const result = await TrxBeasiswa.findAll({
      where: {
        id_ref_beasiswa: beasiswaId,
        kode_dinas_provinsi: kodeProvinsi,
        kode_dinas_kabkota: { [Op.ne]: null },
      },
      attributes: [
        "kode_dinas_kabkota",
        [
          fn("COUNT", col("id_trx_beasiswa")), // ✅ Gunakan fn dan col
          "jumlah_pendaftar",
        ],
      ],
      group: ["kode_dinas_kabkota"],
      order: [[literal("jumlah_pendaftar"), "DESC"]], // ✅ Gunakan literal
      raw: true,
    });

    return successResponse(res, "Data berhasil dimuat", result);
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error");
  }
};
exports.getCountDataProvByKabkota = async (req, res) => {
  try {
    const { beasiswaId, kodeProvinsi } = req.params;

    const result = await TrxBeasiswa.findAll({
      where: {
        id_ref_beasiswa: beasiswaId,
        kode_dinas_provinsi: kodeProvinsi,
        kode_dinas_kabkota: { [Op.ne]: null },
        id_flow: 7,
      },
      attributes: [
        "kode_dinas_kabkota",
        [
          fn("COUNT", col("id_trx_beasiswa")), // ✅ Gunakan fn dan col
          "jumlah_pendaftar",
        ],
      ],
      group: ["kode_dinas_kabkota"],
      order: [[literal("jumlah_pendaftar"), "DESC"]], // ✅ Gunakan literal
      raw: true,
    });

    return successResponse(res, "Data berhasil dimuat", result);
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error");
  }
};

// Get list pendaftar berdasarkan kabkota (hanya data beasiswa, tanpa nama wilayah)
exports.getPendaftarByKabkota = async (req, res) => {
  try {
    const { beasiswaId } = req.params;
    const { page = 1, search = "", kodeKabkota } = req.query;

    const limit = 10;
    const offset = (page - 1) * limit;

    const whereCondition = {
      id_ref_beasiswa: beasiswaId,
      kode_dinas_kabkota: kodeKabkota,
    };

    if (search) {
      whereCondition[Op.or] = [
        { nama_lengkap: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { nik: { [Op.like]: `%${search}%` } },
        { no_hp: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await TrxBeasiswa.findAndCountAll({
      where: whereCondition,
      attributes: [
        "id_trx_beasiswa",
        "nama_lengkap",
        "nik",
        "email",
        "no_hp",
        "tanggal_lahir",
        "tempat_lahir",
        "jenis_kelamin",
        "tinggal_kode_prov",    // hanya kode
        "tinggal_kode_kab",     // hanya kode
        "tinggal_kode_kec",     // hanya kode
        "tinggal_kode_kel",     // hanya kode
        "tinggal_alamat",
        "sekolah",
        "jurusan",
        "tahun_lulus",
        "jalur",
        "status_lulus_administrasi",
        "status_dari_verifikator_dinas",
        "verifikator_catatan",
      ],
      limit,
      offset,
      order: [["id_trx_beasiswa", "DESC"]],
    });

    const result = {
      result: rows,
      total: count,
      total_pages: Math.ceil(count / limit),
      current_page: parseInt(page),
    };

    return successResponse(res, "Data berhasil dimuat", result);
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error");
  }
};

// controller/beasiswaController.js

// Get detail pendaftar by ID
exports.getDetailPendaftar = async (req, res) => {
  try {
    const { idTrxBeasiswa } = req.params;

    const pendaftar = await TrxBeasiswa.findOne({
      where: {
        id_trx_beasiswa: idTrxBeasiswa,
      },
    });

    if (!pendaftar) {
      return errorResponse(res, "Data pendaftar tidak ditemukan", 404);
    }

    return successResponse(res, "Data berhasil dimuat", pendaftar);
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error");
  }
};
// Get pilihan program studi dengan format untuk form
exports.getPilihanProgramStudiForForm = async (req, res) => {
  try {
    const { idTrxBeasiswa } = req.params;

    const pilihan = await TrxPilihanProgramStudi.findAll({
      where: { id_trx_beasiswa: idTrxBeasiswa },
      order: [["id", "ASC"]],
    });

    const formatted = pilihan.map((item) => ({
      perguruan_tinggi: item.id_pt && item.nama_pt
        ? `${item.id_pt}#${item.nama_pt}`
        : "",
      program_studi: item.id_prodi && item.nama_prodi
        ? `${item.id_prodi}#${item.nama_prodi}`
        : "",
    }));

    return successResponse(res, "Data berhasil dimuat", formatted);
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};
// Get detail pilihan program studi dengan nama PT dan Prodi untuk parsing data existing
// exports.getPilihanProgramStudiWithDetails = async (req, res) => {
//   try {
//     const { idTrxBeasiswa } = req.params;

//     // Ambil data pilihan program studi
//     const pilihanProgramStudi = await TrxPilihanProgramStudi.findAll({
//       where: { id_trx_beasiswa: idTrxBeasiswa },
//       order: [["id", "ASC"]],
//     });

//     // Format data untuk frontend (format: "id#nama")
//     const formattedData = pilihanProgramStudi.map((item) => ({
//       perguruan_tinggi: item.id_pt && item.nama_pt
//         ? `${item.id_pt}#${item.nama_pt}`
//         : "",
//       program_studi: item.id_prodi && item.nama_prodi
//         ? `${item.id_prodi}#${item.nama_prodi}`
//         : "",
//       // Data mentah untuk reference
//       raw: {
//         id_pt: item.id_pt,
//         nama_pt: item.nama_pt,
//         id_prodi: item.id_prodi,
//         nama_prodi: item.nama_prodi,
//       }
//     }));

//     return successResponse(
//       res,
//       "Data pilihan program studi berhasil dimuat",
//       formattedData
//     );
//   } catch (error) {
//     console.error(error);
//     return errorResponse(res, "Internal Server Error");
//   }
// };

exports.getPilihanProgramStudiWithDetails = async (req, res) => {
  try {
    const { idTrxBeasiswa } = req.params;

    const pilihanProgramStudi = await TrxPilihanProgramStudi.findAll({
      where: { id_trx_beasiswa: idTrxBeasiswa },
      order: [["id", "ASC"]],
    });

    const formattedData = pilihanProgramStudi.map((item) => ({
      perguruan_tinggi: item.id_pt && item.nama_pt
        ? `${item.id_pt}#${item.nama_pt}`
        : "",
      program_studi: item.id_prodi && item.nama_prodi
        ? `${item.id_prodi}#${item.nama_prodi}`
        : "",
      // 🔥 Tambahkan field terpisah untuk mapping
      id_pt: item.id_pt,
      id_prodi: item.id_prodi,
    }));

    return successResponse(
      res,
      "Data pilihan program studi berhasil dimuat",
      formattedData
    );
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.downloadRekapBeasiswaDaerah = async (req, res) => {
  try {
    // Ambil SEMUA data beasiswa yang sudah lulus proses provinsi
    const rows = await TrxBeasiswa.findAll({
      where: {
        id_flow: 15, // Lulus Proses Provinsi
      },
      attributes: [
        'nama_lengkap',
        'kode_dinas_provinsi',
        'nama_dinas_provinsi',
        'kode_dinas_kabkota',
        'nama_dinas_kabkota'
      ],
      order: [
        ['kode_dinas_provinsi', 'ASC'],
        ['kode_dinas_kabkota', 'ASC'],
        ['nama_lengkap', 'ASC']
      ],
    });

    // Buat workbook Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Rekap Data Beasiswa");

    // Header
    worksheet.getRow(1).values = [
      "No",
      "Provinsi",
      "Kabupaten/Kota",
      "Nama Lengkap"
    ];

    // Set lebar kolom
    worksheet.columns = [
      { key: "no", width: 6 },
      { key: "provinsi", width: 30 },
      { key: "kabkota", width: 30 },
      { key: "nama", width: 40 }
    ];

    // Isi data
    rows.forEach((row, index) => {
      worksheet.addRow({
        no: index + 1,
        provinsi: row.nama_dinas_provinsi || "-",
        kabkota: row.nama_dinas_kabkota || "-",
        nama: row.nama_lengkap || "-"
      });
    });

    // Styling header
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center" };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0F0FF" }
      };
    });

    // Set response
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=rekap_beasiswa_daerah.xlsx"
    );

    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Gagal mengunduh file Excel");
  }
};

exports.getTotalTrxBeasiswa = async (req, res) => {
  try {
    const total = await TrxBeasiswa.count();
    return successResponse(res, "Data berhasil dimuat", { total });
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

// Backend - tambah endpoint ringan ini
exports.getBebanVerifikator = async (req, res) => {
  try {
    const result = await TrxBeasiswa.findAll({
      attributes: [
        "id_verifikator",
        [fn("COUNT", col("id_trx_beasiswa")), "total_beban"],
      ],
      where: {
        id_verifikator: { [Op.ne]: null },
      },
      group: ["id_verifikator"],
      raw: true,
    });

    return successResponse(res, "Data berhasil dimuat", result);
  } catch (error) {
    return errorResponse(res, "Internal Server Error");
  }
};

// Save catatan verifikasi per section
exports.saveCatatanVerifikasi = async (req, res) => {
  try {
    const { idTrxBeasiswa } = req.params;
    const {
      catatan_verifikasi_verifikator,
      catatan_verifikasi_dinas_kabkota,
      catatan_verifikasi_dinas_provinsi,
      verifikator, // "ditjenbun" | "dinas_kabkota" | "dinas_provinsi"
    } = req.body;

    const existing = await TrxCatatanVerifikasiSection.findOne({
      where: { id_trx_beasiswa: idTrxBeasiswa },
    });

    // Bangun data update sesuai peran yang mengirim
    const data = {};

    if (verifikator === "ditjenbun" && catatan_verifikasi_verifikator != null) {
      data.catatan_verifikasi_verifikator = catatan_verifikasi_verifikator;
      // data.catatan_by_verifikator = req.user?.nama ?? null;
    }

    if (verifikator === "dinas_kabkota" && catatan_verifikasi_dinas_kabkota != null) {
      data.catatan_verifikasi_dinas_kabkota = catatan_verifikasi_dinas_kabkota;
      data.catatan_by_dinas_kabkota = req.user?.nama ?? null;
    }

    if (verifikator === "dinas_provinsi" && catatan_verifikasi_dinas_provinsi != null) {
      data.catatan_verifikasi_dinas_provinsi = catatan_verifikasi_dinas_provinsi;
      data.catatan_by_provinsi = req.user?.nama ?? null;
    }

    if (existing) {
      await TrxCatatanVerifikasiSection.update(data, {
        where: { id_trx_beasiswa: idTrxBeasiswa },
      });
    } else {
      await TrxCatatanVerifikasiSection.create({
        ...data,
        id_trx_beasiswa: idTrxBeasiswa,
        created_at: new Date(),
        created_by: req.user?.nama ?? null,
      });
    }

    return successResponse(res, "Catatan verifikasi berhasil disimpan");
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

// Get catatan verifikasi berdasarkan id transaksi beasiswa
exports.getCatatanVerifikasi = async (req, res) => {
  try {
    const { idTrxBeasiswa } = req.params;

    const catatan = await TrxCatatanVerifikasiSection.findOne({
      where: { id_trx_beasiswa: idTrxBeasiswa },
    });

    if (!catatan) {
      return successResponse(res, "Belum ada catatan verifikasi", null);
    }

    return successResponse(res, "Data berhasil dimuat", catatan);
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

// Update tag dinas kabkota
exports.updateTagDinasKabkota = async (req, res) => {
  try {
    const { idTrxBeasiswa } = req.params;
    const { tag } = req.body; // "Y" atau "N"

    if (!tag || !["Y", "N"].includes(tag)) {
      return failResponse(res, "Nilai tag tidak valid");
    }

    await TrxBeasiswa.update(
      {
        tag_dinas_kabkot: tag,
        nama_verifikator_dinas_kabkota: req.user?.nama ?? null,
        timestamp_dinas_kabkota: new Date(),
      },
      { where: { id_trx_beasiswa: idTrxBeasiswa } },
    );

    return successResponse(res, "Tag dinas kabupaten/kota berhasil diperbarui");
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

// Update tag dinas provinsi
exports.updateTagDinasProvinsi = async (req, res) => {
  try {
    const { idTrxBeasiswa } = req.params;

    await TrxBeasiswa.update(
      {
        tag_dinas_provinsi: "Y",
        nama_verifikator_dinas_provinsi: req.user?.nama ?? null,
        timestamp_dinas_provinsi: new Date(),
      },
      { where: { id_trx_beasiswa: idTrxBeasiswa } },
    );

    return successResponse(res, "Tag dinas provinsi berhasil diperbarui");
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.submitTagDinasKabkotaToProvinsi = async (req, res) => {
  try {
    const { idBeasiswa } = req.params;
    const { kode_kab, kode_prov } = req.user;

    const [updatedCount] = await TrxBeasiswa.update(
      {
        id_flow: 7,
        flow: "Verifikasi Dinas Provinsi",
        // file_keputusan_kabkot: filename,
      },
      {
        where: {
          // id_ref_beasiswa: idBeasiswa,
          id_flow: 6,
          tag_dinas_kabkot: "Y",
          kode_dinas_kabkota: kode_kab,
          kode_dinas_provinsi: kode_prov,
        },
      },
    );

    return successResponse(
      res,
      `Berhasil mengirim ${updatedCount} data ke provinsi`,
      { updated: updatedCount },
    );
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.submitTagDinasProvinsiToDitjenbun = async (req, res) => {
  try {
    const { idBeasiswa } = req.params;
    const { kode_kab, kode_prov } = req.user;

    const [updatedCount] = await TrxBeasiswa.update(
      {
        id_flow: 9,
        flow: "Proses Analisa Rasio",
        // file_keputusan_kabkot: filename,
      },
      {
        where: {
          // id_ref_beasiswa: idBeasiswa,
          id_flow: 7,
          // tag_dinas_kabkot: "Y",
          tag_dinas_provinsi: "Y",
          // kode_dinas_kabkota: kode_kab,
          kode_dinas_provinsi: kode_prov,
        },
      },
    );

    return successResponse(
      res,
      `Berhasil mengirim ${updatedCount} data ke ditjenbun`,
      { updated: updatedCount },
    );
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.getCountTagSiapKirimKabkota = async (req, res) => {
  try {
    const { idBeasiswa } = req.params;
    const { kode_kab } = req.user;

    const count = await TrxBeasiswa.count({
      where: {
        // id_trx_beasiswa: idBeasiswa,
        id_flow: 6,
        tag_dinas_kabkot: "Y",
        kode_dinas_kabkota: kode_kab,
      },
    });

    return successResponse(res, "Data berhasil dimuat", { count });
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.getCountTagSiapKirimProvinsi = async (req, res) => {
  try {
    const { idBeasiswa } = req.params;
    const { kode_prov } = req.user;

    const count = await TrxBeasiswa.count({
      where: {
        // id_trx_beasiswa: idBeasiswa,
        id_flow: 7,
        tag_dinas_provinsi: "Y",
        kode_dinas_provinsi: kode_prov,
      },
    });

    return successResponse(res, "Data berhasil dimuat", { count });
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.getSkKabkotaByProvinsi = async (req, res) => {
  try {
    const { idBeasiswa } = req.params;
    const { kode_prov } = req.user;

    const skList = await TrxSkDinasKabkota.findAll({
      where: {
        // id_ref_beasiswa: idBeasiswa,
        kode_dinas_provinsi: kode_prov,
      },
      order: [["created_at", "DESC"]],
    });

    return successResponse(res, "Data berhasil dimuat", skList);
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

// Get list pendaftar berdasarkan provinsi
exports.getPendaftarByProvinsi = async (req, res) => {
  try {
    const { beasiswaId } = req.params;
    const { page = 1, search = "", kodeProvinsi } = req.query;

    const limit = 10;
    const offset = (page - 1) * limit;

    const whereCondition = {
      id_ref_beasiswa: beasiswaId,
      kode_dinas_provinsi: kodeProvinsi,
      id_flow: 9
    };

    if (search) {
      whereCondition[Op.or] = [
        { nama_lengkap: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { nik: { [Op.like]: `%${search}%` } },
        { no_hp: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await TrxBeasiswa.findAndCountAll({
      where: whereCondition,
      attributes: [
        "id_trx_beasiswa",
        "nama_lengkap",
        "nik",
        "email",
        "no_hp",
        "tanggal_lahir",
        "tempat_lahir",
        "jenis_kelamin",
        "tinggal_kode_prov",
        "tinggal_kode_kab",
        "tinggal_kode_kec",
        "tinggal_kode_kel",
        "tinggal_alamat",
        "sekolah",
        "jurusan",
        "tahun_lulus",
        "jalur",
        "kode_dinas_provinsi",
        "nama_dinas_provinsi",
        "kode_dinas_kabkota",
        "nama_dinas_kabkota",
        "status_lulus_administrasi",
        "status_dari_verifikator_dinas",
        "verifikator_catatan",
        "tag_sktm",
      ],
      limit,
      offset,
      order: [["id_trx_beasiswa", "DESC"]],
    });

    const result = {
      result: rows,
      total: count,
      total_pages: Math.ceil(count / limit),
      current_page: parseInt(page),
    };

    return successResponse(res, "Data berhasil dimuat", result);
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error");
  }
};

// Backend — endpoint baru
exports.updateDokumenVerifikasiDinas = async (req, res) => {
  try {
    const { idTrxBeasiswa } = req.params;
    const { data_persyaratan_umum } = req.body;

    for (const item of (data_persyaratan_umum || [])) {
      const { id, is_valid, catatan } = item;

      await TrxDokumenUmum.update(
        {
          verifikator_dinas_is_valid: is_valid,
          verifikator_dinas_catatan: catatan ?? null,
          verifikator_dinas_nama: req.user?.nama ?? null,
          verifikator_dinas_timestamp: new Date(),
        },
        { where: { id } }
      );
    }

    return successResponse(res, "Dokumen verifikasi dinas berhasil diperbarui");
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

// Upload BA Dinas Kabkota
exports.uploadFileBA = async (req, res) => {
  try {
    const { beasiswaId } = req.params;

    if (!req.file) {
      return errorResponse(res, "File tidak ditemukan");
    }

    const user = req.user;

    await TrxBaDinasKabkota.create({
      id_ref_beasiswa: beasiswaId,
      kode_dinas_kabkota: user?.kode_kab ?? null,
      nama_dinas_kabkota: user?.nama_dinas ?? null,
      kode_dinas_provinsi: user?.kode_prov ?? null,
      nama_dinas_provinsi: user?.nama_provinsi ?? null,
      filename: req.file.filename,
      uploaded_by: user?.nama ?? null,
      created_at: new Date(),
    });

    return successResponse(res, "Berita acara berhasil diupload", {
      filename: req.file.filename,
    });
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

// Get BA by Beasiswa & Kabkota
exports.getBAKabkota = async (req, res) => {
  try {
    const { beasiswaId } = req.params;
    const user = req.user;

    const result = await TrxBaDinasKabkota.findAll({
      where: {
        id_ref_beasiswa: beasiswaId,
        kode_dinas_kabkota: user?.kode_kab ?? null,
      },
      order: [["created_at", "DESC"]],
    });

    return successResponse(res, "Data berhasil dimuat", result);
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.getBaKabkotaByProvinsi = async (req, res) => {
  try {
    const { idBeasiswa } = req.params;
    const { kode_prov } = req.user;

    const skList = await TrxBaDinasKabkota.findAll({
      where: {
        // id_ref_beasiswa: idBeasiswa,
        kode_dinas_provinsi: kode_prov,
      },
      order: [["created_at", "DESC"]],
    });

    return successResponse(res, "Data berhasil dimuat", skList);
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.getPendaftarForAssignment = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";
    const filter = req.query.filter || "all"; // "all" | "assigned" | "unassigned"
    const id_verifikator = req.query.id_verifikator || null;

    // ── Base condition ───────────────────────────────────────────────────────
    const baseCondition = {
      id_ref_beasiswa: 1,
      // id_flow: { [Op.ne]: 1 }, // exclude draft
      // id_flow: 1, // exclude draft
      // jalur: { [Op.ne]: null }
    };
    // ── Filter assign status ─────────────────────────────────────────────────
    if (filter === "assigned" || filter === "filter-assigned") {
      // ✅ jika ada id_verifikator spesifik, filter per selektor
      baseCondition.id_verifikator = id_verifikator
        ? Number(id_verifikator)
        : { [Op.ne]: null };
      baseCondition.id_flow = { [Op.ne]: 0 };
    } else if (filter === "unassigned" || filter === "filter-unassigned") {
      baseCondition.id_verifikator = null;
      baseCondition.id_flow = { [Op.or]: [1] };
    }

    // ── Search ───────────────────────────────────────────────────────────────
    const whereCondition = search
      ? {
        ...baseCondition,
        [Op.or]: [
          { nama_lengkap: { [Op.like]: `%${search}%` } },
          { nik: { [Op.like]: `%${search}%` } },
          { kode_pendaftaran: { [Op.like]: `%${search}%` } },
        ],
      }
      : baseCondition;

    // ── Query ────────────────────────────────────────────────────────────────
    const { count, rows } = await TrxBeasiswa.findAndCountAll({
      where: whereCondition,
      attributes: [
        "id_trx_beasiswa",
        "nama_lengkap",
        "nik",
        "kode_pendaftaran",
        "jalur",
        "id_verifikator",
        "verifikator_nama",
        "id_flow",
        "flow",
        "status_lulus_administrasi",
        "tinggal_kode_prov",
        "tinggal_prov",
        "tinggal_kode_kab",
        "tinggal_kab_kota",
        "created_at",
        "updated_at",
      ],
      limit,
      offset,
      order: [["id_trx_beasiswa", "ASC"]],
    });

    return successResponse(res, "Data berhasil dimuat", {
      result: rows,
      total: count,
      current_page: page,
      total_pages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.assignVerifikator = async (req, res) => {
  try {
    const { id_verifikator, ids } = req.body;

    // ── Validasi input ───────────────────────────────────────────────────────
    if (!id_verifikator) {
      return failResponse(res, "id_verifikator wajib diisi");
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return failResponse(res, "ids wajib diisi dan tidak boleh kosong");
    }

    // Pastikan semua elemen ids adalah number
    const validIds = ids.filter((id) => Number.isInteger(Number(id))).map(Number);

    if (validIds.length === 0) {
      return failResponse(res, "Tidak ada id yang valid");
    }

    // ── Update ───────────────────────────────────────────────────────────────
    const [updatedCount] = await TrxBeasiswa.update(
      {
        id_verifikator: Number(id_verifikator),
        updated_at: new Date(),
      },
      {
        where: {
          id_trx_beasiswa: { [Op.in]: validIds },
          // Safety: hanya update data yang memang ada di beasiswa ini
          id_ref_beasiswa: 1,
          id_flow: { [Op.ne]: 1 }, // exclude draft
        },
      },
    );

    return successResponse(
      res,
      `Berhasil mengassign ${updatedCount} pendaftar ke verifikator`,
      { updated: updatedCount },
    );
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.assignVerifikatorByJumlah = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { assignments } = req.body;

    // ── Validasi input ───────────────────────────────────────────────────────
    if (!Array.isArray(assignments) || assignments.length === 0) {
      await t.rollback();
      return failResponse(res, "assignments wajib diisi dan tidak boleh kosong");
    }

    for (const item of assignments) {
      if (!item.id_verifikator || !Number.isInteger(Number(item.id_verifikator))) {
        await t.rollback();
        return failResponse(res, `id_verifikator tidak valid: ${item.id_verifikator}`);
      }
      if (!item.jumlah || Number(item.jumlah) <= 0) {
        await t.rollback();
        return failResponse(res, `jumlah harus lebih dari 0 untuk verifikator ${item.id_verifikator}`);
      }
    }

    const totalDiminta = assignments.reduce((acc, item) => acc + Number(item.jumlah), 0);

    const pool = await TrxBeasiswa.findAll({
      where: {
        id_ref_beasiswa: 1,
        id_flow: { [Op.or]: [1] }, // exclude draft
        id_verifikator: { [Op.is]: null },
      },
      attributes: ["id_trx_beasiswa"],
      order: sequelize.literal("RAND()"),
      limit: totalDiminta,
      transaction: t,
    });

    if (pool.length < totalDiminta) {
      await t.rollback();
      return failResponse(
        res,
        `Hanya tersedia ${pool.length} pendaftar belum assign, tetapi total yang diminta ${totalDiminta}`,
      );
    }

    let cursor = 0;
    let totalUpdated = 0;

    for (const item of assignments) {
      const jumlah = Number(item.jumlah);
      const idVerifikator = Number(item.id_verifikator);
      const verifikator_nama = String(item.verifikator_nama);
      const slice = pool.slice(cursor, cursor + jumlah);
      cursor += jumlah;

      if (slice.length === 0) continue;

      const ids = slice.map((p) => p.id_trx_beasiswa);

      const [updatedCount] = await TrxBeasiswa.update(
        {
          id_verifikator: idVerifikator,
          verifikator_nama: verifikator_nama,
          updated_at: new Date(),
        },
        {
          where: {
            id_trx_beasiswa: { [Op.in]: ids },
          },
          transaction: t,
        },
      );

      totalUpdated += updatedCount;
    }

    await t.commit();

    return successResponse(
      res,
      `Berhasil mengassign ${totalUpdated} pendaftar ke ${assignments.length} verifikator`,
      {
        total_assigned: totalUpdated,
        verifikator_assigned: assignments.length,
      },
    );
  } catch (error) {
    await t.rollback();
    console.error(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.updateKlusterBeasiswa = async (req, res) => {
  try {
    const { idTrxBeasiswa } = req.params;
    const { id_kluster } = req.body;

    const idInt = parseInt(idTrxBeasiswa);
    if (isNaN(idInt) || idInt <= 0) {
      return failResponse(res, "id_trx_beasiswa tidak valid.");
    }

    const klusterInt = parseInt(id_kluster);
    if (![1, 2].includes(klusterInt)) {
      return failResponse(res, "id_kluster tidak valid. Gunakan 1 (Reguler) atau 2 (Afirmasi).");
    }

    const namaKluster = klusterInt === 1 ? "Reguler" : "Afirmasi";

    // ✅ Raw query — tidak bergantung pada definisi model
    const [result] = await sequelize.query(
      `UPDATE trx_beasiswa 
       SET id_kluster = :id_kluster, 
           nama_kluster = :nama_kluster, 
           updated_at = NOW() 
       WHERE id_trx_beasiswa = :id`,
      {
        replacements: {
          id_kluster: klusterInt,
          nama_kluster: namaKluster,
          id: idInt,
        },
        type: sequelize.QueryTypes.UPDATE,
      }
    );

    console.log("raw query result:", result);

    // sequelize.QueryTypes.UPDATE mengembalikan [affectedRows]
    if (result === 0) {
      return failResponse(res, "Data tidak ditemukan.");
    }

    return successResponse(res, `Kluster berhasil diubah menjadi ${namaKluster}`, {
      id_kluster: klusterInt,
      nama_kluster: namaKluster,
    });
  } catch (error) {
    console.error("Error updateKlusterBeasiswa:", error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.getPendaftarByProvinsiLembagaSeleksi = async (req, res) => {
  try {
    const { beasiswaId } = req.params;
    const { page = 1, search = "", kodeProvinsi } = req.query;

    const limit = 10;
    const offset = (page - 1) * limit;

    const whereCondition = {
      id_ref_beasiswa: beasiswaId,
      kode_dinas_provinsi: kodeProvinsi,
      id_flow: 10
    };

    if (search) {
      whereCondition[Op.or] = [
        { nama_lengkap: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { nik: { [Op.like]: `%${search}%` } },
        { no_hp: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await TrxBeasiswa.findAndCountAll({
      where: whereCondition,
      attributes: [
        "id_trx_beasiswa",
        "nama_lengkap",
        "nik",
        "email",
        "no_hp",
        "tanggal_lahir",
        "tempat_lahir",
        "jenis_kelamin",
        "tinggal_kode_prov",
        "tinggal_kode_kab",
        "tinggal_kode_kec",
        "tinggal_kode_kel",
        "tinggal_alamat",
        "sekolah",
        "jurusan",
        "tahun_lulus",
        "jalur",
        "kode_dinas_provinsi",
        "nama_dinas_provinsi",
        "kode_dinas_kabkota",
        "nama_dinas_kabkota",
        "status_lulus_administrasi",
        "status_dari_verifikator_dinas",
        "verifikator_catatan",
      ],
      limit,
      offset,
      order: [["id_trx_beasiswa", "DESC"]],
    });

    const result = {
      result: rows,
      total: count,
      total_pages: Math.ceil(count / limit),
      current_page: parseInt(page),
    };

    return successResponse(res, "Data berhasil dimuat", result);
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.getPendaftarPenetapanByProvinsi = async (req, res) => {
  try {
    const { beasiswaId } = req.params;
    const { page = 1, search = "", kodeProvinsi } = req.query;

    const limit = 10;
    const offset = (parseInt(page) - 1) * limit;

    const whereCondition = {
      id_ref_beasiswa: beasiswaId,
      kode_dinas_provinsi: kodeProvinsi,
      id_flow: 11, // Analisa dan Penelaahan — hasil dari lembaga seleksi
    };

    if (search) {
      whereCondition[Op.or] = [
        { nama_lengkap: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { nik: { [Op.like]: `%${search}%` } },
        { no_hp: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await TrxBeasiswa.findAndCountAll({
      where: whereCondition,
      attributes: [
        "id_trx_beasiswa",
        "kode_pendaftaran",
        "nama_lengkap",
        "nik",
        "email",
        "no_hp",
        "tanggal_lahir",
        "tempat_lahir",
        "jenis_kelamin",
        "jalur",
        "kode_dinas_provinsi",
        "nama_dinas_provinsi",
        "kode_dinas_kabkota",
        "nama_dinas_kabkota",
        "status_lulus_administrasi",
        "status_hasil_analisa_rasio", // <- kolom penting untuk penetapan
        "status_dari_verifikator_dinas",
        "verifikator_catatan",
        "id_flow",
        "flow",
      ],
      limit,
      offset,
      order: [["id_trx_beasiswa", "DESC"]],
    });

    return successResponse(res, "Data berhasil dimuat", {
      result: rows,
      total: count,
      total_pages: Math.ceil(count / limit),
      current_page: parseInt(page),
    });
  } catch (error) {
    console.error("Error getPendaftarPenetapanByProvinsi:", error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.getPendaftarPenetapan = async (req, res) => {
  try {
    const { beasiswaId } = req.params;
    const { page = 1, search = "" } = req.query;

    const limit = 10;
    const offset = (parseInt(page) - 1) * limit;

    const whereCondition = {
      id_ref_beasiswa: beasiswaId,
      id_flow: 11,           // Analisa dan Penelaahan — hasil lembaga seleksi
    };

    if (search) {
      whereCondition[Op.or] = [
        { nama_lengkap: { [Op.like]: `%${search}%` } },
        { nik: { [Op.like]: `%${search}%` } },
        { no_hp: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await TrxBeasiswa.findAndCountAll({
      where: whereCondition,
      attributes: [
        "id_trx_beasiswa",
        "kode_pendaftaran",
        "nama_lengkap",
        "nik",
        "email",
        "no_hp",
        "jenis_kelamin",
        "tanggal_lahir",
        "jalur",
        "id_jalur",
        "kode_dinas_provinsi",
        "nama_dinas_provinsi",
        "kode_dinas_kabkota",
        "nama_dinas_kabkota",
        "status_lulus_administrasi",
        "status_hasil_analisa_rasio",   // ← kolom kunci untuk penetapan
        "id_kluster",
        "nama_kluster",
        "id_flow",
        "flow",
      ],
      limit,
      offset,
      order: [
        ["kode_dinas_provinsi", "ASC"],
        ["kode_dinas_kabkota", "ASC"],
        ["nama_lengkap", "ASC"],
      ],
    });

    return successResponse(res, "Data berhasil dimuat", {
      result: rows,
      total: count,
      total_pages: Math.ceil(count / limit),
      current_page: parseInt(page),
    });
  } catch (error) {
    console.error("Error getPendaftarPenetapan:", error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.getDetailPenetapan = async (req, res) => {
  try {
    const { idTrxBeasiswa } = req.params;

    // ── Data utama beasiswa ───────────────────────────────────────────────
    const trxBeasiswa = await TrxBeasiswa.findOne({
      where: {
        id_trx_beasiswa: idTrxBeasiswa,
        id_flow: 11,  // Hanya boleh diakses jika sudah di tahap Analisa & Penelaahan
      },
    });

    if (!trxBeasiswa) {
      return failResponse(res, "Data tidak ditemukan atau belum berada pada tahap penetapan.", 404);
    }

    // ── Foto ─────────────────────────────────────────────────────────────
    const beasiswaData = trxBeasiswa.toJSON();

    if (beasiswaData.foto) beasiswaData.foto = getFileUrl(req, "foto", beasiswaData.foto);
    if (beasiswaData.foto_depan) beasiswaData.foto_depan = getFileUrl(req, "foto_depan", beasiswaData.foto_depan);
    if (beasiswaData.foto_samping_kiri) beasiswaData.foto_samping_kiri = getFileUrl(req, "foto_samping_kiri", beasiswaData.foto_samping_kiri);
    if (beasiswaData.foto_samping_kanan) beasiswaData.foto_samping_kanan = getFileUrl(req, "foto_samping_kanan", beasiswaData.foto_samping_kanan);
    if (beasiswaData.foto_belakang) beasiswaData.foto_belakang = getFileUrl(req, "foto_belakang", beasiswaData.foto_belakang);

    // ── Pilihan prodi ────────────────────────────────────────────────────
    const pilihanProdi = await TrxPilihanProgramStudi.findAll({
      where: { id_trx_beasiswa: idTrxBeasiswa },
      order: [["id", "ASC"]],
    });
    beasiswaData.pilihan_program_studi = pilihanProdi.map((p) => p.toJSON());

    // ── Dokumen persyaratan ───────────────────────────────────────────────
    const [dokUmum, dokKhusus, dokDinas] = await Promise.all([
      TrxDokumenUmum.findAll({ where: { id_trx_beasiswa: idTrxBeasiswa } }),
      TrxDokumenKhusus.findAll({ where: { id_trx_beasiswa: idTrxBeasiswa } }),
      TrxDokumenDinasDaerah.findAll({ where: { id_trx_beasiswa: idTrxBeasiswa } }),
    ]);

    const mapDok = (list) =>
      list.map((item) => ({
        ...item.toJSON(),
        file: item.file ? getFileUrl(req, "persyaratan", item.file) : null,
      }));

    return successResponse(res, "Data berhasil dimuat", {
      data_beasiswa: beasiswaData,
      persyaratan_umum: mapDok(dokUmum),
      persyaratan_khusus: mapDok(dokKhusus),
      persyaratan_dinas: mapDok(dokDinas),
    });
  } catch (error) {
    console.error("Error getDetailPenetapan:", error);
    return errorResponse(res, "Internal Server Error");
  }
};
exports.downloadPendaftarAssignment = async (req, res) => {
  try {
    const { filter = "all", search = "", id_verifikator } = req.query;

    const baseCondition = {
      id_ref_beasiswa: 1,
    };

    if (filter === "filter-assigned" || filter === "assigned") {
      baseCondition.id_verifikator = id_verifikator
        ? Number(id_verifikator)
        : { [Op.ne]: null };
      baseCondition.id_flow = { [Op.ne]: 0 };
    } else if (filter === "filter-unassigned" || filter === "unassigned") {
      baseCondition.id_verifikator = null;
      baseCondition.id_flow = { [Op.or]: [1] };
    }

    const whereCondition = search
      ? {
        ...baseCondition,
        [Op.or]: [
          { nama_lengkap: { [Op.like]: `%${search}%` } },
          { nik: { [Op.like]: `%${search}%` } },
          { kode_pendaftaran: { [Op.like]: `%${search}%` } },
        ],
      }
      : baseCondition;

    const rows = await TrxBeasiswa.findAll({
      where: whereCondition,
      attributes: [
        "id_trx_beasiswa",
        "nama_lengkap",
        "nik",
        "kode_pendaftaran",
        "jalur",
        "id_verifikator",
        "verifikator_nama",
        "id_flow",
        "flow",
        "tinggal_prov",
        "tinggal_kab_kota",
        "created_at",
      ],
      order: [["id_trx_beasiswa", "ASC"]],
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data Pendaftar");

    // Header
    worksheet.getRow(1).values = [
      "No",
      "Kode Pendaftaran",
      "Nama Lengkap",
      "NIK",
      "Jalur",
      "Provinsi",
      "Kabupaten/Kota",
      "Status Flow",
      "Nama Selektor",
      "Tanggal Daftar",
    ];

    worksheet.columns = [
      { key: "no", width: 6 },
      { key: "kode_pendaftaran", width: 20 },
      { key: "nama_lengkap", width: 30 },
      { key: "nik", width: 20 },
      { key: "jalur", width: 20 },
      { key: "prov", width: 25 },
      { key: "kabkota", width: 25 },
      { key: "flow", width: 25 },
      { key: "selektor", width: 25 },
      { key: "tanggal_daftar", width: 20 },
    ];

    rows.forEach((row, index) => {
      worksheet.addRow({
        no: index + 1,
        kode_pendaftaran: row.kode_pendaftaran || "-",
        nama_lengkap: row.nama_lengkap || "-",
        nik: row.nik || "-",
        jalur: row.jalur || "-",
        prov: row.tinggal_prov || "-",
        kabkota: row.tinggal_kab_kota || "-",
        flow: row.flow || "-",
        selektor: row.verifikator_nama || "Belum ada",
        tanggal_daftar: row.created_at
          ? new Date(row.created_at).toLocaleDateString("id-ID")
          : "-",
      });
    });

    // Styling header
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center" };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0F0FF" },
      };
    });

    const label =
      filter === "filter-unassigned" || filter === "unassigned"
        ? "belum_assign"
        : filter === "filter-assigned" || filter === "assigned"
          ? "sudah_assign"
          : "semua";

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=pendaftar_${label}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (error) {
    console.error("Error downloadPendaftarAssignment:", error);
    return errorResponse(res, "Internal Server Error");
  }
};

// ─── Helper: build where condition untuk verifikasi daerah ────────────────────
const buildVerifikasiDaerahWhere = ({ idBeasiswa, kodeProvinsi, kodeKabkota, dinas, search, idFlow, idJalur, statusLulus }) => {
  const baseCondition = {
    id_ref_beasiswa: idBeasiswa,
  };

  if (kodeKabkota) {
    baseCondition.kode_dinas_kabkota = kodeKabkota;
  } else if (kodeProvinsi) {
    baseCondition.kode_dinas_provinsi = kodeProvinsi;
  }

  if (dinas === "kabkota") {
    baseCondition.id_flow = 6;
  } else if (dinas === "provinsi") {
    baseCondition.id_flow = 7;
  }

  // Override id_flow jika filter spesifik dikirim
  if (idFlow) {
    baseCondition.id_flow = Number(idFlow);
  }

  if (idJalur) {
    baseCondition.id_jalur = Number(idJalur);
  }

  // Filter lulus administrasi
  if (statusLulus === "Y" || statusLulus === "N") {
    const ADMIN_LULUS_FLOWS = [6, 7, 9, 10, 11, 12, 13];
    if (statusLulus === "Y") {
      baseCondition.id_flow = { [Op.in]: ADMIN_LULUS_FLOWS };
    } else {
      baseCondition.id_flow = { [Op.notIn]: ADMIN_LULUS_FLOWS };
    }
  }

  if (!search) return baseCondition;

  return {
    ...baseCondition,
    [Op.or]: [
      { nama_lengkap: { [Op.like]: `%${search}%` } },
      { nik: { [Op.like]: `%${search}%` } },
      { kode_pendaftaran: { [Op.like]: `%${search}%` } },
    ],
  };
};

// ─── Helper: generate Excel verifikasi daerah ────────────────────────────────
const generateExcelVerifikasiDaerah = async (res, rows, filename) => {
  const ADMIN_LULUS_FLOWS = [6, 7, 9, 10, 11, 12, 13];

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Data Verifikasi");

  worksheet.getRow(1).values = [
    "No",
    "Kode Pendaftaran",
    "Nama Lengkap",
    "NIK",
    "Jalur",
    "Provinsi Tinggal",
    "Kabupaten/Kota Tinggal",
    "Dinas Kabupaten/Kota",
    "Dinas Provinsi",
    "Status Flow",
    "Lulus Administrasi",
    "Tanggal Daftar",
  ];

  worksheet.columns = [
    { key: "no", width: 6 },
    { key: "kode_pendaftaran", width: 22 },
    { key: "nama_lengkap", width: 30 },
    { key: "nik", width: 20 },
    { key: "jalur", width: 20 },
    { key: "tinggal_prov", width: 25 },
    { key: "tinggal_kab_kota", width: 25 },
    { key: "nama_dinas_kabkota", width: 30 },
    { key: "nama_dinas_provinsi", width: 30 },
    { key: "flow", width: 30 },
    { key: "lulus_administrasi", width: 20 },
    { key: "tanggal_daftar", width: 20 },
  ];

  rows.forEach((row, index) => {
    const isLulus = ADMIN_LULUS_FLOWS.includes(row.id_flow);
    worksheet.addRow({
      no: index + 1,
      kode_pendaftaran: row.kode_pendaftaran || "-",
      nama_lengkap: row.nama_lengkap || "-",
      nik: row.nik || "-",
      jalur: row.jalur || "-",
      tinggal_prov: row.tinggal_prov || "-",
      tinggal_kab_kota: row.tinggal_kab_kota || "-",
      nama_dinas_kabkota: row.nama_dinas_kabkota || "-",
      nama_dinas_provinsi: row.nama_dinas_provinsi || "-",
      flow: row.flow || "-",
      lulus_administrasi: isLulus ? "Lulus" : "Tidak Lulus",
      tanggal_daftar: row.created_at
        ? new Date(row.created_at).toLocaleDateString("id-ID")
        : "-",
    });
  });

  // Styling header
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0F0FF" },
    };
  });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${filename}.xlsx`,
  );

  await workbook.xlsx.write(res);
  res.status(200).end();
};

// ─── Download verifikasi kabkota ──────────────────────────────────────────────
exports.downloadVerifikasiKabkota = async (req, res) => {
  try {
    const {
      idBeasiswa,
      kodeProvinsi,
      kodeKabkota,
      search = "",
      idFlow,
      idJalur,
      statusLulus,
    } = req.query;

    const whereCondition = buildVerifikasiDaerahWhere({
      idBeasiswa,
      kodeProvinsi,
      kodeKabkota,
      dinas: "kabkota",
      search,
      idFlow,
      idJalur,
      statusLulus,
    });

    const rows = await TrxBeasiswa.findAll({
      where: whereCondition,
      attributes: [
        "id_trx_beasiswa",
        "kode_pendaftaran",
        "nama_lengkap",
        "nik",
        "jalur",
        "id_flow",
        "flow",
        "tinggal_prov",
        "tinggal_kab_kota",
        "nama_dinas_kabkota",
        "nama_dinas_provinsi",
        "created_at",
      ],
      order: [["id_trx_beasiswa", "ASC"]],
    });

    await generateExcelVerifikasiDaerah(
      res,
      rows,
      `verifikasi_kabkota_${kodeKabkota || "semua"}`,
    );
  } catch (error) {
    console.error("Error downloadVerifikasiKabkota:", error);
    return errorResponse(res, "Gagal mengunduh file Excel");
  }
};

// ─── Download verifikasi provinsi ─────────────────────────────────────────────
exports.downloadVerifikasiProvinsi = async (req, res) => {
  try {
    const {
      idBeasiswa,
      kodeProvinsi,
      kodeKabkota, // opsional, jika provinsi ingin filter per kabkota
      search = "",
      idFlow,
      idJalur,
      statusLulus,
    } = req.query;

    const whereCondition = buildVerifikasiDaerahWhere({
      idBeasiswa,
      kodeProvinsi,
      kodeKabkota,
      dinas: "provinsi",
      search,
      idFlow,
      idJalur,
      statusLulus,
    });

    const rows = await TrxBeasiswa.findAll({
      where: whereCondition,
      attributes: [
        "id_trx_beasiswa",
        "kode_pendaftaran",
        "nama_lengkap",
        "nik",
        "jalur",
        "id_flow",
        "flow",
        "tinggal_prov",
        "tinggal_kab_kota",
        "nama_dinas_kabkota",
        "nama_dinas_provinsi",
        "created_at",
      ],
      order: [
        ["kode_dinas_kabkota", "ASC"],
        ["id_trx_beasiswa", "ASC"],
      ],
    });

    await generateExcelVerifikasiDaerah(
      res,
      rows,
      `verifikasi_provinsi_${kodeProvinsi || "semua"}`,
    );
  } catch (error) {
    console.error("Error downloadVerifikasiProvinsi:", error);
    return errorResponse(res, "Gagal mengunduh file Excel");
  }
};