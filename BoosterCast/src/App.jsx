import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import LibraryPage from "./pages/LibraryPage";
import CollectionDashboard from "./pages/CollectionDashboard";
import PokemonCardDetail from "./pages/PokemonCardDetail";

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/dashboard" element={<CollectionDashboard />} />
        <Route path="/pokemon/:id" element={<PokemonCardDetail />} />
      </Routes>
    </Router>
  );
};

export default App;
