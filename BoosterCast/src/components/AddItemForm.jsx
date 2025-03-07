import { useState } from "react";
import React from "react";

const AddItemForm = ({ setQueueId }) => {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url.startsWith("https://www.tcgplayer.com/")) {
      setError("Please enter a valid TCGplayer link.");
      return;
    }
    setError("");
    const fakeQueueId = Math.random().toString(36).substring(7);
    setQueueId(fakeQueueId);
    setUrl("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Enter TCGplayer link..."
        className="p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        className="bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 transition"
      >
        Add Item
      </button>
    </form>
  );
};

export default AddItemForm;