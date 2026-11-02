export const dl = (r) =>
  ({ admin: "Admin", director: "Director", staff: "Staff" })[r] || r;
export const cl = (fn) => ({
  tabIndex: 0,
  role: "button",
  onClick: fn,
  onKeyDown: (e) =>
    (e.key === "Enter" || e.key === " ") && (e.preventDefault(), fn()),
});
export const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");
