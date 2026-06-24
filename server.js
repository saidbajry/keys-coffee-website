const express = require('express');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const mysql = require('mysql2/promise');
const ExcelJS = require('exceljs');

const app = express();
const PORT = 3000;

require('dotenv').config();

const OpenAI = require("openai");

const ai = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
});

// --- INTEGRASI SATU DATABASE KONEKSI (PROMISE POOL) ---
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'keys_coffee',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Tes Koneksi Database Aman (Menggunakan gaya .then agar terhindar dari top-level await)
db.getConnection()
    .then(connection => {
        console.log('Sukses terhubung ke database fisik MySQL (keys_coffee) via Promise Pool!');
        connection.release();
    })
    .catch(err => {
        console.error('Gagal terhubung ke MySQL:', err.message);
    });

// --- KONFIGURASI MULTER (UPLOAD GAMBAR) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './public/uploads/';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: 'keys-coffee-secret-key',
    resave: false,
    saveUninitialized: true
}));

// Middleware Proteksi Admin
function checkAdmin(req, res, next) {
    if (req.session.isAdmin) {
        next();
    } else {
        res.redirect('/login');
    }
}

// --- ROUTES MANAGEMENT ---

// 1. Beranda Utama
app.get('/', async (req, res) => {
    try {
        const query = 'SELECT * FROM products ORDER BY id DESC';
        const [results] = await db.query(query);
        res.render('index', {
            products: results,
            user: req.session.customerName || null
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database Error');
    }
});

// 2. Fitur Register Customer
app.get('/register', (req, res) => {
    res.render('register', { error: null });
});

app.post('/register', async (req, res) => {
    const { name, username, password } = req.body;
    const cleanUsername = username.toLowerCase();

    try {
        const [results] = await db.query('SELECT * FROM users WHERE username = ?', [cleanUsername]);
        if (results.length > 0) {
            return res.render('register', { error: 'Username sudah digunakan, pilih yang lain!' });
        }

        const insertQuery = 'INSERT INTO users (name, username, password) VALUES (?, ?, ?)';
        await db.query(insertQuery, [name, cleanUsername, password]);
        res.redirect('/login');
    } catch (err) {
        console.error(err);
        res.render('register', { error: 'Gagal mendaftar akibat kendala sistem!' });
    }
});

// 3. Fitur Login
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { username, password, role } = req.body;

    if (role === 'admin') {
        if (username === 'admin' && password === 'admin123') {
            req.session.isAdmin = true;
            return res.redirect('/admin');
        }
        return res.render('login', { error: 'Akses Ditolak! Kredensial Admin Salah.' });
    } else {
        try {
            const loginQuery = 'SELECT * FROM users WHERE username = ? AND password = ?';
            const [results] = await db.query(loginQuery, [username.toLowerCase(), password]);

            if (results.length > 0) {
                req.session.isUser = true;
                req.session.customerName = results[0].name;
                return res.redirect('/');
            } else {
                return res.render('login', { error: 'Username atau password salah!' });
            }
        } catch (err) {
            console.error(err);
            return res.render('login', { error: 'Database error!' });
        }
    }
});

// 4. Portal Dashboard Admin + Data Grafik
app.get('/admin', checkAdmin, async (req, res) => {
    try {
        const queryProducts = 'SELECT * FROM products ORDER BY id DESC';
        const queryUsers = 'SELECT id, name, username, created_at FROM users ORDER BY id DESC';
        const queryMessages = 'SELECT * FROM messages ORDER BY id DESC';
        const queryChart = `
    SELECT 
        DATE_FORMAT(created_at, '%M %Y') AS bulan, 
        SUM(total_price) AS total 
    FROM orders 
    GROUP BY YEAR(created_at), MONTH(created_at)
    ORDER BY YEAR(created_at) ASC, MONTH(created_at) ASC
    LIMIT 12
`;

        const [productResults] = await db.query(queryProducts);
        const [userResults] = await db.query(queryUsers);
        const [messageResults] = await db.query(queryMessages);
        const [chartResults] = await db.query(queryChart);
        const [orderResults] = await db.query('SELECT * FROM orders ORDER BY id_order DESC LIMIT 10');

        res.render('admin', {
            products: productResults,
            users: userResults,
            messages: messageResults,
            chartData: chartResults,
            orders: orderResults
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database Error pada Dashboard Admin');
    }
});

// API Admin: Tambah Produk
app.post('/admin/add-product', checkAdmin, upload.single('product_image'), async (req, res) => {
    const { name, price, description } = req.body;
    const cleanPrice = price.replace(/[^0-9]/g, '');
    const formattedPrice = 'Rp ' + Number(cleanPrice).toLocaleString('id-ID');

    let imagePath = '/images/product-1.png';
    if (req.file) {
        imagePath = '/uploads/' + req.file.filename;
    }

    try {
        const insertProductQuery = 'INSERT INTO products (name, price, description, img) VALUES (?, ?, ?, ?)';
        await db.query(insertProductQuery, [name, formattedPrice, description, imagePath]);
        res.redirect('/admin');
    } catch (err) {
        console.error('Gagal tambah produk:', err);
        res.redirect('/admin');
    }
});

// API Admin: Hapus Pesan
app.post('/admin/delete-message/:id', checkAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        await db.query('DELETE FROM messages WHERE id = ?', [id]);
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.redirect('/admin');
    }
});

