const { Op } = require("sequelize");
const { TrxBeasiswa, sequelize } = require("../../../models");
const { successResponse, errorResponse } = require("../../../common/response");
const excelJS = require("exceljs");

// ==========================================
// 1. Get Data Master Penetapan (Halaman Utama)
// ==========================================
exports.getListPenetapanMaster = async (req, res) => {
  try {
    // Mengelompokkan pendaftar di flow 14 berdasarkan ID dan Nama Beasiswa
    const rows = await TrxBeasiswa.findAll({
      attributes: [
        "id_ref_beasiswa",
        "nama_beasiswa",
        [sequelize.fn("COUNT", sequelize.col("id_trx_beasiswa")), "jumlah_penerima"]
      ],
      where: { id_flow: 14 },
      group: ["id_ref_beasiswa", "nama_beasiswa"]
    });

    // Format data agar sesuai dengan gambar UI mockup Anda
    const formattedData = rows.map((r, index) => ({
      no: index + 1,
      id_ref_beasiswa: r.id_ref_beasiswa || 0,
      nama_penetapan: r.nama_beasiswa || "Penetapan Beasiswa 2025", 
      tanggal_penetapan: new Date().toISOString().split("T")[0], // Mockup Tanggal Hari Ini
      instansi: "Kementerian Pertanian", // Mockup Instansi sesuai gambar
      jumlah_kuota: r.get("jumlah_penerima"),
      keterangan: "Selesai"
    }));

    return successResponse(res, "Data master penetapan dimuat", {
      result: formattedData,
      total: formattedData.length,
      current_page: 1,
      total_pages: 1
    });
  } catch (error) {
    console.error("Error getListPenetapanMaster:", error);
    return errorResponse(res, "Internal Server Error");
  }
};

// ==========================================
// 2. Get Data Detail Penetapan (Halaman Detail)
// ==========================================
exports.getDetailPenetapan = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const id_ref = req.query.id_ref || null;
    const offset = (page - 1) * limit;

    const whereCondition = { id_flow: 14 };
    if (id_ref) whereCondition.id_ref_beasiswa = id_ref;

    if (search) {
      whereCondition[Op.or] = [
        { nama_lengkap: { [Op.like]: `%${search}%` } },
        { kode_pendaftaran: { [Op.like]: `%${search}%` } },
        { pt_final: { [Op.like]: `%${search}%` } },
        { prodi_final: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await TrxBeasiswa.findAndCountAll({
      where: whereCondition,
      attributes: [
        "id_trx_beasiswa", "nama_lengkap", "kode_pendaftaran", 
        "nama_kluster", "pt_final", "prodi_final", "urutan_ranking", "file_rekomendasi_teknis"
      ],
      limit,
      offset,
      order: [["urutan_ranking", "ASC"]],
    });

    return successResponse(res, "Data detail penetapan dimuat", {
      result: rows,
      total: count,
      current_page: page,
      total_pages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.error("Error getDetailPenetapan:", error);
    return errorResponse(res, "Internal Server Error");
  }
};

// ==========================================
// 3. Cek Dokumen (Dari Tahap Rekomtek)
// ==========================================
exports.cekDokumenPenetapan = async (req, res) => {
  try {
    const data = await TrxBeasiswa.findOne({
      where: { id_flow: 14, file_rekomendasi_teknis: { [Op.ne]: null } },
      attributes: ["file_rekomendasi_teknis"]
    });
    
    return successResponse(res, "Status dokumen penetapan", { 
      filename: data ? data.file_rekomendasi_teknis : null 
    });
  } catch (error) {
    return errorResponse(res, "Gagal mengecek dokumen");
  }
};


exports.downloadDataPenetapan = async (req, res) => {
  try {
    const id_ref = req.query.id_ref || null;
    
    const whereCondition = { id_flow: 14 };
    if (id_ref) whereCondition.id_ref_beasiswa = id_ref;

    // Ambil semua data tanpa pagination
    const data = await TrxBeasiswa.findAll({
      where: whereCondition,
      attributes: [
        "kode_pendaftaran",
        "nama_lengkap",
        "nama_kluster",
        "pt_final",
        "prodi_final",
        "urutan_ranking"
      ],
      order: [["urutan_ranking", "ASC"]],
    });

    if (!data || data.length === 0) {
      return res.status(404).send("Data tidak ditemukan");
    }

    const workbook = new excelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data Peserta Diterima");

    // Header Kolom
    worksheet.columns = [
      { header: "No", key: "no", width: 5 },
      { header: "Kode Pendaftaran", key: "kode_pendaftaran", width: 20 },
      { header: "Nama Lengkap", key: "nama_lengkap", width: 35 },
      { header: "Kluster", key: "nama_kluster", width: 20 },
      { header: "Kampus Diterima", key: "pt_final", width: 35 },
      { header: "Program Studi Diterima", key: "prodi_final", width: 35 },
    ];

    // Isi Data
    data.forEach((item, index) => {
      worksheet.addRow({
        no: index + 1,
        kode_pendaftaran: item.kode_pendaftaran,
        nama_lengkap: item.nama_lengkap,
        nama_kluster: item.nama_kluster,
        pt_final: item.pt_final,
        prodi_final: item.prodi_final,
      });
    });

    // Style Header
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Data_Penetapan_${id_ref || 'All'}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.status(200).end();

  } catch (error) {
    console.error("Error downloadDataPenetapan:", error);
    return res.status(500).send("Internal Server Error");
  }
};