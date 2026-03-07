import { NavLink, Outlet } from "react-router-dom";

const storyNav = [
  { to: "/", label: "Story" },
  { to: "/world", label: "World" },
  { to: "/world-graph", label: "World Graph" },
  { to: "/places", label: "Places" },
  { to: "/scenes", label: "Scenes" },
  { to: "/characters", label: "Characters" },
  { to: "/factions", label: "Factions" },
  { to: "/dialogue", label: "Dialogue" },
  { to: "/story", label: "Story Beats" },
];

const gameNav = [
  { to: "/game-types", label: "Game Types" },
  { to: "/items", label: "Items" },
];

const toolsNav = [
  { to: "/validate", label: "Validate" },
];

function NavSection({ label, items }: { label: string; items: { to: string; label: string }[] }) {
  return (
    <>
      <div style={{ padding: "0.5rem 1rem 0.2rem", color: "#666", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          style={({ isActive }) => ({
            display: "block",
            padding: "0.4rem 1rem",
            color: isActive ? "#e0c097" : "#ccc",
            background: isActive ? "#16213e" : "transparent",
            textDecoration: "none",
            fontSize: "0.85rem",
            borderLeft: isActive ? "3px solid #e0c097" : "3px solid transparent",
          })}
        >
          {item.label}
        </NavLink>
      ))}
    </>
  );
}

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
        <NavSection label="World & Story" items={storyNav} />
        <NavSection label="Game Data" items={gameNav} />
        <NavSection label="Tools" items={toolsNav} />
      </nav>
      <main style={{ flex: 1, overflow: "auto", background: "#0f0f23", padding: "1.5rem" }}>
        <Outlet />
      </main>
    </div>
  );
}
