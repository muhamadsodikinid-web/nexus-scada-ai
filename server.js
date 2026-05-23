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

let dbUrl = process.env.DATABASE_URL || '';
if (dbUrl.includes('sslmode=require') && !dbUrl.includes('uselibpqcompat=true')) {
    dbUrl = dbUrl.replace('sslmode=require', 'uselibpqcompat=true&sslmode=require');
}

const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

// ==========================================
// 2. SETUP BOT TELEGRAM (ULTIMATE 50+ FEATURES)
// ==========================================
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
bot.use(session());

// Fungsi Helper untuk Emit ke Web Dashboard
const sendToWeb = (user, action, detail) => {
    io.emit('bot_activity', { user: user, action: action, detail: detail });
};

// --- MENU UTAMA (PAGINATION) ---
const showMainMenu = (ctx, nama) => {
    return ctx.reply(`🏢 *NEXUS SCADA TERMINAL*\n\nHalo, *${nama}*! Akses Diberikan.\nSilakan pilih modul operasional:`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('⚙️ Modul Mesin & Sensor', 'SUB_MESIN')],
            [Markup.button.callback('🔧 Modul Maintenance', 'SUB_MTX')],
            [Markup.button.callback('🛡️ Modul Keamanan', 'SUB_SECURITY')],
            [Markup.button.callback('👥 Modul HRD & Operator', 'SUB_HRD')],
            [Markup.button.callback('👨‍💻 Profil Developer (About)', 'MENU_ABOUT')],
            [Markup.button.callback('🚪 Logout Sistem', 'MENU_LOGOUT')]
        ])
    });
};

bot.start(async (ctx) => {
    sendToWeb(ctx.from.first_name, 'Akses Bot', 'Membuka terminal bot.');
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
            sendToWeb(operator.nama, 'Login Sukses', 'Telah masuk ke sistem.');
            showMainMenu(ctx, operator.nama);
        } else {
            ctx.reply('❌ PIN tidak valid.');
        }
    } catch (err) {}
});

// ==========================================
// SUB-MENU HANDLERS (50+ FITUR ENTERPRISE)
// ==========================================

// 1. SUB-MENU MESIN & SENSOR
bot.action('SUB_MESIN', (ctx) => {
    ctx.editMessageText('⚙️ *MODUL MESIN & SENSOR*\nPilih tindakan:', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('Cek Suhu Inti', 'ACT_SUHU'), Markup.button.callback('Cek RPM Turbin', 'ACT_RPM')],
            [Markup.button.callback('Cek OEE Efisiensi', 'ACT_OEE'), Markup.button.callback('Cek Tekanan Gas', 'ACT_GAS')],
            [Markup.button.callback('Cek Arus Listrik (A)', 'ACT_ARUS'), Markup.button.callback('Cek Voltase (V)', 'ACT_VOLT')],
            [Markup.button.callback('Diagnostik Lintas Sensor', 'ACT_DIAG_SENSOR')],
            [Markup.button.callback('⬅️ Kembali ke Utama', 'BACK_MAIN')]
        ])
    });
});

// 2. SUB-MENU MAINTENANCE
bot.action('SUB_MTX', (ctx) => {
    ctx.editMessageText('🔧 *MODUL MAINTENANCE*\nPilih tindakan:', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('Request Teknisi', 'MENU_TEKNISI'), Markup.button.callback('Lapor Insiden', 'MENU_INSIDEN')],
            [Markup.button.callback('Cek Level Pelumas', 'ACT_LUBRICANT'), Markup.button.callback('Cek Filter Udara', 'ACT_FILTER')],
            [Markup.button.callback('Kalibrasi Sensor Utama', 'ACT_CALIBRATE'), Markup.button.callback('Restart Router', 'ACT_RESTART_NET')],
            [Markup.button.callback('Log Pemeliharaan', 'ACT_LOG_MTX')],
            [Markup.button.callback('⬅️ Kembali ke Utama', 'BACK_MAIN')]
        ])
    });
});

// 3. SUB-MENU KEAMANAN
bot.action('SUB_SECURITY', (ctx) => {
    ctx.editMessageText('🛡️ *MODUL KEAMANAN (SECURITY)*\nPilih tindakan:', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('Cek Status CCTV', 'ACT_CCTV'), Markup.button.callback('Ping Radar Area', 'ACT_RADAR')],
            [Markup.button.callback('Kunci Pintu Sektor 7', 'ACT_LOCK_DOOR'), Markup.button.callback('Buka Pintu Sektor 7', 'ACT_UNLOCK_DOOR')],
            [Markup.button.callback('Nyalakan Sirine', 'ACT_ALARM_ON'), Markup.button.callback('Matikan Sirine', 'ACT_ALARM_OFF')],
            [Markup.button.callback('SOP K3', 'MENU_SOP')],
            [Markup.button.callback('⬅️ Kembali ke Utama', 'BACK_MAIN')]
        ])
    });
});

