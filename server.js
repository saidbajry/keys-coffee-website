const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- DATA DUMMY LOKAL (Bypass Database MySQL) ---
const dummyProducts = [
    { id: 1, name: "Espresso Klasik", price: "Rp 18.000", description: "Kopi hitam pekat murni mantap.", img: "/images/product-1.png" },
    { id: 2, name: "Aren Latte", price: "Rp 22.000", description: "Perpaduan kopi espresso premium dan gula aren murni.", img: "/images/product-2.png" },
    { id: 3, name: "Matcha Coffee", price: "Rp 25.000", description: "Kombinasi unik teh hijau jepang dan espresso.", img: "/images/product-3.png" },
    { id: 4, name: "Croissant Almond", price: "Rp 20.000", description: "Pastry renyah pelengkap ngopi santai.", img: "/images/product-4.png" }
];

const dummyChartData = [
    { periode: 'Kuartal 1 (Jan-Mar)', total: 4500000 },
    { periode: 'Kuartal 2 (Apr-Jun)', total: 6800000 },
    { periode: 'Kuartal 3 (Jul-Sep)', total: 9200000 },
    { periode: 'Kuartal 4 (Okt-Des)', total: 13500000 }
];

const dummyOrders = [
    { id_order: 101, customer_name: "Budi Santoso", detail_items: "Aren Latte (x2), Croissant (x1)", total_price: 64000, status_pembayaran: "success", created_at: new Date() },
    { id_order: 102, customer_name: "Siti Aminah", detail_items: "Espresso Klasik (x1)", total_price: 18000, status_pembayaran: "success", created_at: new Date() }
];

// --- MIDDLEWARES CONFIGURATION ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: 'keys-coffee-vercel-secret-key',
    resave: false,
    saveUninitialized: true
}));

// Middleware Proteksi Admin Simulasi
function checkAdmin(req, res, next) {
    if (req.session.isAdmin) {
        next();
    } else {
        res.redirect('/login');
    }
}

// --- MANAGEMENT ROUTES ---

// Beranda Utama
app.get('/', (req, res) => {
    res.render('index', {
        products: dummyProducts,
        user: req.session.customerName || null
    });
});

// Login Portal
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    const { username, password, role } = req.body;

    if (role === 'admin') {
        req.session.isAdmin = true;
        return res.redirect('/admin');
    } else {
        req.session.isUser = true;
        req.session.customerName = username || 'Pelanggan Demo';
        return res.redirect('/');
    }
});

// Dashboard Admin (PASTIKAN SEMUA VARIABEL INI DI-OPER!)
app.get('/admin', checkAdmin, (req, res) => {
    res.render('admin', {
        products: dummyProducts,
        users: [],         // Agar users.length di admin.ejs tidak crash
        messages: [],      // Agar messages.length di admin.ejs tidak crash
        chartData: dummyChartData, // Data grafik batang kuartal
        orders: dummyOrders        // Data tabel riwayat transaksi
    });
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Handler Server Listen Port
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;