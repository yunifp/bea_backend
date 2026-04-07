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
        "jalur", "nama_kluster", "nilai_temp", "status_wawancara" 
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
        "id_trx_beasiswa", "nama_lengkap", "nik", "kode_pendaftaran", "jalur", "nama_kluster", "nilai_temp", "status_wawancara"
      ],
      order: [["nama_lengkap", "ASC"]],
      raw: true
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data Wawancara");

    // Catatan Disederhanakan
    worksheet.mergeCells("A1:H1");
    const noteCell1 = worksheet.getCell("A1");
    noteCell1.value = 'Hanya tampilkan rekapitulasi wawancara. Kolom Nilai otomatis dari sistem.';
    noteCell1.font = { color: { argb: "FF000000" }, italic: true };
    noteCell1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFE0" } };

    worksheet.getRow(3).values = [
      "No", "Nama Lengkap", "NIK", "Kode Pendaftaran", "Jalur", "Status Kluster", "Status Wawancara", "Nilai"
    ];

    worksheet.columns = [
      { key: "no", width: 5 },
      { key: "nama", width: 30 },
      { key: "nik", width: 25 },
      { key: "kode", width: 25 },
      { key: "jalur", width: 20 },
      { key: "kluster", width: 20 },
      { key: "status_wawancara", width: 20 },
      { key: "nilai", width: 20 },
    ];

    rows.forEach((row, index) => {
      worksheet.addRow({
        no: index + 1,
        nama: row.nama_lengkap || "-",
        nik: row.nik || "-",
        kode: row.kode_pendaftaran || "-",
        jalur: row.jalur || "-",
        kluster: row.nama_kluster || "-",
        status_wawancara: row.status_wawancara || "-", 
        nilai: row.nilai_temp || "Belum dinilai", 
      });
    });

    worksheet.getRow(3).eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F0FF" } };
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=rekap_wawancara.xlsx");

    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (error) {
    console.error("Error downloadExcelWawancara:", error);
    return errorResponse(res, "Gagal mengunduh file Excel");
  }
};

exports.updateNilaiWawancaraSingle = async (req, res) => {
  try {
    const { idTrxBeasiswa } = req.params;
    const { status_wawancara } = req.body; 

    // Validasi nilai status_wawancara
    if (status_wawancara && !["Rekomendasi", "Tidak Rekomendasi"].includes(status_wawancara)) {
        return errorResponse(res, "Nilai hasil seleksi tidak valid.", 400);
    }

    const updateData = {};
    if (status_wawancara !== undefined) updateData.status_wawancara = status_wawancara;

    if (Object.keys(updateData).length > 0) {
        await TrxBeasiswa.update(updateData, { 
        where: { 
            id_trx_beasiswa: idTrxBeasiswa, 
            id_flow: 10 
        } 
        });
    }

    return successResponse(res, "Data wawancara berhasil diperbarui.");
  } catch (error) {
    console.error("Error updateNilaiWawancaraSingle:", error);
    return errorResponse(res, "Internal Server Error");
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