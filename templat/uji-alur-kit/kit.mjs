// Kit uji jalan alur (Playwright) — dipakai BSA lewat skrip per-aplikasi yang tipis. Lihat README.md dan contoh-uji.mjs.
// Disalin ke handoff/<ID>/uji-alur/ (bukan repo proyek); Playwright dipasang di handoff/<ID>/ (`npm i playwright`), bukan di repo.
// Yang generik ada di sini: peluncuran HP + komputer, login per peran, tangkapan bernomor, penutup penghalang otomatis
// (menu samping HP, dialog sisa), pemilih dari dialog/combobox, isian angka/tanggal, dan pemeriksaan dasar tiap layar
// (periksa.mjs). Yang khas aplikasi (alamat, akun, nama menu, kata terlarang proyek) = parameter.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { periksaLayar, kelompokkanTemuan, tabelTemuan, barisMatriks, AMBANG_SENTUH, tentukanMode, perangkatUntukMode, perluTangkapan, teksCakupan,
  deskripsiSasaran, sasaranDariGalat, teksSasaran, daftarNamaDom, kandidatTerdekat, formatKandidat, barisGalat, langkahMenuHp,
  uraiSaring, cocokSaring, tugasGalat, pilihHasilTerbaru, ringkasLayar, petaMarkdown } from "./periksa.mjs";

/** Bawaan aplikasi monorepo Rudis (app-shell shadcn: sidebar, dialog radix, login `?next=`, token di memori → navigasi lewat SPA). */
export const PRESET_RUDIS = {
  login: { path: "/login", email: "input[type=email],input[name=email]", sandi: "input[type=password]", kirim: "button[type=submit]", next: "next" },
  pergiDengan: "spa",
  responsDiizinkan: [/^GET \/(rbac|auth)\/me 401/], // pemuatan pertama sebelum token ada (token di memori): bukan temuan. Cocok pada jalur setelah apiUrl (isi apiUrl); 401 di jalur lain tetap ditandai, tetapi 401 di /me saat sesi kedaluwarsa di tengah uji ikut diizinkan
  menu: { tautan: "a[data-sidebar=menu-button]", pemicuHp: "button[data-slot=sidebar-trigger]" },
};

const BAWAAN = {
  mode: "cepat", // cepat (bawaan di gerbang akhir: HP saja, tugas inti, tangkapan di langkah kunci) | penuh (hanya bila pengguna meminta); env UJI_MODE menang
  baseUrl: "http://localhost:5173",
  apiUrl: "",
  keluaran: "./hasil",
  akun: {},
  login: { path: "/login", email: "input[type=email],input[name=email]", sandi: "input[type=password]", kirim: "button[type=submit]", next: null },
  pergiDengan: "goto", // goto | spa (history.pushState; untuk aplikasi yang menyimpan token di memori)
  menu: { tautan: "nav a, aside a", pemicuHp: "button[aria-label*=menu i],button[data-slot=sidebar-trigger]" },
  penghalang: [
    "[role=dialog]", "[role=alertdialog]", "[data-sidebar=sidebar][data-mobile=true]", "[data-slot=sheet-content]",
    "[data-slot=sheet-overlay]", "[data-slot=dialog-overlay]", "[data-slot=drawer-content]", "[role=listbox]", "[role=menu]",
  ],
  teksTerlarang: [], // string kata utuh atau { pola: RegExp, alasan, usulTingkat }
  bawaanTerlarang: true,
  polaAngka: undefined, // RegExp nama isian yang dianggap isian angka (papan ketik angka di HP)
  abaikanKonsol: [/favicon/i, /Failed to load resource/i], // 4xx/5xx sudah dicek terpisah lewat respons
  responsDiizinkan: [], // RegExp terhadap "METODE /jalur STATUS", mis. /GET \/auth\/me 401/
  tombolPenjaga: [/^(Tinggalkan|Buang perubahan|Buang|Keluar tanpa menyimpan|Discard|Leave)/i], // dialog "Perubahan belum disimpan"
  tungguHp: 1500, // HP: sasaran yang belum ada di halaman ditunggu sesingkat ini sebelum menu samping dicoba dibuka
  tugasDariAwal: false, // true = tiap s.tugas mulai dari rute awal sesi (selalu berlaku saat UJI_TUGAS=@galat)
  waktuHabis: 8000, // per aksi; login/goto memakai waktuMuat
  waktuMuat: 30000,
  jeda: 250,
  fotoPenuh: true,
  perangkat: { hp: "iPhone 13", komputer: { width: 1440, height: 900 } },
};

const gabung = (a, b) => ({ ...a, ...b, login: { ...a.login, ...b?.login }, menu: { ...a.menu, ...b?.menu }, perangkat: { ...a.perangkat, ...b?.perangkat } });
const slug = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "x";
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const dtk = (ms) => Math.round(ms / 100) / 10;

