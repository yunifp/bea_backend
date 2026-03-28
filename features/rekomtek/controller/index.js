const { Op } = require("sequelize");
const { TrxBeasiswa } = require("../../../models");
const { successResponse, errorResponse } = require("../../../common/response");
const ExcelJS = require("exceljs");

// 1. Get Data Datatable (Flow 12 - Rekomtek)
exports.getPendaftarRekomtek = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const offset = (page - 1) * limit;

    const whereCondition = { id_flow: 12 };

    if (search) {
      whereCondition[Op.or] = [
        { nama_lengkap: { [Op.like]: `%${search}%` } },
        { nik: { [Op.like]: `%${search}%` } },
        { pt_final: { [Op.like]: `%${search}%` } },
        { prodi_final: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await TrxBeasiswa.findAndCountAll({
      where: whereCondition,
      attributes: [
        "id_trx_beasiswa", "nama_lengkap", "nik", "kode_pendaftaran", 
        "jalur", "nama_kluster", "nilai_temp", "pt_final", "prodi_final", "urutan_ranking", "file_rekomendasi_teknis"
      ],
      limit,
      offset,
      order: [["urutan_ranking", "ASC"]],
    });

    return successResponse(res, "Data rekomtek berhasil dimuat", {
      result: rows,
      total: count,
      current_page: page,
      total_pages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.error("Error getPendaftarRekomtek:", error);
    return errorResponse(res, "Internal Server Error");
  }
};

// 2. Download Data Excel (Format Khusus Rekomtek)
exports.downloadDataRekomtek = async (req, res) => {
  try {
    const rows = await TrxBeasiswa.findAll({
      where: { id_flow: 12 },
      order: [["urutan_ranking", "ASC"]],
      raw: true
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data Rekomtek");

    // 👇 Tambahkan kolom KODE PENDAFTARAN di sini
    worksheet.columns = [
      { header: "NO", key: "no", width: 6 },
      { header: "KODE PENDAFTARAN", key: "kode_pendaftaran", width: 25 },
      { header: "NAMA", key: "nama", width: 35 },
      { header: "NIK", key: "nik", width: 20 },
      { header: "NAMA IBU KANDUNG", key: "ibu_nama", width: 30 },
      { header: "TEMPAT LAHIR", key: "tempat_lahir", width: 20 },
      { header: "TANGGAL LAHIR", key: "tanggal_lahir", width: 15 },
      { header: "ASAL SEKOLAH", key: "sekolah", width: 30 },
      { header: "JURUSAN SEKOLAH", key: "jurusan", width: 25 },
      { header: "TANGGAL LULUS SEKOLAH", key: "tahun_lulus", width: 25 },
      { header: "DESA/KELURAHAN", key: "tinggal_kel", width: 25 },
      { header: "KECAMATAN", key: "tinggal_kec", width: 25 },
      { header: "KABUPATEN/KOTA", key: "tinggal_kab_kota", width: 25 },
      { header: "PROVINSI", key: "tinggal_prov", width: 25 },
      { header: "PERGURUAN TINGGI (DITERIMA)", key: "pt_final", width: 45 },
      { header: "PROGRAM STUDI (DITERIMA)", key: "prodi_final", width: 40 },
      { header: "KATEGORI", key: "kluster", width: 15 },
    ];

    rows.forEach((row, index) => {
      // Format tanggal lahir agar rapi
      let tglLahir = row.tanggal_lahir;
      if (tglLahir instanceof Date) {
        tglLahir = tglLahir.toISOString().split('T')[0];
      }

      worksheet.addRow({
        no: index + 1,
        kode_pendaftaran: row.kode_pendaftaran || "-", // 👇 Map data dari database ke Excel
        nama: row.nama_lengkap || "-",
        nik: row.nik || "-",
        ibu_nama: row.ibu_nama || "-",
        tempat_lahir: row.tempat_lahir || "-",
        tanggal_lahir: tglLahir || "-",
        sekolah: row.sekolah || "-",
        jurusan: row.jurusan || "-",
        tahun_lulus: row.tahun_lulus || "-",
        tinggal_kel: row.tinggal_kel || "-",
        tinggal_kec: row.tinggal_kec || "-",
        tinggal_kab_kota: row.tinggal_kab_kota || "-",
        tinggal_prov: row.tinggal_prov || "-",
        pt_final: row.pt_final || "-",
        prodi_final: row.prodi_final || "-",
        kluster: row.nama_kluster || "-",
      });
    });

    // Styling Header: Bold, Text Center, Background Biru Muda
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } }; 
      
      // Tambahkan border di setiap header
      cell.border = {
        top: {style:'thin'},
        left: {style:'thin'},
        bottom: {style:'thin'},
        right: {style:'thin'}
      };
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=Format_Data_Rekomtek.xlsx");

    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (error) {
    console.error("Error downloadDataRekomtek:", error);
    return errorResponse(res, "Gagal mengunduh file Excel");
  }
};

// 3. Upload Dokumen Rekomtek
exports.uploadDokumenRekomtek = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, "File dokumen tidak ditemukan");
    
    // Asumsi file tersimpan dan kita mendapatkan filename-nya
    const filename = req.file.filename;

    // Update nama file ke SEMUA pendaftar yang ada di flow 12
    const [updatedCount] = await TrxBeasiswa.update(
      { file_rekomendasi_teknis: filename },
      { where: { id_flow: 12 } }
    );

    return successResponse(res, `Dokumen berhasil diunggah dan ditautkan ke ${updatedCount} pendaftar.`);
  } catch (error) {
    console.error("Error uploadDokumenRekomtek:", error);
    return errorResponse(res, "Gagal mengunggah dokumen");
  }
};

// 4. Cek Dokumen Terupload
exports.cekDokumenRekomtek = async (req, res) => {
  try {
    // Ambil 1 sampel saja dari flow 12 yang file-nya tidak kosong
    const data = await TrxBeasiswa.findOne({
      where: { id_flow: 12, file_rekomendasi_teknis: { [Op.ne]: null } },
      attributes: ["file_rekomendasi_teknis"]
    });
    
    return successResponse(res, "Status dokumen", { 
      filename: data ? data.file_rekomendasi_teknis : null 
    });
  } catch (error) {
    return errorResponse(res, "Gagal mengecek dokumen");
  }
};

// 5. Kirim Data ke Flow 14
exports.kirimKeFlow14 = async (req, res) => {
  try {
    const [updatedCount] = await TrxBeasiswa.update(
      { id_flow: 14 },
      { where: { id_flow: 12 } }
    );

    if (updatedCount === 0) {
      return errorResponse(res, "Tidak ada data yang bisa dikirim.");
    }

    return successResponse(res, `Berhasil mengirim ${updatedCount} pendaftar ke Tahap 14.`);
  } catch (error) {
    console.error("Error kirimKeFlow14:", error);
    return errorResponse(res, "Internal Server Error");
  }
};