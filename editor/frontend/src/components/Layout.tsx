import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/", label: "World" },
  { to: "/characters", label: "Characters" },
  { to: "/dialogue", label: "Dialogue" },
  { to: "/places", label: "Places" },
  { to: "/factions", label: "Factions" },
  { to: "/story", label: "Story Beats" },
];

export default function Layout() {
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <nav style={{
        width: 200,
        background: "#1a1a2e",
        padding: "1rem 0",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        flexShrink: 0,
      }}>
        <div style={{
          padding: "0 1rem 1rem",
          borderBottom: "1px solid #333",
          marginBottom: "0.5rem",
        }}>
          <h2 style={{ margin: 0, fontSize: "1rem", color: "#e0c097" }}>World Builder</h2>
          <div style={{ fontSize: "0.75rem", color: "#888" }}>Grimoire Engine</div>
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display: "block",
              padding: "0.5rem 1rem",
              color: isActive ? "#e0c097" : "#ccc",
              background: isActive ? "#16213e" : "transparent",
              textDecoration: "none",
              fontSize: "0.9rem",
              borderLeft: isActive ? "3px solid #e0c097" : "3px solid transparent",
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <main style={{ flex: 1, overflow: "auto", background: "#0f0f23", padding: "1.5rem" }}>
        <Outlet />
      </main>
    </div>
  );
}