// API Admin: Hapus Produk
app.post('/admin/delete-product/:id', checkAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const [results] = await db.query('SELECT img FROM products WHERE id = ?', [id]);
        if (results.length === 0) return res.redirect('/admin');
        const imageToDelete = results[0].img;

        await db.query('DELETE FROM products WHERE id = ?', [id]);

        if (imageToDelete.startsWith('/uploads/')) {
            const targetPath = path.join(__dirname, 'public', imageToDelete);
            if (fs.existsSync(targetPath)) {
                fs.unlinkSync(targetPath);
            }
        }
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.redirect('/admin');
    }
});

app.post('/api/checkout', async (req, res) => {
    const { items, totalPrice } = req.body || {};

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: 'Keranjang belanja kosong!' });
    }

    const customerName = req.session.customerName || 'Pelanggan Guest';

    try {
        // 1. Pembersihan angka total harga murni
        let nominalMurni = 0;
        if (totalPrice !== undefined && totalPrice !== null) {
            nominalMurni = typeof totalPrice === 'string'
                ? parseInt(totalPrice.replace(/[^0-9]/g, ''))
                : parseInt(totalPrice);
        }
        if (isNaN(nominalMurni)) nominalMurni = 0;

        // 2. Kueri Aman: Hapus id_user dari list insert agar tidak memicu Foreign Key Constraint Error di MySQL
        // Kolom status_pembayaran kita bungkus dengan COALESCE/IFNULL atau kita abaikan jika belum ada, 
        // tapi di sini kita masukkan versi aman yang hanya mengisi customer_name dan total_price terlebih dahulu.

        let insertOrderQuery = 'INSERT INTO orders (customer_name, total_price) VALUES (?, ?)';
        let queryParams = [customerName, nominalMurni];

        // TIPS: Jika lu sudah tambah kolom status_pembayaran di phpMyAdmin, gunakan baris di bawah ini:
        insertOrderQuery = 'INSERT INTO orders (customer_name, total_price, status_pembayaran) VALUES (?, ?, ?)';
        queryParams = [customerName, nominalMurni, 'success'];

        const [orderResult] = await db.query(insertOrderQuery, queryParams);
        const newOrderId = orderResult.insertId;

        // 3. Simpan detail ke tabel order_items
        const insertItemQuery = 'INSERT INTO order_items (id_order, product_name, qty, price) VALUES (?, ?, ?, ?)';

        for (const item of items) {
            let hargaItemMurni = 0;
            if (item.price !== undefined && item.price !== null) {
                hargaItemMurni = typeof item.price === 'string'
                    ? parseInt(item.price.replace(/[^0-9]/g, ''))
                    : parseInt(item.price);
            }
            if (isNaN(hargaItemMurni)) hargaItemMurni = 0;

            await db.query(insertItemQuery, [
                newOrderId,
                item.name || 'Menu',
                parseInt(item.qty) || 1,
                hargaItemMurni
            ]);
        }

        // 4. Bangun teks nota WhatsApp
        let textWhatsApp = `Hello Key's Coffee ☕%0A%0ASaya ingin membeli (Order ID: #${newOrderId}):%0A`;

        items.forEach(item => {
            let hargaItemMurni = typeof item.price === 'string'
                ? parseInt(item.price.replace(/[^0-9]/g, ''))
                : parseInt(item.price);
            if (isNaN(hargaItemMurni)) hargaItemMurni = 0;

            let subTotalItem = hargaItemMurni * (parseInt(item.qty) || 1);
            textWhatsApp += `- ${item.name} (x${item.qty}) = Rp ${subTotalItem.toLocaleString('id-ID')}%0A`;
        });

        textWhatsApp += `%0ATotal Pembayaran: *Rp ${nominalMurni.toLocaleString('id-ID')}*%0A%0APesan saya sudah tercatat di database sistem. Mohon diproses!`;

        // 5. Kirim balik respon sukses JSON utuh
        return res.json({
            success: true,
            whatsAppUrl: `https://wa.me/6285952867098?text=${textWhatsApp}`
        });

    } catch (err) {
        // Menampilkan pesan error asli di terminal VS Code biar lu bisa baca letak gagal kuerinya di mana
        console.error('⚠️ DETAIL EROR DATABASE ASLI:', err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// API: Download Laporan Excel Bulanan
app.get('/admin/download-report', checkAdmin, async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Laporan Key\'s Coffee');

        const queryReport = 'SELECT id_order, customer_name, total_price, created_at FROM orders WHERE created_at >= NOW() - INTERVAL 1 MONTH ORDER BY id_order DESC';
        const [rows] = await db.query(queryReport);

        worksheet.columns = [
            { header: 'ID Order', key: 'id_order', width: 12 },
            { header: 'Nama Pelanggan', key: 'customer_name', width: 25 },
            { header: 'Total Pembayaran', key: 'total_price', width: 18 },
            { header: 'Tanggal Transaksi', key: 'created_at', width: 22 }
        ];

        worksheet.getRow(1).font = { bold: true };

        rows.forEach(order => {
            worksheet.addRow({
                id_order: `#${order.id_order}`,
                customer_name: order.customer_name,
                total_price: `Rp ${order.total_price.toLocaleString('id-ID')}`,
                created_at: new Date(order.created_at).toLocaleString('id-ID')
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Laporan_Bulanan_Keys_Coffee.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error(err);
        res.status(500).send('Gagal mengekspor data laporan.');
    }
});

// API: Customer mengirim pesan saran/kontak
app.post('/api/contact', async (req, res) => {
    const { name, email, phone, message } = req.body;
    if (!name || !email || !message) {
        return res.status(400).json({ success: false, error: 'All fields required' });
    }
    try {
        const query = 'INSERT INTO messages (name, email, phone, message) VALUES (?, ?, ?, ?)';
        await db.query(query, [name, email, phone || '-', message]);
        res.json({ success: true, message: 'Pesan terkirim!' });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// API: Chatbot Gemini Real-Time DB
app.post('/api/chat', async (req, res) => {

    const { message } = req.body;

    if (!message) {
        return res.status(400).json({
            reply: "Pesan kosong"
        });
    }

    try {

        const [products] = await db.query(
            'SELECT name, price, description FROM products'
        );

        const daftarMenu = products.map(p =>
            `${p.name} - ${p.price} - ${p.description}`
        ).join('\n');

        console.log("OPENROUTER KEY:",
            process.env.OPENROUTER_API_KEY ? "ADA" : "TIDAK ADA"
        );

        console.log("CHAT MASUK:", message);
        const completion = await ai.chat.completions.create({
            model: "google/gemma-4-26b-a4b-it:free",

            messages: [
                {
                    role: "system",
                    content: `
Kamu adalah Key's AI Coffee.

Jawab hanya seputar menu Key's Coffee,
kopi, makanan, minuman, promo,
dan layanan toko.

Daftar Menu:

${daftarMenu}
`
                },
                {
                    role: "user",
                    content: message
                }
            ],

            temperature: 0.7,
            max_tokens: 300

        });

        const reply =
            completion?.choices?.[0]?.message?.content ||
            "Maaf, saya tidak dapat memberikan jawaban saat ini.";

        res.json({
            reply
        });

    } catch (error) {

        console.error("OPENROUTER ERROR:");
        console.error(error);

        res.status(500).json({
            reply:
                error?.error?.message ||
                error?.message ||
                "AI sedang mengalami gangguan."
        });

    }

});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get("/models", async (req, res) => {
    try {

        const response = await fetch(
            "https://openrouter.ai/api/v1/models"
        );

        const data = await response.json();

        const freeModels = data.data
            .filter(model => model.id.includes(":free"))
            .map(model => model.id);

        res.json(freeModels);

    } catch (err) {

        console.error(err);
        res.status(500).send(err.message);

    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

app.get("/models", async (req, res) => {
    try {

        const response = await fetch(
            "https://openrouter.ai/api/v1/models"
        );

        const data = await response.json();

        const freeModels = data.data
            .filter(model =>
                model.id.includes(":free")
            )
            .map(model => model.id);

        res.json(freeModels);

    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});