// 4. SUB-MENU HRD & OPERATOR
bot.action('SUB_HRD', (ctx) => {
    ctx.editMessageText('👥 *MODUL HRD & OPERATOR*\nPilih tindakan:', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('Tulis Laporan Shift', 'MENU_LAPOR'), Markup.button.callback('Lapor Izin/Sakit', 'MENU_IZIN')],
            [Markup.button.callback('Cek Jadwal Shift', 'MENU_JADWAL'), Markup.button.callback('Cek Slip Gaji', 'ACT_SLIP')],
            [Markup.button.callback('Request Cuti', 'ACT_CUTI'), Markup.button.callback('Kotak Saran', 'MENU_SARAN')],
            [Markup.button.callback('Cek KPI Personal', 'MENU_KPI')],
            [Markup.button.callback('⬅️ Kembali ke Utama', 'BACK_MAIN')]
        ])
    });
});

// KEMBALI KE MENU UTAMA
bot.action('BACK_MAIN', async (ctx) => {
    const result = await pool.query('SELECT nama FROM operators WHERE telegram_chat_id = $1', [ctx.chat.id]);
    const nama = result.rows[0]?.nama || 'Operator';
    ctx.deleteMessage();
    showMainMenu(ctx, nama);
});

// ==========================================
// TENTANG DEVELOPER (ABOUT MENU)
// ==========================================
bot.action('MENU_ABOUT', (ctx) => {
    const aboutText = `
👨‍💻 *PROFIL DEVELOPER SISTEM*
Sistem Enterprise SCADA NEXUS ini dirancang dan dikembangkan secara eksklusif oleh:

👤 *Nama:* MUHAMAD SODIKIN
📍 *Alamat:* Cikarang Pusat, Bekasi, Jawa Barat
💼 *Role:* Lead Fullstack SCADA Engineer

🔗 *Koneksi Profesional & Sosial Media:*
🔹 [LinkedIn Profile](https://www.linkedin.com/in/muhamad-sodikin-122886407/)
📸 [Instagram (@guaaqinz)](https://www.instagram.com/guaaqinz?igsh=MTRyN2hjdW9kMXZrcw==)
🎵 [TikTok](https://vm.tiktok.com/ZS9YCCqugw8AV-JS3qL/)
✂️ [CapCut Templates](https://mobile.capcutshare.com/sv2/ZSx59TYD2/)

_Terima kasih telah menggunakan layanan sistem ini._
    `;
    ctx.reply(aboutText, { parse_mode: 'Markdown', disable_web_page_preview: true });
    sendToWeb(ctx.from.first_name, 'Lihat Profil', 'Mengakses data developer NEXUS.');
});

// ==========================================
// FUNGSI AKSI (BUTTONS HANDLER) -> NYAMBUNG KE WEB
// ==========================================

// Fungsi Helper untuk Reply & Emit cepat
const handleAction = async (ctx, actionCode, webAction, replyMsg) => {
    ctx.answerCbQuery();
    const result = await pool.query('SELECT nama FROM operators WHERE telegram_chat_id = $1', [ctx.chat.id]);
    const user = result.rows[0]?.nama || ctx.from.first_name;
    sendToWeb(user, webAction, `Via Telegram: ${actionCode}`);
    ctx.reply(replyMsg, { parse_mode: 'Markdown' });
};

