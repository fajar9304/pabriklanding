// Impor library yang dibutuhkan
import express from 'express';
import cors from 'cors';
import 'dotenv/config'; // Memuat variabel dari .env
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- Inisialisasi Aplikasi ---
const app = express();
const PORT = process.env.PORT || 10000;

// --- Konfigurasi Keamanan (CORS) ---
const allowedOrigins = [
  process.env.FIREBASE_HOSTING_URL,
  'https://pabriklanding.web.app',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Domain ini tidak diizinkan oleh CORS'));
    }
  }
};

// --- Middleware ---
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Naikkan limit payload untuk kode HTML

// --- Inisialisasi Google Gemini AI ---
if (!process.env.GEMINI_API_KEY) {
  console.error("FATAL ERROR: GEMINI_API_KEY tidak ditemukan.");
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-09-2025" });
console.log("Koneksi ke Gemini AI berhasil.");

// --- Pengecekan Token Netlify ---
if (!process.env.NETLIFY_ACCESS_TOKEN) {
  console.warn("PERINGATAN: NETLIFY_ACCESS_TOKEN tidak ditemukan. Fitur 'Publikasikan' tidak akan berfungsi.");
}


// --- Routes (Endpoint) ---

app.get('/', (req, res) => {
  res.status(200).send('Server API Pabrik Landing (V2.0) aktif dan berjalan!');
});

/**
 * Endpoint BARU untuk GENERATE Kode
 * Menerima 'brief' (data formulir) dari frontend.
 */
app.post('/api/generate', async (req, res) => {
  console.log("Menerima permintaan ke /api/generate (V2)...");
  try {
    const brief = req.body.brief; // Frontend hanya mengirim data formulir
    if (!brief) {
      return res.status(400).json({ error: 'Brief (data formulir) tidak lengkap.' });
    }

    // --- PROMPT DIPINDAHKAN KE SERVER ---
    const systemPrompt = `Anda adalah seorang pakar Direct-Response Marketing dan Developer Frontend elit. Misi utama Anda adalah menjual produk pengguna.

Aturan Keras (Teknis):
1. SELALU gunakan kelas Tailwind CSS. JANGAN gunakan tag <style> kustom.
2. Buat desain mobile-first dan responsif penuh.
3. JANGAN SERTAKAN markdown \`\`\`html. HANYA berikan kode HTML lengkap, dimulai dari \`<!DOCTYPE html>\`.
4. Jika user memberikan link gambar, WAJIB gunakan link tersebut. Jika tidak, gunakan placeholder \`https://placehold.co/600x400\`.
5. Tampilkan 'Aset Gambar Testimoni' sebagai GAMBAR PENUH (bukti screenshot), bukan foto profil.
6. SELALU gunakan 'Link Tombol Aksi (CTA)' untuk SEMUA tombol call-to-action utama.
7. **ATURAN V2.0 (PENTING):** Untuk *setiap* elemen HTML yang bermakna (div, h1, p, button, a, img, section), tambahkan atribut 'data-id' unik. Formatnya adalah \`data-id="lp-el-{uuid}"\`. Ganti {uuid} dengan 8 karakter acak (contoh: \`data-id="lp-el-a1b2c3d4"\`). Ini WAJIB untuk fitur editor visual.`;

    // --- (PERBAIKAN) ---
    // Menggunakan bracket notation (brief['product-name'])
    // untuk membaca data dengan tanda hubung (-)
    const userQuery = `
### Brief Klien ###
* Nama Brand/Produk: ${brief['product-name']}
* Deskripsi Produk: ${brief['product-description']}
* Target Audiens: ${brief['target-audience']}
* Unique Selling Prop: ${brief['product-usp']}
* Harga Jual: ${brief['product-price'] || 'Tidak ditentukan (fokus leads).'}
* Harga Coret (Normal): ${brief['product-slashed-price'] || 'Tidak ada.'}
* Tujuan Utama: ${brief.finalGoal}
* Link Tombol Aksi (CTA): ${brief['cta-link']}
* Penawaran/Urgensi: ${brief['product-offer'] || 'Tidak ada penawaran khusus.'}
* Warna Brand: ${brief['color-scheme']}
* Gaya Visual (Mood): ${brief.mood}
* Gaya Bahasa (Tone): ${brief['language-style']}
* Bagian Wajib: ${brief.requiredSections}
* Inspirasi (Opsional): ${brief['reference-link'] || 'Tidak ada.'}
* Aset Gambar Hero: ${brief.heroImage || 'Gunakan placeholder standar.'}
* Aset Gambar Fitur (bisa lebih dari 1, dipisah baris baru): ${brief.featureImages || 'Gunakan placeholder standar.'} (Tampilkan sebagai: ${brief.featureSlider ? 'Slider' : 'Grid'})
* Aset Gambar Testimoni (bisa lebih dari 1, dipisah baris baru): ${brief.testimonialImages || 'Gunakan placeholder standar.'}
* Catatan Tambahan: ${brief['additional-details'] || 'Fokuskan pada konversi penjualan.'}

Hasilkan kode HTML lengkap dan tunggal. Jangan lupakan misi utama: buat halaman ini **menjual** dan tambahkan **data-id** di setiap elemen.`;

    // 3. Panggil Gemini API
    console.log("Memanggil Gemini API untuk /api/generate...");
    const result = await model.generateContent({
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
    });

    const response = await result.response;
    const text = response.text();

    // 4. Kirim kembali respons yang MIRIP dengan API Google
    console.log("Berhasil mendapat respons dari Gemini. Mengirim ke frontend...");
    res.status(200).json({
      candidates: [{
        content: {
          parts: [{ text: text }]
        }
      }]
    });

  } catch (error) {
    console.error("Error di /api/generate:", error);
    res.status(500).json({ error: 'Terjadi kesalahan internal pada server.', details: error.message });
  }
});


/**
 * Endpoint BARU untuk EDIT Kode
 */
app.post('/api/edit', async (req, res) => {
  console.log("Menerima permintaan ke /api/edit (V2)...");
  
  try {
    const { currentCode, editInstruction } = req.body;

    if (!currentCode || !editInstruction) {
      return res.status(400).json({ error: 'Payload (currentCode atau editInstruction) tidak lengkap.' });
    }

    // --- PROMPT EDIT DIPINDAHKAN KE SERVER ---
    const systemPrompt = `Anda adalah editor kode HTML/Tailwind CSS yang fokus pada optimasi konversi.

Aturan Keras:
1. HANYA KEMBALIKAN kode HTML LENGKAP yang telah dimodifikasi.
2. JANGAN SERTAKAN markdown \`\`\`html.
3. JANGAN tambahkan penjelasan di luar kode HTML.
4. **ATURAN V2.0 (PENTING):** WAJIB pertahankan semua atribut \`data-id\` yang sudah ada di dalam kode. Jika Anda membuat elemen baru, tambahkan \`data-id\` baru untuk elemen tersebut. JANGAN HAPUS data-id yang ada.`;

    const userQuery = `
### KODE HTML SAAT INI:
${currentCode}

### INSTRUKSI EDITING:
${editInstruction}

Hasilkan kode HTML yang telah diperbarui. Ingat, pertahankan semua atribut 'data-id' yang ada.`;

    // 3. Panggil Gemini API
    console.log("Memanggil Gemini API untuk /api/edit...");
    const result = await model.generateContent({
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
    });

    const response = await result.response;
    const text = response.text();

    // 4. Kirim kembali respons
    console.log("Berhasil mendapat respons dari Gemini. Mengirim ke frontend...");
    res.status(200).json({
      candidates: [{
        content: {
          parts: [{ text: text }]
        }
      }]
    });

  } catch (error)
 {
    console.error("Error di /api/edit:", error);
    res.status(500).json({ error: 'Terjadi kesalahan internal pada server.', details: error.message });
  }
});


/**
 * ==================================================
 * == (BARU) Endpoint untuk DEPLOY ke NETLIFY ==
 * ==================================================
 */
app.post('/api/deploy', async (req, res) => {
  console.log("Menerima permintaan ke /api/deploy (V2)...");
  
  const { htmlContent } = req.body;
  const netlifyToken = process.env.NETLIFY_ACCESS_TOKEN;

  if (!netlifyToken) {
    console.error("Error di /api/deploy: NETLIFY_ACCESS_TOKEN tidak ditemukan.");
    return res.status(500).json({ error: "Server belum dikonfigurasi untuk deploy. Token Netlify tidak ada." });
  }

  if (!htmlContent) {
    return res.status(400).json({ error: 'Payload (htmlContent) tidak lengkap.' });
  }

  let siteId = null;

  try {
    // --- LANGKAH 1: Buat Situs Baru di Netlify ---
    console.log("Menghubungi Netlify API untuk membuat situs baru...");
    const createSiteResponse = await fetch('https://api.netlify.com/api/v1/sites', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${netlifyToken}`,
        'Content-Type': 'application/json'
      },
      // (PERBAIKAN) Memberi tahu Netlify untuk membuat di dalam tim 'pabrik-landing'
      body: JSON.stringify({ "account_slug": "pabrik-landing" }) 
    });

    if (!createSiteResponse.ok) {
      const errorData = await createSiteResponse.json();
      console.error("Gagal membuat situs Netlify:", errorData);
      throw new Error(`Gagal membuat situs di Netlify: ${errorData.message}`);
    }

    const siteData = await createSiteResponse.json();
    siteId = siteData.site_id;
    const siteUrl = siteData.ssl_url || siteData.url;
    console.log(`Situs baru berhasil dibuat. Site ID: ${siteId}, URL: ${siteUrl}`);

    // --- LANGKAH 2: Deploy Kode HTML ke Situs Baru ---
    console.log(`Mendeploy index.html ke situs ${siteId}...`);
    const deployResponse = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${netlifyToken}`,
        'Content-Type': 'application/json'
      },
      // Mengirimkan file index.html
      body: JSON.stringify({
        files: {
          'index.html': htmlContent
        }
      })
    });

    if (!deployResponse.ok) {
      const errorData = await deployResponse.json();
      console.error("Gagal deploy ke Netlify:", errorData);
      throw new Error(`Gagal deploy kode ke Netlify: ${errorData.message}`);
    }

    const deployData = await deployResponse.json();
    console.log(`Deploy berhasil! ID Deploy: ${deployData.id}`);

    // --- (PERBAIKAN 404/Race Condition) ---
    // Gunakan 'deploy_ssl_url' (URL spesifik deploy) alih-alih 'siteUrl' (URL produksi)
    const liveUrl = deployData.deploy_ssl_url || siteUrl;

    // --- LANGKAH 3: Kirim URL kembali ke Frontend ---
    res.status(200).json({
      message: 'Deploy berhasil!',
      url: liveUrl // Mengirimkan URL yang dijamin aktif
    });

  } catch (error) {
    console.error("Error selama proses /api/deploy:", error);
    // (Opsional: Hapus situs yang gagal deploy agar tidak menumpuk)
    if (siteId) {
      console.log(`Mencoba menghapus situs ${siteId} yang gagal...`);
      await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${netlifyToken}` }
      });
    }
    res.status(500).json({ error: 'Terjadi kesalahan internal saat deploy.', details: error.message });
  }
});


// --- Mulai Server ---
app.listen(PORT, () => {
  console.log(`Server (V2.0) mendengarkan di port ${PORT}`);
  console.log(`Domain frontend yang diizinkan: ${allowedOrigins.join(', ')}`);
});
