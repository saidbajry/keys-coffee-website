// --- STATE & GLOBAL CONFIGURATION ---
const cart = [];
const NOMOR_WHATSAPP = "6285952867098"; // Nomor WhatsApp Key's Coffee

// --- DOM ELEMENTS ---
const cartSidebar = document.getElementById('cartSidebar');
const cartToggle = document.getElementById('cartToggle');
const closeCart = document.getElementById('closeCart');

const chatBot = document.getElementById('chatBot');
const chatToggle = document.getElementById('chatToggle');
const closeChat = document.getElementById('closeChat');

// --- SIDEBAR TOGGLES (CART & CHATBOT) ---
cartToggle.onclick = () => {
    cartSidebar.style.right = '0';
    chatBot.style.right = '-100%';
}

closeCart.onclick = () => {
    cartSidebar.style.right = '-100%';
}

chatToggle.onclick = () => {
    chatBot.style.right = '0';
    cartSidebar.style.right = '-100%';
}

closeChat.onclick = () => {
    chatBot.style.right = '-100%';
}

// --- FIX: EVENT DELEGATION MURNI UNTUK BUY CONTAINER ---
// Menggunakan document listener agar produk dinamis dari admin tidak macet saat diklik
document.addEventListener('click', (e) => {
    const container = e.target.closest('.buy-container');
    if (!container) return; // Keluar jika yang diklik bukan area buy-container

    const name = container.dataset.name;
    const price = parseInt(container.dataset.price);

    // 1. Jika yang diklik adalah tombol BUY awal
    if (e.target.classList.contains('buy-btn')) {
        addToCart(name, price);
        updateContainerUI(container, 1);
    }

    // 2. Jika yang diklik adalah tombol PLUS
    if (e.target.classList.contains('plus')) {
        let qtySpan = container.querySelector('.qty');
        let currentQty = parseInt(qtySpan.innerText) + 1;
        qtySpan.innerText = currentQty;
        addToCart(name, price);
    }

    // 3. Jika yang diklik adalah tombol MINUS
    if (e.target.classList.contains('minus')) {
        let qtySpan = container.querySelector('.qty');
        let currentQty = parseInt(qtySpan.innerText) - 1;

        removeFromCart(name);

        if (currentQty <= 0) {
            // Kembalikan ke struktur tombol Buy semula secara dinamis
            container.innerHTML = `
                <button class="buy-btn bg-primary text-white px-6 py-3 rounded-xl w-full hover:bg-gold transition tracking-wide text-sm font-semibold">
                    Buy
                </button>
            `;
        } else {
            qtySpan.innerText = currentQty;
        }
    }
});

// --- UI RE-RENDERING FUNCTIONS ---
function updateContainerUI(container, qty) {
    container.innerHTML = `
        <div class="flex items-center justify-between bg-primary text-white rounded-xl overflow-hidden shadow-md">
            <button class="minus px-5 py-3 text-xl hover:bg-gold transition font-bold focus:outline-none">-</button>
            <span class="qty text-lg font-semibold select-none">${qty}</span>
            <button class="plus px-5 py-3 text-xl hover:bg-gold transition font-bold focus:outline-none">+</button>
        </div>
    `;
}

function addToCart(name, price) {
    const item = cart.find(item => item.name === name);
    if (item) {
        item.qty++;
    } else {
        cart.push({ name, price, qty: 1 });
    }
    renderCart();
}

function removeFromCart(name) {
    const item = cart.find(item => item.name === name);
    if (item) {
        item.qty--;
        if (item.qty <= 0) {
            const index = cart.indexOf(item);
            cart.splice(index, 1);
        }
    }
    renderCart();
}

// Fungsi eksternal untuk handle hapus item langsung dari list keranjang belanja sidebar
window.removeDirectFromCart = function (name) {
    const item = cart.find(item => item.name === name);
    if (item) {
        cart.splice(cart.indexOf(item), 1);

        // Cari container produk di halaman depan untuk merestore UI tombolnya
        const targetContainer = document.querySelector(`.buy-container[data-name="${name}"]`);
        if (targetContainer) {
            targetContainer.innerHTML = `
                <button class="buy-btn bg-primary text-white px-6 py-3 rounded-xl w-full hover:bg-gold transition tracking-wide text-sm font-semibold">
                    Buy
                </button>
            `;
        }
    }
    renderCart();
}

function renderCart() {
    const cartItems = document.getElementById('cartItems');
    const cartCount = document.getElementById('cartCount');
    const cartTotal = document.getElementById('cartTotal');

    cartItems.innerHTML = '';
    let total = 0;
    let count = 0;

    cart.forEach(item => {
        total += item.price * item.qty;
        count += item.qty;

        cartItems.innerHTML += `
            <div class="bg-soft p-5 rounded-2xl flex justify-between items-center shadow-sm border border-stone-100">
                <div>
                    <h3 class="text-base font-bold text-primary font-serif">${item.name}</h3>
                    <p class="text-xs text-stone-500 mt-0.5">Qty: ${item.qty}</p>
                </div>
                <div class="flex items-center gap-4">
                    <p class="font-bold text-gold text-sm">Rp ${(item.price * item.qty).toLocaleString('id-ID')}</p>
                    <button onclick="removeDirectFromCart('${item.name}')" class="text-stone-400 hover:text-red-500 transition text-sm">✕</button>
                </div>
            </div>
        `;
    });

    if (cartCount) cartCount.innerText = count;
    if (cartTotal) cartTotal.innerText = total.toLocaleString('id-ID');
}

