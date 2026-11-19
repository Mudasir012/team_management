export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function money(n) {
  return `$${Number(n || 0).toLocaleString()}`;
}

export function daysRemaining(endDate) {
  if (!endDate) return 0;
  const end = new Date(endDate);
  const now = new Date();
  const diff = Math.ceil((end.setHours(0,0,0,0) - now.setHours(0,0,0,0)) / 86400000);
  return diff;
}

export function daysLabel(endDate, status) {
  if (status === "Completed") return "Completed";
  const d = daysRemaining(endDate);
  if (d < 0) return `${Math.abs(d)} Days Overdue`;
  if (d === 0) return "Due Today";
  if (d === 1) return "1 Day Remaining";
  return `${d} Days Remaining`;
}

export function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtLong(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function progressFromTasks(tasks = []) {
  if (!tasks.length) return 0;
  const done = tasks.filter(t => t.status === "done" || t.status === "Done").length;
  return Math.round((done / tasks.length) * 100);
}

export function initials(name = "") {
  return name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
}

export function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
