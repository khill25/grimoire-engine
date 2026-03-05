import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import WorldInfo from "./pages/WorldInfo";
import Characters from "./pages/Characters";
import CharacterEditor from "./pages/CharacterEditor";
import Dialogue from "./pages/Dialogue";
import DialogueEditor from "./pages/DialogueEditor";
import Places from "./pages/Places";
import PlaceEditor from "./pages/PlaceEditor";
import Factions from "./pages/Factions";
import FactionEditor from "./pages/FactionEditor";
import StoryBeats from "./pages/StoryBeats";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<WorldInfo />} />
          <Route path="/characters" element={<Characters />} />
          <Route path="/characters/:id" element={<CharacterEditor />} />
          <Route path="/dialogue" element={<Dialogue />} />
          <Route path="/dialogue/:id" element={<DialogueEditor />} />
          <Route path="/places" element={<Places />} />
          <Route path="/places/:id" element={<PlaceEditor />} />
          <Route path="/factions" element={<Factions />} />
          <Route path="/factions/:id" element={<FactionEditor />} />
          <Route path="/story" element={<StoryBeats />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