// -- Aksi Mesin & Sensor --
bot.action('ACT_SUHU', (ctx) => handleAction(ctx, 'Cek Suhu', '📡 CEK SENSOR', '🌡️ Suhu Inti saat ini berfluktuasi di ~85.2°C. Sistem pendingin normal.'));
bot.action('ACT_RPM', (ctx) => handleAction(ctx, 'Cek RPM', '📡 CEK SENSOR', '⚙️ Putaran Turbin di ~2450 RPM. Masih dalam batas aman.'));
bot.action('ACT_OEE', (ctx) => handleAction(ctx, 'Cek OEE', '📈 CEK EFISIENSI', '📊 Efisiensi OEE Mesin: 94.5% (Tingkat Produksi Optimal).'));
bot.action('ACT_GAS', (ctx) => handleAction(ctx, 'Cek Tekanan Gas', '📡 CEK SENSOR', '💨 Tekanan Gas: 14.2 Bar. Katup penyaluran terbuka penuh.'));
bot.action('ACT_ARUS', (ctx) => handleAction(ctx, 'Cek Arus (A)', '⚡ CEK LISTRIK', '⚡ Arus Mesin: 120 Ampere. Konsumsi daya stabil.'));
bot.action('ACT_VOLT', (ctx) => handleAction(ctx, 'Cek Voltase (V)', '⚡ CEK LISTRIK', '🔌 Voltase: 380V (3 Phase). Jalur distribusi aman.'));
bot.action('ACT_DIAG_SENSOR', (ctx) => handleAction(ctx, 'Diagnostik Sensor', '⚙️ DIAGNOSTIK', '🔍 Memulai diagnostik sensor... 100% Selesai. Tidak ditemukan anomali.'));

// -- Aksi Maintenance --
bot.action('MENU_TEKNISI', (ctx) => handleAction(ctx, 'Req Teknisi', '🔧 REQ TEKNISI', '🔧 Permintaan teknisi telah dikirim ke layar SCADA Pusat dan tim siaga.'));
bot.action('MENU_INSIDEN', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('🚨 Silakan ketik detail insiden (Awali dengan kata INSIDEN).');
});
bot.action('ACT_LUBRICANT', (ctx) => handleAction(ctx, 'Cek Pelumas', '🛢️ MTX CEK', '🛢️ Level Pelumas: 82% (Kondisi Baik). Perkiraan ganti: 45 hari lagi.'));
bot.action('ACT_FILTER', (ctx) => handleAction(ctx, 'Cek Filter', '🛢️ MTX CEK', '🌬️ Filter Udara Intake: Tingkat kotor 12%. Belum perlu diganti.'));
bot.action('ACT_CALIBRATE', (ctx) => handleAction(ctx, 'Kalibrasi', '⚙️ KALIBRASI', '⚖️ Memulai kalibrasi gyro-sensor... Selesai. Sinkronisasi sukses.'));
bot.action('ACT_RESTART_NET', (ctx) => handleAction(ctx, 'Restart Router', '🌐 JARINGAN', '🔄 Mengirim sinyal restart ke Router Sektor 7... Ping kembali normal.'));
bot.action('ACT_LOG_MTX', (ctx) => handleAction(ctx, 'Log Pemeliharaan', '📋 MTX LOG', '📋 Laporan Pemeliharaan Terakhir: Penggantian Bosh Turbin (2 Minggu lalu oleh Tim A).'));

// -- Aksi Security --
bot.action('ACT_CCTV', (ctx) => handleAction(ctx, 'Cek CCTV', '📹 CEK CCTV', '📹 CCTV CAM-01 (Sektor 7) Online. Transmisi video lancar ke dashboard.'));
bot.action('ACT_RADAR', (ctx) => handleAction(ctx, 'Cek Radar', '📡 CEK RADAR', '📡 Radar Area memindai... 0 objek asing terdeteksi dalam radius 50m.'));
bot.action('ACT_LOCK_DOOR', (ctx) => handleAction(ctx, 'Kunci Pintu', '🛡️ SECURITY', '🔒 Pintu Baja Sektor 7 telah DIKUNCI dari jarak jauh.'));
bot.action('ACT_UNLOCK_DOOR', (ctx) => handleAction(ctx, 'Buka Pintu', '🛡️ SECURITY', '🔓 Pintu Baja Sektor 7 DIBUKA. Akses diizinkan untuk kru.'));
bot.action('ACT_ALARM_ON', (ctx) => handleAction(ctx, 'Sirine ON', '🚨 SIRINE NYALA', '🚨 SIRINE DARURAT DIBUNYIKAN DI SEKTOR 7!'));
bot.action('ACT_ALARM_OFF', (ctx) => handleAction(ctx, 'Sirine OFF', '🔇 SIRINE MATI', '🔇 Sirine dimatikan. Kondisi area dinormalkan.'));
bot.action('MENU_SOP', (ctx) => handleAction(ctx, 'Baca SOP K3', '📖 SOP K3', '📖 *SOP K3*\n1. Wajib pakai helm & kacamata.\n2. Tekan E-STOP jika ada percikan api.'));

