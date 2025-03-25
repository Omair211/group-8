import { useState } from "react";
import React from "react";
import AddItemForm from "./components/AddItemForm";
import OpenRouterQA from "./components/OpenRouterQA";
import CollectionDashboard from "./pages/CollectionDashboard";
function App() {
  const [queueId, setQueueId] = useState(null);
  const [pokemonData, setPokemonData] = useState(null);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
      {/* <h1 className="text-2xl font-bold mb-4 text-center">
          Add a Pokémon TCG Item
        </h1>
        <AddItemForm setQueueId={setQueueId} />
        {queueId && (
          <p className="mt-4 text-center text-sm text-gray-600">
            Item added! Queue ID: <span className="font-semibold">{queueId}</span>
          </p>
        )}
        <OpenRouterQA/> */}
        <CollectionDashboard/>
      </div>
    </div>
  );
}

export default App;