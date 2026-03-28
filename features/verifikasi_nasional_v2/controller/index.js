const { Op, fn, col } = require("sequelize");
const { TrxBeasiswa } = require("../../../models");
const { successResponse, errorResponse } = require("../../../common/response");

// exports.getRekapProvinsi = async (req, res) => {
//   try {
//     // Rekap per provinsi
//     const rekap = await TrxBeasiswa.findAll({
//       where: { 
//         id_flow: 9,
//         kode_dinas_provinsi: { [Op.ne]: null }
//       },
//       attributes: [
//         "kode_dinas_provinsi",
//         "nama_dinas_provinsi",
//         [fn("COUNT", col("id_trx_beasiswa")), "jumlah_pendaftar"]
//       ],
//       group: ["kode_dinas_provinsi", "nama_dinas_provinsi"],
//       order: [["nama_dinas_provinsi", "ASC"]],
//       raw: true
//     });

//     // Menghitung total kluster Afirmasi dan Reguler untuk halaman awal
//     const totalAfirmasi = await TrxBeasiswa.count({
//       where: { id_flow: 9, nama_kluster: "Afirmasi" }
//     });
    
//     const totalReguler = await TrxBeasiswa.count({
//       where: { id_flow: 9, nama_kluster: "Reguler" }
//     });

