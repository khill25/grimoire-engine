import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import WorldInfo from "./pages/WorldInfo";
import StorySettings from "./pages/StorySettings";
import Characters from "./pages/Characters";
import CharacterEditor from "./pages/CharacterEditor";
import Dialogue from "./pages/Dialogue";
import DialogueEditor from "./pages/DialogueEditor";
import DialogueGraph from "./pages/DialogueGraph";
import Places from "./pages/Places";
import PlaceEditor from "./pages/PlaceEditor";
import Scenes from "./pages/Scenes";
import SceneEditor from "./pages/SceneEditor";
import Factions from "./pages/Factions";
import FactionEditor from "./pages/FactionEditor";
import StoryBeats from "./pages/StoryBeats";
import Validate from "./pages/Validate";
import WorldGraph from "./pages/WorldGraph";
import Items from "./pages/Items";
import ItemEditor from "./pages/ItemEditor";
import GameTypes from "./pages/GameTypes";
import ArmorList from "./pages/Armor";
import ArmorEditor from "./pages/ArmorEditor";
import Weapons from "./pages/Weapons";
import WeaponEditor from "./pages/WeaponEditor";
import Mods from "./pages/Mods";
import ModEditor from "./pages/ModEditor";
import LootTables from "./pages/LootTables";
import LootTableEditor from "./pages/LootTableEditor";
import GameConstants from "./pages/GameConstants";
import Spells from "./pages/Spells";
import SpellEditor from "./pages/SpellEditor";
import ProjectSettings from "./pages/ProjectSettings";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<StorySettings />} />
          <Route path="/world" element={<WorldInfo />} />
          <Route path="/world-graph" element={<WorldGraph />} />
          <Route path="/characters" element={<Characters />} />
          <Route path="/characters/:id" element={<CharacterEditor />} />
          <Route path="/dialogue" element={<Dialogue />} />
          <Route path="/dialogue/:id" element={<DialogueEditor />} />
          <Route path="/dialogue/:id/graph" element={<DialogueGraph />} />
          <Route path="/places" element={<Places />} />
          <Route path="/places/:id" element={<PlaceEditor />} />
          <Route path="/scenes" element={<Scenes />} />
          <Route path="/scenes/:id" element={<SceneEditor />} />
          <Route path="/factions" element={<Factions />} />
          <Route path="/factions/:id" element={<FactionEditor />} />
          <Route path="/items" element={<Items />} />
          <Route path="/items/:id" element={<ItemEditor />} />
          <Route path="/armor" element={<ArmorList />} />
          <Route path="/armor/:id" element={<ArmorEditor />} />
          <Route path="/weapons" element={<Weapons />} />
          <Route path="/weapons/:id" element={<WeaponEditor />} />
          <Route path="/mods" element={<Mods />} />
          <Route path="/mods/:id" element={<ModEditor />} />
          <Route path="/spells" element={<Spells />} />
          <Route path="/spells/:id" element={<SpellEditor />} />
          <Route path="/loot-tables" element={<LootTables />} />
          <Route path="/loot-tables/:id" element={<LootTableEditor />} />
          <Route path="/game-constants" element={<GameConstants />} />
          <Route path="/game-types" element={<GameTypes />} />
          <Route path="/story" element={<StoryBeats />} />
          <Route path="/validate" element={<Validate />} />
          <Route path="/project" element={<ProjectSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
