import { useState } from "react";
import React from "react";
import AddItemForm from "./components/AddItemForm";
import QueueIndicator from "./components/QueueIndicator";
import PokemonDisplay from "./components/PokemonDisplay";

function App() {
  const [queueId, setQueueId] = useState(null);
  const [pokemonData, setPokemonData] = useState(null);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">TCGplayer Pokémon Tracker</h1>
      <AddItemForm setQueueId={setQueueId} />
      {queueId && <QueueIndicator queueId={queueId} setPokemonData={setPokemonData} />}
      <PokemonDisplay pokemonData={pokemonData} />
    </div>
  );
}

export default App;