export const addDays = (dateString, amount) => {
  const d = new Date(`${dateString}T00:00:00`);
  d.setDate(d.getDate() + amount);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
export const formatDate = (dateString) => new Date(`${dateString}T00:00:00`).toLocaleDateString("en-IN", {day:"numeric", month:"short", weekday:"short"});
export const localDateString = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
export const roadmapDayForDate = (startDate, date = new Date()) => {
  const start = new Date(`${startDate}T00:00:00`);
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((today - start) / 86400000) + 1;
};
export const dayDate = (startDate, day) => addDays(startDate, day - 1);
export const pct = (n, total) => total ? Math.round(n / total * 100) : 0;
export const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
