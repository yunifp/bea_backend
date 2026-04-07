const { Op } = require("sequelize");
const { TrxBeasiswa } = require("../../../models"); // DB Beasiswa
const RefProgramStudi = require("../../../models/RefProgramStudi"); // DB Master (Koneksi Berbeda)
const RefPerguruanTinggi = require("../../../models/RefPerguruanTinggi");
const { successResponse, errorResponse } = require("../../../common/response");
const ExcelJS = require("exceljs");

// 1. Get Data Datatable Pendaftar Rekomtek (Flow 12) + Ambil Kuota dari DB Master
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
        "jalur", "nama_kluster", "nilai_temp", "pt_final", "prodi_final", 
        "urutan_ranking", "file_rekomendasi_teknis",
        "status_undur_diri", 
        "jenjang_sekolah" // <--- DITAMBAHKAN DISINI
      ],
      limit,
      offset,
      order: [["urutan_ranking", "ASC"]],
    });

    // --- LOGIKA AMBIL KUOTA LINTAS DB ---
    const resultsWithKuota = await Promise.all(rows.map(async (row) => {
      const plainRow = row.get({ plain: true });
      
      const prodiMaster = await RefProgramStudi.findOne({
        where: { nama_prodi: plainRow.prodi_final },
        attributes: ['kuota']
      });

      return {
        ...plainRow,
        sisa_kuota: prodiMaster ? prodiMaster.kuota : 0
      };
    }));

    return successResponse(res, "Data rekomtek berhasil dimuat", {
      result: resultsWithKuota,
      total: count,
      current_page: page,
      total_pages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.error("Error getPendaftarRekomtek:", error);
    return errorResponse(res, "Internal Server Error");
  }
};
// 2. Proses Mengundurkan Diri (KUOTA BERTAMBAH / SLOT KOSONG JADI ADA LAGI)
exports.prosesMengundurkanDiri = async (req, res) => {
  try {
    const { id } = req.params; 

    const pendaftar = await TrxBeasiswa.findByPk(id);
    if (!pendaftar) return errorResponse(res, "Data pendaftar tidak ditemukan", 404);
    if (pendaftar.status_undur_diri === "Y") return errorResponse(res, "Siswa ini sudah berstatus mengundurkan diri", 400);

    const namaPT = pendaftar.pt_final ? pendaftar.pt_final.trim() : "";
    const namaProdi = pendaftar.prodi_final ? pendaftar.prodi_final.trim() : "";

    // Cari PT & Prodi di Master
    const ptMaster = await RefPerguruanTinggi.findOne({ where: { nama_pt: { [Op.like]: `%${namaPT}%` } } });
    if (!ptMaster) return errorResponse(res, `Kampus "${namaPT}" tidak ditemukan di master.`, 404);

    const prodi = await RefProgramStudi.findOne({
      where: { id_pt: ptMaster.id_pt, nama_prodi: { [Op.like]: `%${namaProdi}%` } }
    });

    if (!prodi) return errorResponse(res, `Prodi "${namaProdi}" tidak ditemukan di master.`, 404);

    // A. Update status di DB Beasiswa
    await pendaftar.update({ status_undur_diri: "Y" });

    // B. Update Kuota di Master (+1 karena slot jadi kosong kembali)
    await RefProgramStudi.update(
      { kuota: prodi.kuota + 1 }, 
      { where: { id_prodi: prodi.id_prodi } }
    );

    return successResponse(res, `Siswa berhasil mundur. Jatah slot kuota prodi telah dikembalikan (Bertambah).`);
  } catch (error) {
    console.error("Error prosesMengundurkanDiri:", error);
    return errorResponse(res, "Internal Server Error");
  }
};

