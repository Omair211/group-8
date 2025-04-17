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

      await axios.post("http://localhost:8001/collection/add", id);
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
      {/* Top Navigation Bar */}
      <div className="bg-gray-800 text-white p-4 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="flex items-center font-bold text-lg">
            <span className="text-orange-400">PACK</span>Cast
          </div>
          <nav className="hidden md:flex space-x-4">
            <Link to="/dashboard" className="hover:text-orange-300">Dashboard</Link>
            <Link to="/library" className="hover:text-orange-300">Library</Link>
          </nav>
        </div>
        <div className="flex space-x-2">
          <button className="p-2 rounded-full hover:bg-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
            </svg>
          </button>
          <button className="p-2 rounded-full hover:bg-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </button>
        </div>
      </div>
      {/* Main Content */}
      <main className="container mx-auto py-8 px-4">
        {/* Card details and action section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Card Image and Controls */}
          <div className="flex flex-col items-center">
            <div className="bg-white rounded-lg shadow-lg p-4 max-w-md">
              <img
                src={card.img}
                alt={card.title}
                className="w-full h-auto rounded"
              />
            </div>
            <div className="mt-4 flex items-center space-x-6">
              <div className="flex items-center">
                <button
                  onClick={() => setCount(count > 0 ? count - 1 : 0)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded-l"
                >
                  -
                </button>
                <span className="bg-white py-2 px-4 border-t border-b">{count}</span>
                <button
                  onClick={() => setCount(count + 1)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded-r"
                >
                  +
                </button>
              </div>
            </div>
            <div className="mt-6 w-full max-w-md">
              <div className="text-center text-xl font-semibold text-blue-600">
                ${getLatestPriceFromChartData(card.chart_data)}
              </div>
              <div className="grid grid-cols-1 gap-4 mt-4">
                <button
                  onClick={addToCollection}
                  className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded"
                >
                  Add to Collection
                </button>
              </div>
            </div>
          </div>

          {/* Card Details */}
          <div>
            <h1 className="text-3xl font-bold text-blue-600 mb-2">{card.title}</h1>
            <div className="text-gray-600 mb-4">{card.category}</div>

            {/* Description */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">Description</h3>
              <p className="text-gray-700">{card.description}</p>
            </div>
            
            {/* Card Insights Section */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">Card Insights</h3>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-gray-700 mb-2">
                  <span className="font-medium">Want to know more?</span> Click the chat icon in the bottom right corner to:
                </p>
                <ul className="text-sm text-gray-600 pl-5 list-disc">
                  <li>Ask about this card's investment potential</li>
                  <li>Get insights on price trends</li>
                  <li>Find out how it fits in your collection</li>
                  <li>Discover similar cards you might want to collect</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Full-width charts section */}
        <div className="mb-6">
          <div className="grid grid-cols-1 gap-6">
            {/* Price Forecast Chart */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Price Forecast</h3>
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-600">Forecast periods:</label>
                  <select 
                    value={forecastPeriods} 
                    onChange={(e) => setForecastPeriods(Number(e.target.value))}
                    className="border rounded p-1 text-sm"
                  >
                    <option value={3}>3 months</option>
                    <option value={6}>6 months</option>
                    <option value={12}>12 months</option>
                  </select>
                </div>
              </div>
              <div className="h-120">
                <PriceForecastChart itemId={id} periods={forecastPeriods} />
              </div>
            </div>

            {/* Price History Chart */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Price History</h3>
              <div className="h-80">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="price" stroke="#8884d8" />
                      <Line type="monotone" dataKey="volume" stroke="#82ca9d" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    No price history data available
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Integrate OpenRouterQA component */}
      <OpenRouterQA 
  collectionData={cardCollection} 
  summaryData={prepareCardSummary()}
  cardContext={prepareCardContext()}
  forecastData={forecastData}
/>


      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 mt-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-gray-400">
            © 2025 BoosterCast. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PokemonCardDetail;