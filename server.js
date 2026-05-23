require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { Telegraf, session, Markup } = require('telegraf');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const { exec } = require('child_process');

// ==========================================
// 1. SETUP EXPRESS & SOCKET.IO 
// ==========================================
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Mengatasi warning SSL (libpq compatibility) di pg versi terbaru
let dbUrl = process.env.DATABASE_URL || '';
if (dbUrl.includes('sslmode=require') && !dbUrl.includes('uselibpqcompat=true')) {
    dbUrl = dbUrl.replace('sslmode=require', 'uselibpqcompat=true&sslmode=require');
}

const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

// ==========================================
// 2. SETUP BOT TELEGRAM (10 MENU ENTERPRISE)
// ==========================================
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
bot.use(session());

const showMainMenu = (ctx, nama) => {
    return ctx.reply(`🏢 *NEXUS SCADA TERMINAL*\n\nHalo, *${nama}*! Akses Diberikan.\n\n[ MENU OPERASIONAL UTAMA ]`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('📝 Lapor Shift', 'MENU_LAPOR'), Markup.button.callback('🚨 Lapor Insiden', 'MENU_INSIDEN')],
            [Markup.button.callback('🔧 Request Teknisi', 'MENU_TEKNISI'), Markup.button.callback('📊 Cek KPI', 'MENU_KPI')],
            [Markup.button.callback('⚙️ Status Mesin', 'MENU_MESIN'), Markup.button.callback('💡 Kotak Saran', 'MENU_SARAN')],
            [Markup.button.callback('📖 SOP K3', 'MENU_SOP'), Markup.button.callback('📅 Jadwal Shift', 'MENU_JADWAL')],
            [Markup.button.callback('👥 Lapor Izin/Sakit', 'MENU_IZIN'), Markup.button.callback('🚪 Logout Sistem', 'MENU_LOGOUT')]
        ])
    });
};

bot.start(async (ctx) => {
    io.emit('bot_activity', { user: ctx.from.first_name, action: 'Akses Bot', detail: 'Membuka terminal bot.' });
    const chatId = ctx.chat.id;
    try {
        const result = await pool.query('SELECT nama FROM operators WHERE telegram_chat_id = $1', [chatId]);
        if (result.rows.length > 0) return showMainMenu(ctx, result.rows[0].nama);
        ctx.reply('🔒 *AKSES DITOLAK*\nSilakan login dengan format:\n`/login <PIN>`', { parse_mode: 'Markdown' });
    } catch (err) { console.error(err); }
});

bot.hears(/^\/login (.+)/, async (ctx) => {
    const pin = ctx.match[1];
    const chatId = ctx.chat.id;
    try {
        const result = await pool.query(`SELECT id, nama, tenant_id FROM operators WHERE pin = $1`, [pin]);
        if (result.rows.length > 0) {
            const operator = result.rows[0];
            await pool.query('UPDATE operators SET telegram_chat_id = $1 WHERE id = $2', [chatId, operator.id]);
            ctx.reply(`✅ *OTENTIKASI BERHASIL*\nSelamat bertugas, ${operator.nama}.`, { parse_mode: 'Markdown' });
            io.emit('bot_activity', { user: operator.nama, action: 'Login Sukses', detail: 'Telah masuk ke sistem.' });
            showMainMenu(ctx, operator.nama);
        } else {
            ctx.reply('❌ PIN tidak valid.');
        }
    } catch (err) {}
});

bot.action('MENU_LAPOR', async (ctx) => {
    ctx.answerCbQuery();
    const result = await pool.query('SELECT * FROM operators WHERE telegram_chat_id = $1', [ctx.chat.id]);
    if (result.rows.length === 0) return ctx.reply('Sesi habis.');
    io.emit('bot_activity', { user: result.rows[0].nama, action: 'Buka Form', detail: 'Mengisi laporan shift.' });
    ctx.session = { step: 'tunggu_kendala', operator: result.rows[0] };
    ctx.reply('📝 Tuliskan *Laporan Pekerjaan/Kendala* hari ini:', { parse_mode: 'Markdown' });
});

bot.action('MENU_INSIDEN', async (ctx) => {
    ctx.answerCbQuery();
    const result = await pool.query('SELECT nama FROM operators WHERE telegram_chat_id = $1', [ctx.chat.id]);
    io.emit('bot_activity', { user: result.rows[0]?.nama || 'Unknown', action: '🚨 DARURAT', detail: 'Tombol Insiden ditekan!' });
    ctx.reply('🚨 Silakan ketik detail insiden (Awali dengan kata INSIDEN).');
});

bot.action('MENU_TEKNISI', async (ctx) => {
    ctx.answerCbQuery('Tiket perbaikan dibuat!', { show_alert: true });
    const result = await pool.query('SELECT nama FROM operators WHERE telegram_chat_id = $1', [ctx.chat.id]);
    io.emit('bot_activity', { user: result.rows[0]?.nama || 'Unknown', action: '🔧 REQ TEKNISI', detail: 'Meminta teknisi ke lapangan.' });
    ctx.reply('🔧 Permintaan teknisi telah dikirim ke layar SCADA Pusat.');
});