// --- DYNAMIC WHATSAPP CHECKOUT ---
document.getElementById('checkoutBtn').onclick = async () => {
    if (!window.currentUser) {
        alert('Waduh bro, lu harus login dulu sebagai customer sebelum bisa belanja!');
        window.location.href = '/login';
        return;
    }

    if (typeof cart === 'undefined' || cart.length === 0) {
        alert('Keranjang belanja kamu masih kosong, nih!');
        return;
    }

    let total = 0;
    cart.forEach(item => {
        let hargaMurni = typeof item.price === 'string' ? parseInt(item.price.replace(/[^0-9]/g, '')) : parseInt(item.price);
        total += hargaMurni * parseInt(item.qty);
    });

    document.getElementById('qrisTotal').innerText = 'Rp ' + total.toLocaleString('id-ID');

    // Generate Barcode Simulasi
    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = "";
    new QRCode(qrContainer, { text: `KEYS-DUMMY|TOTAL:${total}`, width: 200, height: 200 });

    // Munculkan Pop-up QRIS
    const modal = document.getElementById('qrisModal');
    modal.classList.remove('hidden');

    // --- TIMEOUT SIMULASI VERCEL (ANTI-API CRASH) ---
    setTimeout(() => {
        const statusText = document.getElementById('qrisStatus');
        statusText.innerHTML = "🟢 Pembayaran Berhasil Divalidasi!";
        statusText.className = "text-emerald-600 font-bold text-xs mb-2";

        // Bangun teks nota WhatsApp langsung di frontend
        let textWhatsApp = `Hello Key's Coffee ☕%0A%0ASaya ingin membeli (Order Online Vercel):%0A`;
        cart.forEach(item => {
            let hargaMurni = typeof item.price === 'string' ? parseInt(item.price.replace(/[^0-9]/g, '')) : parseInt(item.price);
            textWhatsApp += `- ${item.name} (x${item.qty}) = Rp ${(hargaMurni * item.qty).toLocaleString('id-ID')}%0A`;
        });
        textWhatsApp += `%0ATotal Pembayaran: *Rp ${total.toLocaleString('id-ID')}*%0A%0AMohon diproses kak!`;

        setTimeout(() => {
            modal.classList.add('hidden');
            cart.length = 0; // Kosongkan keranjang
            if (typeof renderCart === 'function') renderCart();

            // Langsung buka link WhatsApp tanpa nembak database server
            window.open(`https://wa.me/6285952867098?text=${textWhatsApp}`, '_blank');
        }, 1500);

    }, 5000); // Jeda simulasi scan 5 detik
};

// --- INTEGRASI CHATBOT AI GEMINI VIA BACKEND ---
const sendChat = document.getElementById('sendChat');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');

if (sendChat && chatInput) {
    sendChat.onclick = sendMessage;
    chatInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') sendMessage();
    });
}

async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    // 1. Tampilkan pesan user ke layar UI chatbox
    appendMessage(message, 'user');
    chatInput.value = '';

    // 2. Buat elemen indikator animasi typing bunderan/loading
    const typingDiv = document.createElement('div');
    typingDiv.className = 'bg-white p-4 rounded-2xl shadow-sm w-fit max-w-[90%] text-sm border border-stone-100 text-stone-400 italic animate-pulse';
    typingDiv.innerText = "Key's AI sedang mengetik...";
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
        // 3. Ambil respons dari backend (server.js) yang terhubung ke Gemini
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message })
        });

        const data = await response.json();

        // Hapus teks indikator mengetik
        chatMessages.removeChild(typingDiv);

        // 4. Munculkan balasan asli dari Gemini API
        appendMessage(data.reply, 'bot');

    } catch (error) {
        console.error('Error fetching AI reply:', error);
        chatMessages.removeChild(typingDiv);
        appendMessage('Gagal terhubung ke AI. Pastikan server nyala dan koneksi aman ya ☕', 'bot');
    }
}

function appendMessage(text, type) {
    const div = document.createElement('div');
    div.className = type === 'user'
        ? 'bg-primary text-white p-4 rounded-2xl ml-auto w-fit max-w-[90%] shadow-sm text-sm'
        : 'bg-white p-4 rounded-2xl shadow-sm w-fit max-w-[90%] text-sm border border-stone-100 text-stone-800 whitespace-pre-line';
    // whitespace-pre-line menjaga format baris baru (\n) dari respons Gemini tetap rapi

    div.innerText = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- AJAX SUBMIT FORM KONTAK / SARAN WITH CUSTOM TOAST ---
const contactForm = document.getElementById('contactForm');
if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = {
            name: document.getElementById('contactName').value,
            email: document.getElementById('contactEmail').value,
            phone: document.getElementById('contactPhone').value,
            message: document.getElementById('contactMessage').value
        };

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await response.json();
            if (result.success) {
                // PANGGIL TOAST KUSTOM (Ganti alert lama)
                showToast('Pesan Terkirim');
                contactForm.reset();
            } else {
                showToast('Gagal: ' + result.error);
            }
        } catch (error) {
            console.error('Error submitting contact form:', error);
            showToast('Terjadi kesalahan jaringan');
        }
    });
}

// FUNGSI ANIMASI SHOW TOAST
// --- KODE BAGIAN PALING BAWAH FILE APP.JS LU ---

// FUNGSI ANIMASI SHOW TOAST
function showToast(message) {
    const toast = document.getElementById('customToast');
    const toastMsg = document.getElementById('toastMessage');

    if (toast && toastMsg) {
        toastMsg.innerText = message;

        // Munculkan toast dengan animasi smooth naik ke atas
        toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-2');
        toast.classList.add('opacity-100', 'translate-y-0');

        // Hilang otomatis setelah 3 detik
        setTimeout(() => {
            toast.classList.remove('opacity-100', 'translate-y-0');
            toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-2');
        }, 3000);
    }
}