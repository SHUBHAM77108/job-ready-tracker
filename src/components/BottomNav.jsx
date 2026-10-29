import { NavLink } from "react-router-dom";
import { BarChart3, BookOpen, CalendarDays, Home, Menu } from "lucide-react";

const tabs = [
  { to: "/", label: "Overview", icon: Home },
  { to: "/daily", label: "Daily", icon: CalendarDays },
  { to: "/roadmap", label: "Roadmap", icon: BookOpen },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
];
// Phone-only bar (CSS hides it on wide screens). "More" opens the full menu: Projects, Applications, Settings…
export default function BottomNav({ onMore, menuOpen }) {
  return <nav className="bottom-nav" aria-label="Main navigation">
    {tabs.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `bottom-nav-item ${isActive ? "active" : ""}`}><Icon size={20} /><span>{label}</span></NavLink>)}
    <button type="button" className={`bottom-nav-item ${menuOpen ? "active" : ""}`} onClick={onMore} aria-label="More pages"><Menu size={20} /><span>More</span></button>
  </nav>;
}
