import { useEffect, useState } from "react";
import axios from "axios";
import React from "react";

const QueueIndicator = ({ queueId, setPokemonData }) => {
  const [status, setStatus] = useState("pending");

  useEffect(() => {
    if (!queueId) return;

    const interval = setInterval(async () => {
      const res = await axios.get(`http://localhost:8000/status/${queueId}`);
      setStatus(res.data.status);
      if (res.data.status === "completed") {
        clearInterval(interval);
        fetchPokemonData();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [queueId]);

  const fetchPokemonData = async () => {
    const res = await axios.get(`http://localhost:8000/pokemon/${queueId}`);
    setPokemonData(res.data);
  };

  return (
    <div className="mt-4">
      Status: <span className="font-bold">{status}</span>
    </div>
  );
};

export default QueueIndicator;