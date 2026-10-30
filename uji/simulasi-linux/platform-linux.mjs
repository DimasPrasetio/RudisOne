// Dimuat lewat NODE_OPTIONS=--import oleh jalankan.sh: setiap proses node (termasuk anak dari tes) melihat Linux.
Object.defineProperty(process, "platform", { value: "linux", configurable: true });
