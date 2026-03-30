const { Op } = require("sequelize");
// PASTIKAN IMPORT sequelize UNTUK RAW QUERY
const { TrxBeasiswa, sequelize } = require("../../../models"); 
const { successResponse, errorResponse } = require("../../../common/response");
const ExcelJS = require("exceljs");

// ==========================================
// 1. Get Data Datatable (Flow 11)
// ==========================================
exports.getPendaftarPenelaahan = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const offset = (page - 1) * limit;

    const whereCondition = { id_flow: 11 };

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
        "id_trx_beasiswa", "nama_lengkap", "nik", "kode_pendaftaran", 
        "jalur", "nama_kluster", "nilai_temp"
      ],
      limit,
      offset,
      order: [["nama_lengkap", "ASC"]],
    });

    return successResponse(res, "Data penelaahan berhasil dimuat", {
      result: rows,
      total: count,
      current_page: page,
      total_pages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.error("Error getPendaftarPenelaahan:", error);
    return errorResponse(res, "Internal Server Error");
  }
};

// ==========================================
// 2. Download Excel Template 
// ==========================================
exports.downloadExcelPenelaahan = async (req, res) => {
  try {
    const rows = await TrxBeasiswa.findAll({
      where: { id_flow: 11 },
      attributes: ["id_trx_beasiswa", "nama_lengkap", "nama_kluster", "nilai_temp"],
      order: [["nama_lengkap", "ASC"]],
      raw: true
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data Penelaahan");

    worksheet.columns = [
      { header: "id_trx", key: "id_trx", width: 15 },
      { header: "nama", key: "nama", width: 35 },
      { header: "nilai_akhir", key: "nilai_akhir", width: 15 },
      { header: "kluster", key: "kluster", width: 20 },
    ];

    rows.forEach((row) => {
      worksheet.addRow({
        id_trx: row.id_trx_beasiswa,
        nama: row.nama_lengkap || "-",
        nilai_akhir: row.nilai_temp || 0, 
        kluster: row.nama_kluster || "-",
      });
    });

    for (let i = 1; i <= 4; i++) {
      const cell = worksheet.getRow(1).getCell(i);
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F0FF" } };
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=data_penelaahan_perankingan.xlsx");

    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (error) {
    console.error("Error downloadExcelPenelaahan:", error);
    return errorResponse(res, "Gagal mengunduh file Excel");
  }
};

exports.uploadHasilPerankingan = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, "File Excel tidak ditemukan");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) return errorResponse(res, "Sheet tidak ditemukan");

    let successCount = 0;
    let failedCount = 0;

    const extractVal = (cell) => {
      if (!cell || cell.value == null) return null;
      let val = cell.value;
      if (typeof val === 'object') {
        if (val.result !== undefined) return val.result;
        if (val.richText) return val.richText.map(r => r.text).join("");
        if (val.text) return val.text;
      }
      return val.toString().trim();
    };

    let idCol = 2, ptCol = 6, prodiCol = 7;
    worksheet.getRow(1).eachCell((cell, colNumber) => {
      const txt = extractVal(cell)?.toLowerCase() || "";
      if (txt.includes("id")) idCol = colNumber;
      if (txt.includes("pt")) ptCol = colNumber;
      if (txt.includes("prodi")) prodiCol = colNumber;
    });

    // Looping mulai dari baris ke-2
    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      const idTrx = extractVal(row.getCell(idCol));
      const ptFinal = extractVal(row.getCell(ptCol));
      const prodiFinal = extractVal(row.getCell(prodiCol));
      
      // Ambil urutan baris murni dari file Excel
      const urutan_excel = i - 1; 

      if (!idTrx) continue;

      try {
        // Simpan pt_final, prodi_final, dan URUTANNYA ke database
        await sequelize.query(
          `UPDATE trx_beasiswa SET pt_final = :pt, prodi_final = :prodi, urutan_ranking = :urutan WHERE id_trx_beasiswa = :id AND id_flow = 11`,
          {
            replacements: { 
              pt: ptFinal || null, 
              prodi: prodiFinal || null, 
              urutan: urutan_excel, 
              id: idTrx 
            },
            type: sequelize.QueryTypes.UPDATE
          }
        );
        successCount++;
      } catch (error) {
        failedCount++;
      }
    }

    return successResponse(res, `Upload selesai. ${successCount} data berhasil diperbarui sesuai urutan Excel.`);
  } catch (error) {
    console.error("Error uploadHasilPerankingan:", error);
    return errorResponse(res, "Gagal memproses file Excel");
  }
};

// ==========================================
// 4. Get Data Hasil Perankingan
// ==========================================
exports.getHasilPerankingan = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const offset = (page - 1) * limit;

    // Filter MURNI hanya yang pt_final-nya ada (Sudah di-upload)
    const whereCondition = {
      id_flow: 11,
      pt_final: {
        [Op.and]: [
          { [Op.not]: null },
          { [Op.ne]: "" },
          { [Op.ne]: "null" }
        ]
      }
    };

    if (search) {
      whereCondition[Op.or] = [
        { nama_lengkap: { [Op.like]: `%${search}%` } },
        { pt_final: { [Op.like]: `%${search}%` } },
        { prodi_final: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await TrxBeasiswa.findAndCountAll({
      where: whereCondition,
      attributes: ["id_trx_beasiswa", "nama_lengkap", "nama_kluster", "nilai_temp", "pt_final", "prodi_final", "urutan_ranking"],
      limit,
      offset,
      // URUTKAN MURNI BERDASARKAN URUTAN BARIS DI EXCEL YANG DIUPLOAD! Tidak meranking sendiri lagi.
      order: [["urutan_ranking", "ASC"]],
    });

    return successResponse(res, "Data hasil perankingan dimuat", {
      result: rows,
      total: count,
      current_page: page,
      total_pages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.error("Error getHasil:", error);
    return errorResponse(res, "Internal Server Error");
  }
};


exports.kirimDataPenelaahan = async (req, res) => {
  try {
    // Pindahkan pendaftar dari flow 11 ke 12 
    // (Hanya yang sudah punya pt_final / berhasil di-upload dari excel perankingan)
    const [updatedCount] = await TrxBeasiswa.update(
      { id_flow: 12 },
      { 
        where: { 
          id_flow: 11,
          pt_final: { [Op.ne]: null } // Syarat utama: PT Final tidak kosong
        } 
      }
    );

    if (updatedCount === 0) {
      return successResponse(res, "Tidak ada data hasil perankingan yang bisa dikirim.");
    }

    return successResponse(res, `Berhasil mengirim ${updatedCount} pendaftar ke tahap selanjutnya (Flow 12).`);
  } catch (error) {
    console.error("Error kirimDataPenelaahan:", error);
    return errorResponse(res, "Internal Server Error");
  }
};


exports.resetHasilPerankingan = async (req, res) => {
  try {
    const [updatedCount] = await TrxBeasiswa.update(
      { pt_final: null, prodi_final: null, urutan_ranking: null },
      { where: { id_flow: 11 } }
    );

    return successResponse(res, "Berhasil mereset data hasil perankingan. Silakan unggah ulang file Excel.");
  } catch (error) {
    console.error("Error resetHasilPerankingan:", error);
    return errorResponse(res, "Gagal mereset data perankingan.");
  }
};