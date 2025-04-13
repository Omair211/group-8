import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import PriceForecastChart from '../components/PriceForecastChart';
import OpenRouterQA from '../components/OpenRouterQA';

const PokemonCardDetail = () => {
  const { id } = useParams();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [count, setCount] = useState(0);
  const [forecastPeriods, setForecastPeriods] = useState(3);
  const [cardCollection, setCardCollection] = useState([]);
  const [forecastData, setForecastData] = useState(null);
  const [collectionSummary, setCollectionSummary] = useState({
    unique: 0,
    variants: 0,
    total: 0,
    value: 0,
    pokemon: 0,
    trainer: 0,
    energy: 0
  });

  // Helper function to get latest price from chart data
  const getLatestPriceFromChartData = (chartData) => {
    if (!chartData || !Array.isArray(chartData) || chartData.length < 3) {
      return 'N/A';
    }
    
    // The last price is at position length-2 (since data is in date,price,volume triples)
    const lastPriceStr = chartData[chartData.length - 2];
    try {
      const price = parseFloat(lastPriceStr.replace('$', '').replace(',', ''));
      return isNaN(price) ? 'N/A' : price.toFixed(2);
    } catch (e) {
      return 'N/A';
    }
  };

  useEffect(() => {
    const fetchCardData = async () => {
      if (!id || id === "undefined") {
        setError("Invalid card ID. Please go back and try again.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await axios.get(`http://localhost:8001/pokemon/${id}`);
        setCard(response.data);
        
        await fetchCollectionData();
        
        console.log("item id, periods", id, forecastPeriods);
        try {
          const forecastResponse = await axios.post(`http://localhost:8001/forecast/price`, {item_id: id, periods: forecastPeriods});
          setForecastData(forecastResponse.data);
        } catch (forecastErr) {
          console.log('Forecast data not available:', forecastErr);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching card data:', err);
        setError(`Failed to load card data: ${err.message}`);
        setLoading(false);
      }
    };

    fetchCardData();
  }, [id]);
  
  const fetchCollectionData = async () => {
    try {
      const summaryResponse = await axios.get('http://localhost:8001/collection/summary');
      setCollectionSummary(summaryResponse.data);
      
      const collectionResponse = await axios.get('http://localhost:8001/collection');
      setCardCollection(collectionResponse.data);
    } catch (err) {
      console.error('Error fetching collection data:', err);
    }
  };

  const addToCollection = async () => {
    try {
      const payload = {
        item_id: id,
        count: count > 0 ? count : 1,
      };

      await axios.post("http://localhost:8001/collection/add", payload);
      alert('Added to collection successfully!');
      await fetchCollectionData();
    } catch (err) {
      console.error('Error adding to collection:', err);
      alert('Failed to add to collection. Please try again.');
    }
  };

  const parseChartData = (chartData) => {
    if (!chartData || !Array.isArray(chartData) || chartData.length === 0) {
      return [];
    }
    
    const data = [];
    for (let i = 0; i < chartData.length; i += 3) {
      if (i + 2 < chartData.length) {
        data.push({
          date: chartData[i],
          price: parseFloat(chartData[i + 1].replace('$', '')),
          volume: parseFloat(chartData[i + 2].replace('$', '')),
        });
      }
    }
    return data;
  };

  const formatPriceHistory = (chartData) => {
    if (!chartData || chartData.length === 0) return null;
    
    const firstPoint = chartData[0];
    const lastPoint = chartData[chartData.length - 1];
    const startPrice = firstPoint.price;
    const endPrice = lastPoint.price;
    const changePercent = ((endPrice - startPrice) / startPrice * 100).toFixed(2);
    
    let highestPrice = -Infinity;
    let lowestPrice = Infinity;
    let highestDate = '';
    let lowestDate = '';
    
    chartData.forEach(point => {
      if (point.price > highestPrice) {
        highestPrice = point.price;
        highestDate = point.date;
      }
      if (point.price < lowestPrice) {
        lowestPrice = point.price;
        lowestDate = point.date;
      }
    });
    
    return `Price started at $${startPrice.toFixed(2)} on ${firstPoint.date} and is currently $${endPrice.toFixed(2)} as of ${lastPoint.date}, representing a ${changePercent}% change. The highest recorded price was $${highestPrice.toFixed(2)} on ${highestDate}, and the lowest was $${lowestPrice.toFixed(2)} on ${lowestDate}.`;
  };
  
  const formatForecastData = () => {
    if (!forecastData || !Array.isArray(forecastData) || forecastData.length === 0) {
      return null;
    }
    
    const firstPoint = forecastData[0];
    const lastPoint = forecastData[forecastData.length - 1];
    const startPrice = firstPoint.price;
    const endPrice = lastPoint.price;
    const trend = endPrice > startPrice ? 'up' : endPrice < startPrice ? 'down' : 'stable';
  
    const prices = forecastData.map((point) => point.price);
    const meanPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - meanPrice, 2), 0) / prices.length;
    const standardDeviation = Math.sqrt(variance);
    const confidence = Math.max(0, 100 - (standardDeviation / meanPrice) * 100).toFixed(2);
  
    const estimatedPrice = lastPoint.price;
  
    let forecastSummary = `Based on our model, the price is ${trend === 'up' ? 'expected to increase' : trend === 'down' ? 'expected to decrease' : 'expected to remain stable'} over the next ${forecastPeriods} months.`;
    forecastSummary += ` The model has a ${confidence}% confidence in this prediction.`;
    forecastSummary += ` The estimated price in ${forecastPeriods} months is $${estimatedPrice.toFixed(2)}.`;
  
    return forecastSummary;
  };

  const prepareCardContext = () => {
    if (!card) return null;

    const priceHistory = formatPriceHistory(parseChartData(card.chart_data || []));
    const priceForecast = formatForecastData();
  
    return {
      priceHistory,
      priceForecast,
      similarCards: card.similar_cards || [],
    };
  };
  
  const prepareCardSummary = () => {
    if (!card) return collectionSummary;
    
    return {
      ...collectionSummary,
      currentCard: {
        title: card.title,
        price: getLatestPriceFromChartData(card.chart_data),
        category: card.category || 'Unknown',
        description: card.description || '',
        rarity: card.rarity || 'Unknown'
      }
    };
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-green-500"></div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p>{error}</p>
      </div>
    </div>
  );

  if (!card) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
        <p>Card data not found</p>
      </div>
    </div>
  );

  const chartData = parseChartData(card.chart_data || []);

  return (
    <div className="min-h-screen bg-gray-100">
    </div>
  );
};

export default PokemonCardDetail;