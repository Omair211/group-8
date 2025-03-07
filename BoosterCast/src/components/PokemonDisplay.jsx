import React from "react";
const PokemonDisplay = ({ pokemonData }) => {
    if (!pokemonData) return null;
  
    return (
      <div className="mt-4 p-4 border rounded-lg">
        <h2 className="text-xl font-bold">{pokemonData.name}</h2>
        <p>Price: {pokemonData.price}</p>
        <a href={pokemonData.url} className="text-blue-500">View on TCGplayer</a>
      </div>
    );
  };
  
  export default PokemonDisplay;
  