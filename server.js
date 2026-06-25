// --- 1. TARUH VARIABEL DATA DUMMY INI DI ATAS (Penganti Tabel Database) ---
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

// --- 2. UBAH ROUTE BERANDA UTAMA (/) ---
app.get('/', (req, res) => {
    // Langsung render data dummy tanpa query database
    res.render('index', {
        products: dummyProducts,
        user: req.session.customerName || null
    });
});

// --- 3. UBAH ROUTE DASHBOARD ADMIN (/admin) ---
app.get('/admin', checkAdmin, (req, res) => {
    // Langsung oper data dummy untuk grafik batang per 3 bulan & history tabel
    res.render('admin', {
        products: dummyProducts,
        users: [],
        messages: [],
        chartData: dummyChartData, // Grafik batang otomatis terisi data kuartal dummy!
        orders: dummyOrders        // History otomatis terisi baris transaksi dummy!
    });
});