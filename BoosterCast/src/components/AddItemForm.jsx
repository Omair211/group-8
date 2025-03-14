import { useState } from "react";
import axios from "axios";
import React from "react";

const AddItemForm = ({ setQueueId }) => {
  const [url, setUrl] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const response = await axios.post("http://localhost:8000/queue", { url });
    setQueueId(response.data.id);
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded-lg">
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Enter TCGplayer link"
        className="p-2 border rounded"
      />
      <button type="submit" className="ml-2 p-2 bg-blue-500 text-white rounded">
        Add
      </button>
    </form>
  );
};

export default AddItemForm;