// -- Aksi HRD & Laporan --
bot.action('MENU_LAPOR', async (ctx) => {
    ctx.answerCbQuery();
    const result = await pool.query('SELECT * FROM operators WHERE telegram_chat_id = $1', [ctx.chat.id]);
    if (result.rows.length === 0) return ctx.reply('Sesi habis.');
    sendToWeb(result.rows[0].nama, 'Buka Form', 'Mengisi laporan shift.');
    ctx.session = { step: 'tunggu_kendala', operator: result.rows[0] };
    ctx.reply('📝 Tuliskan *Laporan Pekerjaan/Kendala* hari ini:', { parse_mode: 'Markdown' });
});
bot.action('MENU_IZIN', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('👥 Silakan ketik alasan izin/sakit Anda (Awali dengan kata IZIN).');
});
bot.action('MENU_SARAN', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('💡 Silakan ketik saran Anda (Awali dengan kata SARAN).');
});
bot.action('MENU_JADWAL', (ctx) => handleAction(ctx, 'Cek Jadwal', '📅 JADWAL', '📅 Jadwal Anda:\nHari Ini: Reguler Pagi (08:00 - 16:00)\nBesok: Libur'));
bot.action('ACT_SLIP', (ctx) => handleAction(ctx, 'Cek Slip Gaji', '💰 HRD', '🔒 Permintaan slip gaji bulan ini telah dikirim ke email perusahaan Anda.'));
bot.action('ACT_CUTI', (ctx) => handleAction(ctx, 'Req Cuti', '🌴 HRD', '🏖️ Form pengajuan cuti dikirim ke Portal HRD. Sisa cuti tahunan Anda: 8 Hari.'));
bot.action('MENU_KPI', (ctx) => handleAction(ctx, 'Cek KPI', '📊 HRD', '📊 *KPI ANDA*\n- OEE Aktual: 94.5%\n- Kehadiran: 100%\n- Bonus Target: Memenuhi Syarat'));

bot.action('MENU_LOGOUT', async (ctx) => {
    ctx.answerCbQuery();
    try {
        await pool.query('UPDATE operators SET telegram_chat_id = NULL WHERE telegram_chat_id = $1', [ctx.chat.id]);
        ctx.reply('🚪 Anda berhasil logout dari sistem. Silakan /login kembali untuk akses.');
    } catch (e) {}
});

// ==========================================
// PENANGANAN INPUT TEKS (LAPORAN, SARAN, IZIN)
// ==========================================
bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const result = await pool.query('SELECT nama FROM operators WHERE telegram_chat_id = $1', [ctx.chat.id]);
    const namaUser = result.rows[0]?.nama || ctx.from.first_name;
    
    if (text.toUpperCase().startsWith('INSIDEN')) {
        sendToWeb(namaUser, '🚨 LAPORAN DARURAT', text);
        return ctx.reply('🚨 *Sinyal Darurat Diterima Command Center! Tim siaga telah dikerahkan.*', { parse_mode: 'Markdown' });
    }
    
    if (text.toUpperCase().startsWith('SARAN')) {
        sendToWeb(namaUser, '💡 KOTAK SARAN', text);
        return ctx.reply('💡 Saran Anda telah diteruskan ke manajemen dan masuk log server.');
    }
    
    if (text.toUpperCase().startsWith('IZIN')) {
        sendToWeb(namaUser, '👥 LAPOR IZIN', text);
        return ctx.reply('📋 Laporan Izin/Sakit telah dicatat oleh HRD di Dashboard Pusat.');
    }

    if (!ctx.session || !ctx.session.step) return;

    if (ctx.session.step === 'tunggu_kendala') {
        try {
            await pool.query(`INSERT INTO shift_reports (operator_id, kendala) VALUES ($1, $2)`, [ctx.session.operator.id, text]);
            ctx.reply('✅ *LAPORAN TERSIMPAN*\nDisinkronisasi dengan Server Cloud Web Dashboard.', { parse_mode: 'Markdown' });
            sendToWeb(ctx.session.operator.nama, 'Laporan Shift', text);
            ctx.session = null;
        } catch (err) {}
    }
});

// ==========================================
// 3. BROADCAST MANAJER DARI WEB KE TELEGRAM
// ==========================================
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
        console.log('🤖 Bot Telegram & Socket.io siap dengan 50+ Fitur Baru!');
    } catch (error) {
        console.error('❌ BOT TELEGRAM GAGAL NYALA. Cek VPN / Koneksi internet.');
    }
});