/* ---- dijalankan DI DALAM browser (self-contained: tak boleh merujuk apa pun di luar) ---- */
function ambilDom() {
  const vw = window.innerWidth;
  const tampak = (e) => {
    const r = e.getBoundingClientRect(), st = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none" && r.right > 0 && r.left < vw;
  };
  const teksEl = (e) => (e.innerText || e.getAttribute("aria-label") || e.getAttribute("title") || e.value || "").trim().replace(/\s+/g, " ").slice(0, 40);
  const tombol = [...document.querySelectorAll("button,a[href],[role=button],[role=menuitem],[role=tab],summary,input[type=submit]")]
    .filter(tampak).map((e) => {
      const r = e.getBoundingClientRect(), st = getComputedStyle(e);
      const sebaris = e.tagName === "A" && st.display === "inline" && !!e.parentElement && e.parentElement.innerText.trim().length > e.innerText.trim().length + 10;
      return { tag: e.tagName.toLowerCase(), t: teksEl(e), w: Math.round(r.width), h: Math.round(r.height), sebaris };
    });
  const inputs = [...document.querySelectorAll("input,select,textarea")].filter((e) => e.type !== "hidden" && tampak(e)).map((e) => {
    const lab = e.labels && e.labels.length ? [...e.labels].map((l) => l.innerText).join(" ") : (e.closest("label") ? e.closest("label").innerText : "");
    const lby = (e.getAttribute("aria-labelledby") || "").split(/\s+/).map((id) => document.getElementById(id)?.innerText || "").join(" ").trim();
    return { tag: e.tagName.toLowerCase(), type: e.type || "", name: e.name || "", id: e.id || "", im: e.getAttribute("inputmode"), val: e.value,
      ph: e.placeholder || "", label: (lab || lby).trim().replace(/\s+/g, " ").slice(0, 60), aria: (e.getAttribute("aria-label") || "").trim() };
  });
  const lebar = [...document.body.querySelectorAll("*")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1 && getComputedStyle(e).position !== "fixed"; })
    .slice(0, 5).map((e) => ({ tag: e.tagName.toLowerCase(), t: teksEl(e).slice(0, 30), w: Math.round(e.getBoundingClientRect().width) }));
  const judul = [...document.querySelectorAll("h1,h2,h3,[role=heading]")].filter(tampak).map(teksEl).filter(Boolean).slice(0, 10);
  return {
    url: location.pathname + location.search, scrollW: document.documentElement.scrollWidth, innerW: vw, tombol, inputs, pelanggarLebar: lebar, judul,
    teks: document.body.innerText.slice(0, 30000),
    nilaiIsian: inputs.filter((i) => !["password", "checkbox", "radio", "file", "hidden"].includes(i.type) && i.val).map((i) => i.val),
    placeholders: inputs.map((i) => i.ph).filter(Boolean),
  };
}
function tesTerhalang(el) {
  const r = el.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
  if (r.right <= 0 || r.left >= vw) return "luar-layar";
  const x = Math.min(vw - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(vh - 1, Math.max(0, r.top + r.height / 2));
  if (r.bottom < 0 || r.top > vh) return null; // di luar viewport vertikal: biarkan scroll Playwright
  const atas = document.elementFromPoint(x, y);
  return atas && !(el.contains(atas) || atas.contains(el)) ? "tertutup" : null;
}
function adaPenghalang(selektor) {
  const vw = window.innerWidth;
  return [...document.querySelectorAll(selektor.join(","))].some((e) => {
    const r = e.getBoundingClientRect(), st = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none" && r.right > 0 && r.left < vw && e.getAttribute("data-state") !== "closed";
  });
}

function ambilMenu(selektor) {
  const vw = window.innerWidth;
  const tampak = (e) => { const r = e.getBoundingClientRect(), st = getComputedStyle(e); return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none" && r.right > 0 && r.left < vw; };
  return [...new Set([...document.querySelectorAll(selektor)].filter(tampak).map((e) => String(e.textContent ?? "").replace(/\s+/g, " ").trim()).filter(Boolean))];
}
function diNavigasi(e, selTautan) {
  return !!(e.closest("nav,aside,[role=navigation],[data-sidebar]") || (selTautan && e.matches(selTautan)));
}

async function muatPlaywright() {
  try { return await import("playwright"); } catch { /* lanjut: cari dari folder kerja */ }
  try { const m = await import(pathToFileURL(createRequire(path.join(process.cwd(), "x.js")).resolve("playwright")).href); return m.default ?? m; } catch { /* ke galat */ }
  throw new Error("Playwright belum terpasang. Di folder handoff/<ID>/ jalankan: npm i playwright && npx playwright install chromium (jangan di repo proyek).");
}

class Sesi {
  constructor(uji, peran, perangkat, page) {
    Object.assign(this, { uji, peran, perangkat, page, hp: perangkat === "hp", _konsol: [], _respons: [], _tertunda: [], kasusGagal: 0 });
    page.setDefaultTimeout(uji.opsi.waktuHabis);
    page.on("console", (m) => { if (m.type() === "error") this._konsol.push(`${m.text()} @${page.url()}`.slice(0, 300)); });
    page.on("pageerror", (e) => this._konsol.push(`pageerror: ${String(e)}`.slice(0, 300)));
    page.on("requestfailed", (r) => { const g = r.failure()?.errorText ?? ""; if (!/ABORTED/.test(g)) this._konsol.push(`gagal jaringan ${r.method()} ${r.url()} ${g}`.slice(0, 300)); });
    page.on("response", (r) => {
      if (r.status() < 400) return;
      const base = uji.opsi.apiUrl || uji.opsi.baseUrl;
      const url = r.url();
      if (!url.startsWith(uji.opsi.baseUrl) && !url.startsWith(base)) return; // pihak ketiga diabaikan
      const e = { status: r.status(), metode: r.request().method(), jalur: url.replace(base, "").replace(uji.opsi.baseUrl, ""), isi: "" };
      this._respons.push(e);
      r.text().then((t) => { e.isi = t.slice(0, 300); }).catch(() => {});
    });
  }

  lokasi(t) {
    this._sasaranTerakhir = t; // untuk pesan galat (kandidat nama terdekat) bila Playwright tidak menyebut sasarannya
    if (typeof t === "string") return this.page.locator(t);
    if (t instanceof RegExp) return this.page.getByRole("button", { name: t }).or(this.page.getByRole("combobox", { name: t })).or(this.page.getByRole("link", { name: t })).or(this.page.getByText(t));
    if (t && t.role) return this.page.getByRole(t.role, { name: t.name, exact: t.exact });
    return t; // Locator
  }
  async tenang() {
    await this.page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
    await this.page.waitForTimeout(this.uji.opsi.jeda);
  }
  teks() { return this.page.locator("body").innerText(); }
  catatTemuan(t) { this._tertunda.push({ butir: "—", usulTingkat: "sedang", ...t }); }

  async masuk(next = "/") {
    const { login, baseUrl, akun } = this.uji.opsi;
    const a = akun[this.peran];
    if (!a) throw new Error(`akun untuk peran '${this.peran}' tidak ada di opsi.akun`);
    await this.page.goto(baseUrl + login.path + (login.next ? `?${login.next}=${encodeURIComponent(next)}` : ""), { timeout: this.uji.opsi.waktuMuat });
    await this.page.fill(login.email, a.email);
    await this.page.fill(login.sandi, a.sandi);
    await this.page.click(login.kirim);
    await this.page.waitForURL((u) => !u.pathname.startsWith(login.path), { timeout: this.uji.opsi.waktuMuat }).catch(() => { throw new Error(`login '${this.peran}' tidak meninggalkan ${login.path} (akun/sandi salah?)`); });
    await this.tenang();
  }
  /** Buka alamat. `tunggu` (selektor/RegExp, opsional) = tanda halaman sudah termuat (rute lazy): ditunggu sampai tampak. */
  async pergi(alamat, { tunggu } = {}) {
    if (this.uji.opsi.pergiDengan === "spa") {
      await this.page.evaluate((x) => { history.pushState({}, "", x); dispatchEvent(new PopStateEvent("popstate")); }, alamat);
    } else await this.page.goto(alamat.startsWith("http") ? alamat : this.uji.opsi.baseUrl + alamat, { timeout: this.uji.opsi.waktuMuat });
    await this.tenang();
    if (tunggu) await this.lokasi(tunggu).first().waitFor({ state: "visible" }).catch(() => {});
    else await this.page.waitForFunction(() => document.body.innerText.trim().length > 0, null, { timeout: 5000 }).catch(() => {});
  }
  /** Dialog penjaga "Perubahan belum disimpan": ketuk tombol meninggalkan. true bila ada yang diketuk. */
  async lepasPenjaga() {
    const dlg = this.page.locator("[role=dialog],[role=alertdialog]").filter({ hasText: /belum disimpan|tidak disimpan|unsaved|tinggalkan/i }).last();
    if (!(await dlg.isVisible().catch(() => false))) return false;
    for (const pola of this.uji.opsi.tombolPenjaga) {
      const b = dlg.getByRole("button", { name: pola }).first();
      if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await this.page.waitForTimeout(400); return true; }
    }
    return false;
  }
  /** Pesan yang tampak sekarang: toast, galat inline, peringatan (role alert/status), isi dialog. Panggil tepat setelah aksi (toast cepat hilang); snap juga menyimpannya. */
  async pesan() {
    return this.page.evaluate(() => {
      const tampak = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; };
      const sel = "[role=alert],[role=status],[aria-live],[data-sonner-toast],[data-slot=toast],[role=dialog],[role=alertdialog],[id$=-error],[id$=-message],[data-slot=form-message],.text-destructive";
      return [...new Set([...document.querySelectorAll(sel)].filter(tampak).map((e) => String(e.innerText ?? e.textContent ?? "").trim().replace(/\s+/g, " ")).filter(Boolean))].map((t) => t.slice(0, 300)).slice(0, 8);
    });
  }

  async adaPenghalang() { return this.page.evaluate(adaPenghalang, this.uji.opsi.penghalang); }
  /** Tutup menu samping HP / dialog / daftar pilihan yang tersisa. true bila bersih sesudahnya. */
  async tutupPenghalang() {
    for (let i = 0; i < 3; i++) {
      if (!(await this.adaPenghalang())) return true;
      if (await this.lepasPenjaga()) continue;
      await this.page.keyboard.press("Escape");
      if (await this.lepasPenjaga()) continue;
      await this.page.waitForTimeout(350);
      if (!(await this.adaPenghalang())) return true;
      const tutup = this.page.locator('[role=dialog] button[aria-label*="tutup" i],[role=dialog] button[aria-label*="close" i],[data-slot=sheet-close],[data-slot=dialog-close]').last();
      if (await tutup.isVisible().catch(() => false)) await tutup.click().catch(() => {});
      else { const v = this.page.viewportSize(); await this.page.mouse.click(v.width - 4, v.height - 4).catch(() => {}); }
      await this.page.waitForTimeout(350);
    }
    return !(await this.adaPenghalang());
  }
  async bukaMenuHp() {
    const p = this.page.locator(this.uji.opsi.menu.pemicuHp).first();
    if (await p.isVisible().catch(() => false)) { await p.click(); await this.page.waitForTimeout(700); }
  }
  /** Sasaran (Locator .first()) sudah ada di DOM? Bila ya: di dalam navigasi (nav/aside/sidebar/tautan menu)? */
  async infoSasaran(l) {
    if (!(await l.count().catch(() => 0))) return { terpasang: false, diNavigasi: false };
    return { terpasang: true, diNavigasi: await l.evaluate(diNavigasi, this.uji.opsi.menu.tautan).catch(() => false) };
  }
  /** HP, sasaran belum tampak: buka menu samping hanya bila sasaran memang tautan menu/navigasi (keputusan: periksa.mjs › langkahMenuHp).
   *  Sasaran yang hanya belum selesai muncul ditunggu singkat (`tungguHp`) dan tidak membuka menu. */
  async siapkanSasaranHp(l, { menu = false } = {}) {
    let sudahTunggu = false;
    for (let i = 0; i < 3; i++) {
      const tampak = await l.isVisible().catch(() => false);
      const k = langkahMenuHp({ hp: true, tampak, dariMenu: menu, ...(tampak ? {} : await this.infoSasaran(l)), sudahTunggu });
      if (k === "tunggu") { await l.waitFor({ state: "visible", timeout: this.uji.opsi.tungguHp }).catch(() => {}); sudahTunggu = true; continue; }
      if (k === "buka-menu") {
        await this.bukaMenuHp();
        // dugaan "ada di menu samping" salah (sasaran tetap tak muncul): tutup lagi agar halaman, galat, dan tangkapan tidak tertutup menu
        if (!menu && !(await l.waitFor({ state: "visible", timeout: 1500 }).then(() => true, () => false))) await this.tutupPenghalang();
      }
      return;
    }
  }

  /** Klik yang menutup penghalang lebih dulu bila sasaran tertutup/di luar layar (HP: membuka menu samping bila sasaran tautan menu/navigasi).
   *  `menu: true` = sasaran pasti tautan menu samping (dipakai `menu()`). */
  async klik(target, { tunggu = true, menu = false } = {}) {
    const l = this.lokasi(target).first();
    if (this.hp) await this.siapkanSasaranHp(l, { menu });
    await l.waitFor({ state: "visible" });
    for (let i = 0; i < 3; i++) {
      await l.scrollIntoViewIfNeeded().catch(() => {});
      const sebab = await l.evaluate(tesTerhalang);
      if (!sebab) break;
      if (sebab === "luar-layar" && this.hp && (menu || (await this.infoSasaran(l)).diNavigasi)) await this.bukaMenuHp(); else await this.tutupPenghalang();
    }
    await l.click();
    await this.lepasPenjaga(); // klik yang memicu "Perubahan belum disimpan": tinggalkan (kasus uji yang memeriksanya memakai page langsung)
    if (tunggu) await this.tenang();
  }
  /** Ketuk tautan menu samping (HP: membuka menu bila perlu; mencatat temuan bila menu tetap terbuka menutupi halaman). */
  async menu(nama) {
    const tautan = this.page.locator(this.uji.opsi.menu.tautan).filter({ hasText: new RegExp(`^\\s*${esc(nama)}\\s*$`) }).first();
    await this.klik(tautan, { tunggu: false, menu: true });
    await this.tenang();
    if (this.hp) await this.page.waitForTimeout(700); // animasi tutup lembar samping
    if (this.hp && (await this.adaPenghalang())) {
      this.catatTemuan({ jenis: "menu-hp-tetap-terbuka", butir: "5b", usulTingkat: "sedang", ringkas: "menu samping HP tetap terbuka dan menutupi halaman setelah menu diketuk", rincian: `menu '${nama}'` });
      await this.tutupPenghalang();
    }
  }
  async isi(target, nilai) {
    const l = this.lokasi(target).first();
    await l.fill(String(nilai));
    await l.blur();
    await this.page.waitForTimeout(150);
    return l.inputValue().catch(() => null);
  }
  /** Isi lalu kehilangan fokus; mengembalikan nilai yang TAMPIL sesudahnya (mis. "999,0000" — periksa dengan snap berikutnya). */
  isiAngka(target, nilai) { return this.isi(target, nilai); }
  async isiTanggal(target, iso, { format } = {}) {
    const l = this.lokasi(target).first();
    const tipe = await l.getAttribute("type");
    const [y, m, d] = iso.split("-");
    const nilai = tipe === "date" ? iso : (format ?? "dd/mm/yyyy").replace("yyyy", y).replace("mm", m).replace("dd", d);
    return this.isi(l, nilai);
  }
  /** Pilih opsi dari <select> asli, dialog pencarian, atau combobox: klik pemicu → (isi pencarian) → klik opsi. */
  async pilihOpsi({ pemicu, cari, opsi }) {
    const l = this.lokasi(pemicu).first();
    if ((await l.evaluate((e) => e.tagName).catch(() => "")) === "SELECT") { const kena = (await l.locator("option").evaluateAll((os) => os.map((o) => o.textContent.trim()))).find((t) => (opsi instanceof RegExp ? opsi.test(t) : new RegExp(esc(String(opsi ?? cari)), "i").test(t))); if (kena === undefined) throw new Error(`opsi tidak ditemukan di <select>: ${opsi ?? cari}`); await l.selectOption({ label: kena }); return; }
    await this.klik(l);
    await this.page.waitForTimeout(300);
    const kotakCari = this.page.locator('input[role=combobox],input[placeholder*="cari" i],input[placeholder*="search" i],[cmdk-input],input[type=search]').last();
    if (cari && (await kotakCari.isVisible().catch(() => false))) { await kotakCari.fill(cari); await this.page.waitForTimeout(700); }
    const re = opsi instanceof RegExp ? opsi : new RegExp(esc(opsi ?? cari), "i");
    const kandidat = [this.page.getByRole("option", { name: re }), this.page.getByRole("menuitem", { name: re }), this.page.getByText(re)];
    for (const k of kandidat) if (await k.first().isVisible().catch(() => false)) { await k.first().click(); break; }
    await this.tenang();
  }

  /**
   * Jalankan satu tugas alur (fungsi `fn(s)`) dengan penangkap galat. Bila env UJI_TUGAS="masuk,keluar" diisi, hanya tugas yang namanya
   * memuat salah satu kata itu yang dijalankan — uji ulang sebatas butir yang berubah tanpa mengulang semuanya. `UJI_TUGAS=@galat` =
   * hanya tugas yang galat di hasil.json sebelumnya (nama persis). Saat `@galat` (atau opsi `tugasDariAwal`), tiap tugas mulai dari
   * rute awal sesi agar galat/keadaan tugas lain tidak merembet.
   */
  async tugas(nama, fn) {
    if (this.uji.saring && !cocokSaring(nama, this.uji.saring)) return undefined;
    // rute awal tetap: @galat atau opsi tugasDariAwal (UJI_TUGAS=<kata> biasa tetap seperti dulu)
    const dariAwal = !!(this.uji.saring?.galat || this.uji.opsi.tugasDariAwal);
    this._tugasAktif = nama;
    try {
      return await this.coba(nama, async (s) => { if (dariAwal) await s.keAwal(); return fn(s); });
    } finally { this._tugasAktif = null; }
  }
  /** Kembali ke rute awal sesi (`uji.sesi(…, { awal })`): tutup penghalang, lalu pergi bila belum di sana. */
  async keAwal() {
    const { baseUrl, waktuMuat } = this.uji.opsi;
    // belum di aplikasi (sesi `masuk: false` masih about:blank): pushState SPA tak bisa → muat rute awal penuh
    if (!this.page.url().startsWith(baseUrl)) { await this.page.goto(baseUrl + this.awal, { timeout: waktuMuat }); await this.tenang(); return; }
    await this.tutupPenghalang();
    const u = new URL(this.page.url());
    if (u.pathname + u.search !== this.awal) await this.pergi(this.awal);
  }
  /** URL + sasaran + ±5 nama tampak terdekat untuk galat "sasaran tidak ditemukan" (bukan galat lain, mis. pemeriksaan skrip). */
  async diagnosaGalat(e) {
    const pesan = String(e?.message ?? e);
    let url = this.page.url();
    try { const u = new URL(url); url = u.pathname + u.search; } catch { /* biarkan apa adanya */ }
    // cadangan: sasaran aksi kit terakhir di langkah ini — bukan untuk galat navigasi (goto/waitForURL), yang tak punya sasaran
    const cadangan = /Timeout|tidak ditemukan|not found|strict mode/i.test(pesan) && !/navigat|goto|waitForURL|waitForLoadState/i.test(pesan);
    const sasaran = sasaranDariGalat(pesan) ?? (cadangan ? deskripsiSasaran(this._sasaranTerakhir) : null);
    if (!sasaran) return { url };
    const dom = await this.page.evaluate(ambilDom).catch(() => null);
    const kandidat = dom ? kandidatTerdekat(teksSasaran(sasaran), daftarNamaDom(dom), 5).map(formatKandidat) : [];
    return { url, sasaran: sasaran.slice(0, 160), kandidat };
  }
  /** Jalankan langkah yang mungkin gagal tanpa menghentikan seluruh uji: galat dicatat sebagai langkah GALAT + tangkapan.
   *  Galat sasaran (selektor salah/belum muncul) mencetak URL + ±5 nama tampak terdekat ke stdout dan hasil.json › galat. */
  async coba(nama, fn) {
    this._sasaranTerakhir = null; // sasaran dari langkah/tugas lain tidak boleh muncul di diagnosa galat langkah ini
    try { return await fn(this); } catch (e) {
      const pesan = String(e.message).split("\n")[0].slice(0, 200);
      const g = { nama, tugas: this._tugasAktif ?? nama, peran: this.peran, perangkat: this.perangkat, pesan, ...(await this.diagnosaGalat(e).catch(() => ({}))) };
      this.uji.galat.push(g);
      console.log(`GALAT ${barisGalat(g)}`);
      await this.snap(`GALAT-${nama}`, { galat: pesan }).catch(() => {});
      await this.tutupPenghalang().catch(() => {});
      return undefined;
    }
  }
  /** Nama tautan menu yang tampak (HP: menu samping dibuka lalu ditutup lagi). Dipakai `uji.peta()`. */
  async namaMenu() {
    if (this.hp) await this.bukaMenuHp();
    const nama = await this.page.evaluate(ambilMenu, this.uji.opsi.menu.tautan).catch(() => []);
    if (this.hp) await this.tutupPenghalang();
    return nama;
  }

  /** Tangkapan bernomor + pemeriksaan dasar. `gagal: true` = kasus gagal sengaja dipicu (respons 4xx dianggap diharapkan; 5xx tetap temuan).
   *  `kunci: true` = langkah kunci (layar awal, terisi, hasil berhasil): di mode cepat hanya langkah kunci, kasus gagal, dan galat yang dipotret; pemeriksaan tetap jalan di setiap snap. */
  async snap(nama, extra = {}) {
    const o = this.uji.opsi, t0 = Date.now();
    await this.tenang();
    const no = ++this.uji.no;
    const berkas = `${String(no).padStart(3, "0")}-${this.perangkat}-${this.peran}-${slug(nama)}.png`;
    const foto = o.fotoPenuh !== null && perluTangkapan(this.uji.mode, { kunci: extra.kunci, gagal: extra.gagal, galat: !!extra.galat });
    if (foto) await this.page.screenshot({ path: path.join(this.uji.dirFoto, berkas), fullPage: o.fotoPenuh }).catch(() => {});
    const pesan = await this.pesan().catch(() => []); // paling awal: toast cepat hilang
    const dom = await this.page.evaluate(ambilDom);
    const konsol = this._konsol.splice(0), respons = this._respons.splice(0);
    const diharapkan = extra.gagal ? respons.filter((r) => r.status >= 400 && r.status < 500) : [];
    if (extra.gagal) this.kasusGagal++;
    const temuan = [...this._tertunda.splice(0), ...periksaLayar(dom, {
      sentuh: this.hp, min: AMBANG_SENTUH, teksTerlarang: o.teksTerlarang, bawaanTerlarang: o.bawaanTerlarang, polaNama: o.polaAngka,
      konsol, abaikanKonsol: o.abaikanKonsol, respons: respons.filter((r) => !diharapkan.includes(r)), responsDiizinkan: o.responsDiizinkan,
    })];
    const l = { no, nama, peran: this.peran, perangkat: this.perangkat, url: dom.url, foto: foto ? berkas : null, geser: dom.scrollW > dom.innerW + 1,
      gagal: !!extra.gagal, responsDiharapkan: diharapkan.map((r) => `${r.metode} ${r.jalur} → ${r.status}${r.isi ? " " + r.isi.slice(0, 120) : ""}`),
      pesan, teks: dom.teks.replace(/\s*\n+\s*/g, " | ").slice(0, 1500), nilaiIsian: dom.nilaiIsian.slice(0, 12), temuan, ...(extra.galat ? { galat: extra.galat } : {}), ms: Date.now() - t0 };
    this.uji.langkah.push(l);
    console.log(`#${String(no).padStart(3, "0")} ${this.perangkat}/${this.peran} ${nama}${temuan.length ? `  ⚠ ${temuan.map((x) => x.jenis).join(",")}` : ""}`);
    return l;
  }
}

