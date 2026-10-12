

export const groupDigits = (n: number) => {
  const s = Math.round(Math.abs(n)).toString();
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ' ';
    out += s[i];
  }
  return (n < 0 ? '-' : '') + out;
};
export const formatMoney = (n: number) => `${groupDigits(n)} $`;
export const formatMoneyShort = (n: number) => {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2).replace('.', ',')} Md$`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1).replace('.', ',')} M$`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} k$`;
  return `${Math.round(n)} $`;
};
export const formatClock = (ms: number) => {
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60000);
  const s = Math.floor((t % 60000) / 1000);
  const d = Math.floor((t % 1000) / 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${d}`;
};
export const formatDate = (ts: number) => {
  const d = new Date(ts);
  const p = (x: number) => x.toString().padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