//     return successResponse(res, "Berhasil memuat rekapitulasi provinsi", {
//       rekap,
//       total_afirmasi: totalAfirmasi,
//       total_reguler: totalReguler
//     });
//   } catch (error) {
//     console.error("Error getRekapProvinsi:", error);
//     return errorResponse(res, "Internal Server Error");
//   }
// };
exports.getRekapProvinsi = async (req, res) => {
  try {
    const { kode_kabkota } = req.query; // Menerima query parameter filter

    // Kondisi dasar (Flow 9 & Provinsi tidak null)
    const whereCondition = { 
      id_flow: 9,
      kode_dinas_provinsi: { [Op.ne]: null }
    };

    // Jika filter kabupaten dipilih, tambahkan ke query where
    if (kode_kabkota && kode_kabkota !== "all") {
      whereCondition.kode_dinas_kabkota = kode_kabkota;
    }

    // 1. Rekap per provinsi berdasarkan filter
    const rekap = await TrxBeasiswa.findAll({
      where: whereCondition,
      attributes: [
        "kode_dinas_provinsi",
        "nama_dinas_provinsi",
        [fn("COUNT", col("id_trx_beasiswa")), "jumlah_pendaftar"]
      ],
      group: ["kode_dinas_provinsi", "nama_dinas_provinsi"],
      order: [["nama_dinas_provinsi", "ASC"]],
      raw: true
    });

    // 2. Menghitung total kluster Afirmasi dan Reguler berdasarkan filter
    const totalAfirmasi = await TrxBeasiswa.count({
      where: { ...whereCondition, nama_kluster: "Afirmasi" }
    });
    
    const totalReguler = await TrxBeasiswa.count({
      where: { ...whereCondition, nama_kluster: "Reguler" }
    });

    // 3. Ambil daftar semua kabupaten yang tersedia di flow 9 untuk dropdown filter (dipanggil tanpa filter whereCondition kabkota)
    const listKabkota = await TrxBeasiswa.findAll({
      where: { id_flow: 9, kode_dinas_kabkota: { [Op.ne]: null } },
      attributes: ["kode_dinas_kabkota", "nama_dinas_kabkota"],
      group: ["kode_dinas_kabkota", "nama_dinas_kabkota"],
      order: [["nama_dinas_kabkota", "ASC"]],
      raw: true
    });

    return successResponse(res, "Berhasil memuat rekapitulasi provinsi", {
      rekap,
      total_afirmasi: totalAfirmasi,
      total_reguler: totalReguler,
      list_kabkota: listKabkota // Kirim ke frontend untuk Dropdown
    });
  } catch (error) {
    console.error("Error getRekapProvinsi:", error);
    return errorResponse(res, "Internal Server Error");
  }
};
exports.getDetailProvinsi = async (req, res) => {
  try {
    const { kode_dinas_provinsi } = req.params;
    const { page = 1, limit = 10, search = "" } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const whereCondition = {
      id_flow: 9,
      kode_dinas_provinsi: kode_dinas_provinsi
    };

    if (search) {
      whereCondition[Op.or] = [
        { nama_lengkap: { [Op.like]: `%${search}%` } },
        { nik: { [Op.like]: `%${search}%` } },
        { kode_pendaftaran: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await TrxBeasiswa.findAndCountAll({
      where: whereCondition,
      attributes: [
        "id_trx_beasiswa",
        "nama_lengkap",
        "nik",
        "kode_pendaftaran",
        "jalur",
        "tag_daerah_3T",
        "tag_sktm",
        "id_kluster",
        "nama_kluster",
        "nama_dinas_provinsi"
      ],
      limit: parseInt(limit),
      offset: offset,
      order: [["nama_lengkap", "ASC"]],
      raw: true
    });

    const nama_provinsi = rows.length > 0 ? rows[0].nama_dinas_provinsi : "";

    const mappedRows = rows.map((item) => ({
      ...item,
      is_sktm: (item.tag_sktm === "1" || item.tag_sktm === "Y"), 
      is_3t: (item.tag_daerah_3T === "1"),
    }));

    return successResponse(res, "Berhasil memuat detail pendaftar", {
      nama_provinsi: nama_provinsi,
      total_pendaftar: count,
      result: mappedRows,
      current_page: parseInt(page),
      total_pages: Math.ceil(count / parseInt(limit))
    });
  } catch (error) {
    console.error("Error getDetailProvinsi:", error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.ubahStatusKluster = async (req, res) => {
  try {
    const { id_trx_beasiswa } = req.params;
    const { nama_kluster } = req.body; // Menerima payload pilihan kluster dari Frontend

    const beasiswa = await TrxBeasiswa.findByPk(id_trx_beasiswa);

    if (!beasiswa) {
      return errorResponse(res, "Data tidak ditemukan", 404);
    }

    if (!nama_kluster) {
      return errorResponse(res, "Nama kluster wajib dikirim", 400);
    }

    // Asumsi master kluster Anda: 1 = Afirmasi, 2 = Reguler
    const id_kluster = nama_kluster === "Afirmasi" ? 1 : 2; 

    beasiswa.nama_kluster = nama_kluster;
    beasiswa.id_kluster = id_kluster;
    await beasiswa.save();

    return successResponse(res, `Berhasil mengubah kluster menjadi ${nama_kluster}`, {
      id_trx_beasiswa,
      nama_kluster
    });
  } catch (error) {
    console.error("Error ubahStatusKluster:", error);
    return errorResponse(res, "Internal Server Error");
  }
};

// Aksi 5: Kirim ke Lembaga Seleksi (Update Flow 7 -> 10)
exports.kirimLembagaSeleksi = async (req, res) => {
  try {
    const [updated] = await TrxBeasiswa.update(
      { id_flow: 10 },
      { where: { id_flow: 9 } }
    );
    return successResponse(res, `Berhasil mengirim ${updated} pendaftar ke Lembaga Seleksi.`);
  } catch (error) {
    console.error("Error kirimLembagaSeleksi:", error);
    return errorResponse(res, "Internal Server Error");
  }
};

// Aksi 5: Export Data Detail
exports.exportDetailSemua = async (req, res) => {
  try {
    // Ambil semua data detail untuk id_flow = 7
    const rows = await TrxBeasiswa.findAll({
      where: { id_flow: 9 },
      attributes: ["nama_lengkap", "nik", "kode_pendaftaran", "jalur", "nama_dinas_provinsi", "nama_kluster"],
      order: [["nama_dinas_provinsi", "ASC"], ["nama_lengkap", "ASC"]],
      raw: true
    });
    return successResponse(res, "Berhasil mengambil data export", rows);
  } catch (error) {
    console.error("Error exportDetailSemua:", error);
    return errorResponse(res, "Internal Server Error");
  }
};

exports.kirimDataKewilayahan = async (req, res) => {
  try {
    const [updatedCount] = await TrxBeasiswa.update(
      { id_flow: 6 },
      { where: { id_flow: 13 } }
    );

    return successResponse(res, `Berhasil mengirim ${updatedCount} data ke tahap seleksi (Flow 6)`);
  } catch (error) {
    console.log(error);
    return errorResponse(res, "Internal Server Error saat mengirim data");
  }
};