class Uji {
  constructor(opsi) {
    const saring = uraiSaring(process.env.UJI_TUGAS);
    this.mode = tentukanMode(opsi.mode, process.env.UJI_MODE);
    Object.assign(this, { opsi, saring: saring.aktif ? saring : null, no: 0, langkah: [], tugas: [], fakta: {}, galat: [], sesiAktif: [], mulai: Date.now() });
    const dasar = opsi.keluaran.replace(/[\\/]+$/, "");
    // uji ulang parsial (UJI_TUGAS) tidak boleh menimpa hasil/tangkapan eksekusi penuh: keluaran sendiri
    if (this.saring) opsi.keluaran = `${dasar}-ulang-${saring.token.join("-").replace(/[^a-z0-9-]+/g, "").slice(0, 30)}`;
    if (saring.galat) this.muatTugasGalat([dasar, opsi.keluaran]);
    this.dirFoto = path.resolve(opsi.keluaran, "tangkapan");
    fs.mkdirSync(this.dirFoto, { recursive: true });
  }
  /** UJI_TUGAS=@galat: tugas galat dari hasil.json terbaru di antara eksekusi penuh dan uji ulang @galat sebelumnya. */
  muatTugasGalat(folder) {
    const kandidat = folder.map((d) => path.resolve(d, "hasil.json")).filter((f) => fs.existsSync(f)).map((berkas) => ({ berkas, mtimeMs: fs.statSync(berkas).mtimeMs }));
    const berkas = pilihHasilTerbaru(kandidat);
    if (!berkas) throw new Error(`UJI_TUGAS=@galat: belum ada hasil.json di ${path.resolve(folder[0])} — jalankan eksekusi biasa dulu (node uji.mjs)`);
    const nama = tugasGalat(JSON.parse(fs.readFileSync(berkas, "utf8")));
    this.saring.persis = new Set(nama);
    this.saring.sumberGalat = berkas;
    console.log(`UJI_TUGAS=@galat: ${nama.length ? nama.join(", ") : "tidak ada tugas galat"} (dari ${berkas})`);
  }
  /** Perangkat yang diuji menurut mode: cepat = ["hp"], penuh = ["hp", "komputer"]. Pakai di perulangan skrip: `for (const p of uji.perangkatUji)`. */
  get perangkatUji() { return perangkatUntukMode(this.mode, Object.keys(this.opsi.perangkat)); }
  /** Nyatakan cakupan jujur (masuk ringkasan.md + hasil.json): tugasUji = yang dijalankan, tugasSemua = semua tugas di alur-tugas.md. */
  cakupan({ tugasUji = [], tugasSemua = [] } = {}) { this.cakupanDinyatakan = { tugasUji, tugasSemua }; }
  /** Cakupan efektif: uji ulang parsial (UJI_TUGAS) hanya menjalankan tugas yang namanya memuat kata penyaring — sisanya dilaporkan belum terverifikasi. */
  cakupanEfektif() {
    const c = this.cakupanDinyatakan ?? {};
    if (!this.saring || !c.tugasUji) return c;
    // @galat: tugas "x" tercakup bila x sendiri atau sub-tugasnya ("x-gagal") galat dan diulang
    const persis = [...(this.saring.persis ?? [])];
    const kena = (n) => { const x = String(n).toLowerCase(); return cocokSaring(n, this.saring) || persis.some((p) => p.startsWith(`${x}-`)); };
    const parsial = process.env.UJI_TUGAS + (this.saring.galat ? ` → ${persis.join(", ") || "tidak ada tugas galat"}` : "");
    return { ...c, tugasUji: c.tugasUji.filter(kena), parsial };
  }
  /** Sesi baru (konteks browser sendiri) untuk satu peran di satu perangkat, sudah masuk bila `masuk` ≠ false. */
  async sesi(peran, perangkat, { masuk = true, awal = "/" } = {}) {
    const cfg = this.opsi.perangkat[perangkat];
    if (!cfg) throw new Error(`perangkat '${perangkat}' tidak dikenal (hp | komputer)`);
    const ctx = await this.browser.newContext(typeof cfg === "string" ? { ...this.devices[cfg] } : { viewport: cfg });
    const s = new Sesi(this, peran, perangkat, await ctx.newPage());
    s.awal = awal;
    this.sesiAktif.push(s);
    if (masuk) await s.masuk(awal);
    return s;
  }
  /** Hasil satu tugas untuk matriks: status LULUS | SELESAI-MENYIMPANG | GAGAL | BELUM TERVERIFIKASI. */
  hasilTugas({ peran, tugas, perangkat, status = "DINILAI-BSA", catatan = "", foto = "", kasusGagal = "", layarKosong = "" }) {
    this.tugas.push({ peran, tugas, perangkat, status, catatan, foto, kasusGagal, layarKosong });
  }
  catatFakta(kunci, nilai) { this.fakta[kunci] = nilai; }