// 3. Batal Mengundurkan Diri (KUOTA BERKURANG / SLOT TERISI LAGI)
exports.batalMengundurkanDiri = async (req, res) => {
  try {
    const { id } = req.params; 

    const pendaftar = await TrxBeasiswa.findByPk(id);
    if (!pendaftar) return errorResponse(res, "Data pendaftar tidak ditemukan", 404);
    if (pendaftar.status_undur_diri !== "Y") return errorResponse(res, "Siswa ini memang tidak dalam status mundur.", 400);
    
    const namaPT = pendaftar.pt_final ? pendaftar.pt_final.trim() : "";
    const namaProdi = pendaftar.prodi_final ? pendaftar.prodi_final.trim() : "";

    // Cari PT & Prodi di Master
    const ptMaster = await RefPerguruanTinggi.findOne({ where: { nama_pt: { [Op.like]: `%${namaPT}%` } } });
    if (!ptMaster) return errorResponse(res, `Kampus tidak ditemukan di master.`, 404);

    const prodi = await RefProgramStudi.findOne({
      where: { id_pt: ptMaster.id_pt, nama_prodi: { [Op.like]: `%${namaProdi}%` } }
    });

    if (!prodi) return errorResponse(res, `Prodi tidak ditemukan di master.`, 404);

    // Cek apakah slot masih tersedia sebelum dikurangi
    if (prodi.kuota <= 0) {
      return errorResponse(res, `Gagal batal! Slot kuota prodi ini sudah penuh/habis (0).`, 400);
    }

    // A. Update status di DB Beasiswa
    await pendaftar.update({ status_undur_diri: "N" });

    // B. Update Kuota di Master (-1 karena slot diisi lagi oleh siswa ini)
    await RefProgramStudi.update(
      { kuota: prodi.kuota - 1 },
      { where: { id_prodi: prodi.id_prodi } }
    );

    return successResponse(res, `Berhasil membatalkan undur diri. Slot kuota telah terisi kembali (Berkurang).`);
  } catch (error) {
    console.error("Error batalMengundurkanDiri:", error);
    return errorResponse(res, "Internal Server Error");
  }
};
// 4. Download Data Excel (Format Khusus Rekomtek)
exports.downloadDataRekomtek = async (req, res) => {
  try {
    const rows = await TrxBeasiswa.findAll({
      where: { id_flow: 12 },
      order: [["urutan_ranking", "ASC"]],
      raw: true
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data Rekomtek");

    worksheet.columns = [
      { header: "NO", key: "no", width: 6 },
      { header: "KODE PENDAFTARAN", key: "kode_pendaftaran", width: 25 },
      { header: "NAMA", key: "nama", width: 35 },
      { header: "NIK", key: "nik", width: 20 },
      { header: "NAMA IBU KANDUNG", key: "ibu_nama", width: 30 },
      { header: "TEMPAT LAHIR", key: "tempat_lahir", width: 20 },
      { header: "TANGGAL LAHIR", key: "tanggal_lahir", width: 15 },
      { header: "JENJANG PENDIDIKAN", key: "jenjang_sekolah", width: 25 }, // <--- DITAMBAHKAN DISINI
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
      let tglLahir = row.tanggal_lahir;
      if (tglLahir instanceof Date) {
        tglLahir = tglLahir.toISOString().split('T')[0];
      }

      worksheet.addRow({
        no: index + 1,
        kode_pendaftaran: row.kode_pendaftaran || "-",
        nama: row.nama_lengkap || "-",
        nik: row.nik || "-",
        ibu_nama: row.ibu_nama || "-",
        tempat_lahir: row.tempat_lahir || "-",
        tanggal_lahir: tglLahir || "-",
        jenjang_sekolah: row.jenjang_sekolah || "-", // <--- DITAMBAHKAN DISINI
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

    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } }; 
      
      cell.border = {
        top: {style:'thin'}, left: {style:'thin'},
        bottom: {style:'thin'}, right: {style:'thin'}
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

// 5. Upload Dokumen Rekomtek
exports.uploadDokumenRekomtek = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, "File dokumen tidak ditemukan");
    
    const filename = req.file.filename;

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

// 6. Cek Dokumen Terupload
exports.cekDokumenRekomtek = async (req, res) => {
  try {
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

// 7. Kirim Data ke Flow 14 (Hanya yang TIDAK Mengundurkan Diri)
exports.kirimKeFlow14 = async (req, res) => {
  try {
    const [updatedCount] = await TrxBeasiswa.update(
      { id_flow: 14 },
      { 
        where: { 
          id_flow: 12,
          status_undur_diri: {
            [Op.or]: ["N", null] 
          }
        } 
      }
    );

    if (updatedCount === 0) {
      return errorResponse(res, "Tidak ada data yang bisa dikirim (Mungkin data kosong atau semua siswa mengundurkan diri).");
    }

    return successResponse(res, `Berhasil mengirim ${updatedCount} pendaftar ke Tahap Penetapan.`);
  } catch (error) {
    console.error("Error kirimKeFlow14:", error);
    return errorResponse(res, "Internal Server Error");
  }
};


exports.getSummaryKuotaRekomtek = async (req, res) => {
  try {
    // 1. Ambil semua PT & Prodi unik yang ada di pendaftar Flow 12
    const pendaftar = await TrxBeasiswa.findAll({
      where: { id_flow: 12 },
      attributes: ['pt_final', 'prodi_final'],
      group: ['pt_final', 'prodi_final']
    });

    // 2. Ambil detail kuota dari DB Master untuk tiap PT & Prodi tersebut
    const summary = await Promise.all(pendaftar.map(async (p) => {
      const ptMaster = await RefPerguruanTinggi.findOne({
        where: { nama_pt: { [Op.like]: `%${p.pt_final}%` } }
      });

      let kuota = 0;
      if (ptMaster) {
        const prodiMaster = await RefProgramStudi.findOne({
          where: { 
            id_pt: ptMaster.id_pt, 
            nama_prodi: { [Op.like]: `%${p.prodi_final}%` } 
          }
        });
        kuota = prodiMaster ? prodiMaster.kuota : 0;
      }

      return {
        perguruan_tinggi: p.pt_final,
        program_studi: p.prodi_final,
        sisa_kuota: kuota
      };
    }));

    return successResponse(res, "Summary kuota berhasil dimuat", summary);
  } catch (error) {
    return errorResponse(res, "Internal Server Error");
  }
};