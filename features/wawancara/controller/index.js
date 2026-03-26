const { Op } = require("sequelize");
const { TrxBeasiswa, sequelize } = require("../../../models"); 
const { successResponse, errorResponse } = require("../../../common/response");
const ExcelJS = require("exceljs");

exports.getPendaftarWawancara = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const offset = (page - 1) * limit;

    const whereCondition = { id_flow: 10 };

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

    return successResponse(res, "Data wawancara berhasil dimuat", {
      result: rows,
      total: count,
      current_page: page,
      total_pages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.error("Error getPendaftarWawancara:", error);
    return errorResponse(res, "Internal Server Error");
  }
};


exports.downloadExcelWawancara = async (req, res) => {
  try {
    const rows = await TrxBeasiswa.findAll({
      where: { id_flow: 10 },
      attributes: [
        "id_trx_beasiswa", "nama_lengkap", "nik", "kode_pendaftaran", "jalur", "nama_kluster", "nilai_temp"
      ],
      order: [["nama_lengkap", "ASC"]],
      raw: true
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data Wawancara");

    worksheet.mergeCells("A1:H1");
    const noteCell1 = worksheet.getCell("A1");
    noteCell1.value = 'Isi/update angka pada kolom "Nilai" di sebelah kanan.';
    noteCell1.font = { color: { argb: "FF000000" } };
    noteCell1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFE0" } };

    worksheet.mergeCells("A2:H2");
    const noteCell2 = worksheet.getCell("A2");
    noteCell2.value = "Jangan ubah urutan baris atau data bawaan sistem!";
    noteCell2.font = { color: { argb: "FFFF0000" } };
    noteCell2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFE0" } };

    worksheet.getRow(4).values = [
      "No", "Nama Lengkap", "NIK", "Kode Pendaftaran", "Jalur", "Status Kluster", "Nilai", "ID_SISTEM"
    ];

    worksheet.columns = [
      { key: "no", width: 5 },
      { key: "nama", width: 30 },
      { key: "nik", width: 25 },
      { key: "kode", width: 25 },
      { key: "jalur", width: 20 },
      { key: "kluster", width: 20 },
      { key: "nilai", width: 15 },
      { key: "id_trx", width: 15, hidden: true },
    ];

    rows.forEach((row, index) => {
      worksheet.addRow({
        no: index + 1,
        nama: row.nama_lengkap || "-",
        nik: row.nik || "-",
        kode: row.kode_pendaftaran || "-",
        jalur: row.jalur || "-",
        kluster: row.nama_kluster || "-",
        nilai: row.nilai_temp || "", 
        id_trx: row.id_trx_beasiswa 
      });
    });

    worksheet.getRow(4).eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F0FF" } };
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=template_wawancara.xlsx");

    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (error) {
    console.error("Error downloadExcelWawancara:", error);
    return errorResponse(res, "Gagal mengunduh file Excel");
  }
};


exports.uploadExcelWawancara = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, "File Excel tidak ditemukan");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.getWorksheet("Data Wawancara");

    if (!worksheet) return errorResponse(res, "Sheet 'Data Wawancara' tidak ditemukan");

    let successCount = 0;
    let failedCount = 0;

    for (let i = 5; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      
      let rawNilai = row.getCell(7).value; 
      let rawIdTrx = row.getCell(8).value; 

      if (rawNilai !== null && typeof rawNilai === 'object' && rawNilai.result !== undefined) rawNilai = rawNilai.result;
      if (rawIdTrx !== null && typeof rawIdTrx === 'object' && rawIdTrx.result !== undefined) rawIdTrx = rawIdTrx.result;

      const nilaiVal = rawNilai !== null && rawNilai !== undefined ? rawNilai.toString().trim() : null;
      const idTrx = rawIdTrx !== null && rawIdTrx !== undefined ? rawIdTrx.toString().trim() : null;

      if (!idTrx) continue;

      try {
        const newNilai = nilaiVal === "" ? null : nilaiVal;
        
        await sequelize.query(
          `UPDATE trx_beasiswa SET nilai_temp = :nilai WHERE id_trx_beasiswa = :id AND id_flow = 10`,
          {
            replacements: { nilai: newNilai, id: idTrx },
            type: sequelize.QueryTypes.UPDATE
          }
        );
        
        console.log(`[RAW UPDATE SUCCESS] ID_TRX: ${idTrx} | Nilai Baru: ${newNilai}`);
        successCount++;

      } catch (error) {
        console.error(`Gagal update baris ID ${idTrx}:`, error);
        failedCount++;
      }
    }

    return successResponse(res, `Upload selesai. ${successCount} data berhasil diperbarui.`);
  } catch (error) {
    console.error("Error uploadExcelWawancara:", error);
    return errorResponse(res, "Gagal memproses file Excel");
  }
};

exports.kirimDataWawancara = async (req, res) => {
  try {
    const [updatedCount] = await TrxBeasiswa.update(
      { id_flow: 11 },
      { where: { id_flow: 10 } }
    );
    
    return successResponse(res, `Berhasil mengirim ${updatedCount} pendaftar ke tahap selanjutnya.`);
  } catch (error) {
    console.error("Error kirimDataWawancara:", error);
    return errorResponse(res, "Internal Server Error");
  }
};