  /**
   * Peta layar SEBELUM menulis tugas: login per peran, buka tiap menu, tulis `<keluaran>/peta.md` (+ peta.json) berisi nama tampil
   * judul, tombol, tautan, dan isian (label + id/name/type) per layar. Skrip ditulis dari nama di peta, bukan ditebak dari kode.
   * Hanya membuka menu — tombol tidak diketuk (bisa mengubah data). Opsi: peran (bawaan semua akun), perangkat (bawaan perangkat
   * pertama mode ini: cepat = HP), awal (rute setelah login), menuMaks.
   */
  async peta({ peran, perangkat, awal = "/", menuMaks = 40 } = {}) {
    const dev = perangkat ?? this.perangkatUji[0];
    const peta = { baseUrl: this.opsi.baseUrl, perangkat: dev, dibuat: new Date().toISOString(), peran: [] };
    const pesan = (e) => String(e?.message ?? e).split("\n")[0].slice(0, 200);
    for (const p of peran ?? Object.keys(this.opsi.akun)) {
      const catatan = { peran: p, awal, menu: [], layar: [] };
      peta.peran.push(catatan);
      let s;
      try { s = await this.sesi(p, dev, { awal }); } catch (e) { catatan.galat = pesan(e); continue; }
      try {
        catatan.menu = await s.namaMenu();
        catatan.layar.push({ menu: "(layar awal setelah masuk)", ...ringkasLayar(await s.page.evaluate(ambilDom), { abaikanTautan: catatan.menu }) });
        for (const nama of catatan.menu.slice(0, menuMaks)) {
          try {
            await s.menu(nama);
            catatan.layar.push({ menu: nama, ...ringkasLayar(await s.page.evaluate(ambilDom), { abaikanTautan: catatan.menu }) });
          } catch (e) { catatan.layar.push({ menu: nama, galat: pesan(e) }); await s.tutupPenghalang().catch(() => {}); }
        }
      } finally {
        await s.page.context().close().catch(() => {});
        this.sesiAktif = this.sesiAktif.filter((x) => x !== s); // sesi peta bukan bagian uji (kasus gagal, temuan)
      }
    }
    const dir = path.resolve(this.opsi.keluaran);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "peta.json"), JSON.stringify(peta, null, 1));
    fs.writeFileSync(path.join(dir, "peta.md"), petaMarkdown(peta));
    console.log(`peta: ${path.join(dir, "peta.md")} (${peta.peran.length} peran, ${peta.peran.reduce((n, x) => n + x.layar.length, 0)} layar)`);
    return peta;
  }
  /** Tutup browser tanpa menulis hasil (mis. sesudah `peta()`). `selesai()` sudah menutupnya. */
  async tutup() { await this.browser?.close().catch(() => {}); }

  /** Tulis hasil.json + ringkasan.md di folder keluaran, tutup browser. */
  async selesai() {
    const selesai = Date.now();
    const kelompok = kelompokkanTemuan(this.langkah);
    const cakupan = teksCakupan({ mode: this.mode, ...this.cakupanEfektif(), perangkat: this.perangkatUji });
    const meta = { mode: this.mode, cakupan: cakupan.pernyataan, belumTerverifikasi: cakupan.belum, mulai: new Date(this.mulai).toISOString(), selesai: new Date(selesai).toISOString(), durasiDetik: dtk(selesai - this.mulai), baseUrl: this.opsi.baseUrl,
      langkah: this.langkah.length, galatLangkah: this.galat.length, kasusGagal: this.sesiAktif.reduce((n, s) => n + s.kasusGagal, 0) };
    fs.writeFileSync(path.resolve(this.opsi.keluaran, "hasil.json"), JSON.stringify({ meta, tugas: this.tugas, fakta: this.fakta, galat: this.galat, kelompok, langkah: this.langkah }, null, 1));
    const perJenis = {}; for (const g of kelompok) perJenis[g.jenis] = (perJenis[g.jenis] ?? 0) + 1;
    const md = [`# Ringkasan uji otomatis (kit) — mode ${this.mode.toUpperCase()}`, "", `**Cakupan — ${cakupan.pernyataan}**`, "", `Mulai ${meta.mulai} · selesai ${meta.selesai} · ${meta.durasiDetik} dtk eksekusi kit · ${meta.langkah} tangkapan · ${meta.galatLangkah} langkah galat`, "",
      "## Matriks (isi dari hasilTugas)", this.tugas.length ? barisMatriks(this.tugas) : "(belum ada hasilTugas)", "",
      "## Calon temuan (usul kit; BSA menentukan tingkat, kode sumber, usulan)", kelompok.length ? tabelTemuan(kelompok) : "(tidak ada temuan otomatis)", "",
      "## Langkah galat (skrip gagal, bukan temuan aplikasi)", this.galat.length ? this.galat.map((g) => `- ${barisGalat(g)}`).join("\n") : "(tidak ada)", "",
      "## Belum terverifikasi (di luar cakupan mode ini — salin ke templat)", cakupan.belum.length ? cakupan.belum.map((b) => `- ${b}`).join("\n") : "(tidak ada)", ""].join("\n");
    fs.writeFileSync(path.resolve(this.opsi.keluaran, "ringkasan.md"), md);
    await this.tutup();
    console.log(JSON.stringify({ ...meta, temuanPerJenis: perJenis }));
    return { meta, kelompok };
  }
}

/** Mulai uji: luncurkan Chromium. Opsi: lihat BAWAAN di atas dan README.md. */
export async function mulaiUji(pilihan = {}) {
  const opsi = gabung(BAWAAN, pilihan);
  const { chromium, devices } = await muatPlaywright();
  const uji = new Uji(opsi);
  uji.devices = devices;
  uji.browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--disable-gpu"] });
  return uji;
}
export { periksaLayar, kelompokkanTemuan, tabelTemuan, barisMatriks } from "./periksa.mjs";
export { Uji, Sesi }; // untuk tes (bin/uji-alur-kit.test.mjs) — skrip uji memakai mulaiUji