bot.action('MENU_KPI', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('📊 *KPI HARIAN ANDA*\n- OEE Aktual: 94.5%\n- Kehadiran: Hadir 100%\n- Status: Bekerja Optimal', { parse_mode: 'Markdown' });
});

bot.action('MENU_MESIN', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('⚙️ *STATUS MESIN (LIVE)*\n- Suhu Inti: ~85.2°C\n- RPM Turbin: ~2450 RPM\n- Integritas: Aman', { parse_mode: 'Markdown' });
});

bot.action('MENU_SARAN', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('💡 Silakan ketik saran Anda (Awali dengan kata SARAN).');
});

bot.action('MENU_SOP', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('📖 *SOP KESELAMATAN K3*\n1. Wajib pakai helm & kacamata proyek.\n2. Dilarang merokok di area mesin.\n3. Tekan E-STOP jika terjadi percikan api.', { parse_mode: 'Markdown' });
});

bot.action('MENU_JADWAL', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('📅 *JADWAL SHIFT*\nShift Anda hari ini: Reguler (08:00 - 16:00 WIB). Besok: Libur.', { parse_mode: 'Markdown' });
});

bot.action('MENU_IZIN', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('👥 Silakan ketik alasan izin/sakit Anda (Awali dengan kata IZIN).');
});

bot.action('MENU_LOGOUT', async (ctx) => {
    ctx.answerCbQuery();
    try {
        await pool.query('UPDATE operators SET telegram_chat_id = NULL WHERE telegram_chat_id = $1', [ctx.chat.id]);
        ctx.reply('🚪 Anda berhasil logout dari sistem. Silakan /login kembali untuk akses.');
    } catch (e) {}
});

bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const result = await pool.query('SELECT nama FROM operators WHERE telegram_chat_id = $1', [ctx.chat.id]);
    const namaUser = result.rows[0]?.nama || ctx.from.first_name;
    
    if (text.toUpperCase().startsWith('INSIDEN')) {
        io.emit('bot_activity', { user: namaUser, action: '🚨 LAPORAN DARURAT', detail: text });
        return ctx.reply('🚨 *Sinyal Darurat Diterima Command Center!*', { parse_mode: 'Markdown' });
    }
    
    if (text.toUpperCase().startsWith('SARAN')) {
        io.emit('bot_activity', { user: namaUser, action: '💡 KOTAK SARAN', detail: text });
        return ctx.reply('💡 Saran Anda telah diteruskan ke manajemen.');
    }
    
    if (text.toUpperCase().startsWith('IZIN')) {
        io.emit('bot_activity', { user: namaUser, action: '👥 LAPOR IZIN', detail: text });
        return ctx.reply('📋 Laporan Izin/Sakit telah dicatat oleh HRD.');
    }

    if (!ctx.session || !ctx.session.step) return;

    if (ctx.session.step === 'tunggu_kendala') {
        try {
            await pool.query(`INSERT INTO shift_reports (operator_id, kendala) VALUES ($1, $2)`, [ctx.session.operator.id, text]);
            ctx.reply('✅ *LAPORAN TERSIMPAN*\nDisinkronisasi dengan Server Cloud.', { parse_mode: 'Markdown' });
            io.emit('bot_activity', { user: ctx.session.operator.nama, action: 'Laporan Masuk', detail: text });
            ctx.session = null;
        } catch (err) {}
    }
});

io.on('connection', (socket) => {
    console.log('⚡ Web Dashboard (Frontend) Terhubung ke Server!');
    socket.on('send_broadcast', async (data) => {
        try {
            const result = await pool.query('SELECT telegram_chat_id FROM operators WHERE telegram_chat_id IS NOT NULL');
            let sukses = 0;
            for (let row of result.rows) {
                await bot.telegram.sendMessage(row.telegram_chat_id, `📢 *PESAN DARI MANAJER PUSAT:*\n\n"${data.message}"`, { parse_mode: 'Markdown' });
                sukses++;
            }
            console.log(`✅ Pesan broadcast terkirim ke ${sukses} karyawan.`);
        } catch (err) {
            console.error("Gagal mengirim broadcast:", err);
        }
    });
});

// FUNGSI MENDAPATKAN IP LOKAL AGAR BISA DIAKSES DARI HP
function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return '127.0.0.1';
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    const localIp = getLocalIp();
    console.log('\n=============================================');
    console.log(`🚀 SCADA LOKAL  : http://localhost:${PORT}`);
    console.log(`🌐 SCADA JARINGAN : http://${localIp}:${PORT} (Akses dari HP/Tablet)`);
    console.log('=============================================\n');
    
    // FUNGSI AUTO OPEN BROWSER
    const url = `http://localhost:${PORT}`;
    const startCmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    exec(`${startCmd} ${url}`);

    try {
        await bot.launch(); 
        console.log('🤖 Bot Telegram & Socket.io siap!');
    } catch (error) {
        console.error('❌ BOT TELEGRAM GAGAL NYALA. Cek VPN / Koneksi internet.');
    }
});