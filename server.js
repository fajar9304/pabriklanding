// Impor library yang dibutuhkan
import express from 'express';
import cors from 'cors';
import 'dotenv/config'; // Memuat variabel dari .env
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- Inisialisasi Aplikasi ---
const app = express();
// Render akan mengatur PORT, atau kita gunakan 10000 untuk lokal
const PORT = process.env.PORT || 10000;

// --- Konfigurasi Keamanan (CORS) ---
// Tentukan domain frontend Anda yang diizinkan
const allowedOrigins = [
  process.env.FIREBASE_HOSTING_URL, // Variabel Lingkungan dari Render
  'https://pabriklanding.web.app', // Fallback
  'http://localhost:5500',         // Untuk testing lokal
  'http://127.0.0.1:5500'          // Untuk testing lokal
];

const corsOptions = {
  origin: (origin, callback) => {
    // Izinkan jika domain ada di 'allowedOrigins' atau jika request tidak memiliki 'origin' (misal: Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Domain ini tidak diizinkan oleh CORS'));
    }
  }
};

// --- Middleware ---
app.use(cors(corsOptions)); // Terapkan aturan CORS
app.use(express.json());   // Izinkan server membaca JSON dari body request

// --- Inisialisasi Google Gemini AI ---
if (!process.env.GEMINI_API_KEY) {
  console.error("FATAL ERROR: GEMINI_API_KEY tidak ditemukan. Server tidak bisa dimulai.");
  process.exit(1); // Keluar jika API Key tidak ada
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-09-2025" });
console.log("Koneksi ke Gemini AI berhasil.");

// --- Routes (Endpoint) ---

/**
 * Route Pengecekan Kesehatan
 * Untuk memastikan server berjalan di Render.
 */
app.get('/', (req, res) => {
  res.status(200).send('Server API Pabrik Landing aktif dan berjalan!');
});

/**
 * Endpoint Utama API
 * Menerima payload dari frontend, memanggil Gemini, dan mengembalikan hasilnya.
 * Ini akan menangani 'generate' dan 'edit'.
 */
app.post('/api/generate', async (req, res) => {
  console.log("Menerima permintaan ke /api/generate...");

  try {
    // 1. Ambil payload dari frontend
    // Kita percaya frontend mengirimkan format yang benar
    const { contents, systemInstruction } = req.body;

    // 2. Validasi payload sederhana
    if (!contents || !systemInstruction) {
      console.warn("Permintaan ditolak: Payload tidak lengkap.");
      return res.status(400).json({ error: 'Payload (contents atau systemInstruction) tidak lengkap.' });
    }

    // 3. Panggil Gemini API
    console.log("Memanggil Gemini API...");
    const result = await model.generateContent({
      contents: contents,
      systemInstruction: systemInstruction,
    });

    const response = await result.response;
    const text = response.text();

    // 4. Kirim kembali respons yang MIRIP dengan API Google
    // Ini PENTING agar kita tidak perlu banyak mengubah frontend.
    console.log("Berhasil mendapat respons dari Gemini. Mengirim ke frontend...");
    res.status(200).json({
      candidates: [{
        content: {
          parts: [{ text: text }]
        }
      }]
    });

  } catch (error) {
    console.error("Error saat memanggil Gemini:", error);
    res.status(500).json({ error: 'Terjadi kesalahan internal pada server.', details: error.message });
  }
});

// --- Mulai Server ---
app.listen(PORT, () => {
  console.log(`Server mendengarkan di port ${PORT}`);
  console.log(`Domain frontend yang diizinkan: ${allowedOrigins.join(', ')}`);
});
