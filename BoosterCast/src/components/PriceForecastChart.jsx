import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

const PriceForecastChart = ({ itemId, periods = 3 }) => {
  const [forecasting, setForecasting] = useState(false);
  const [forecastData, setForecastData] = useState(null);
  const [error, setError] = useState(null);

  const fetchForecast = async () => {
    if (!itemId) return;

    try {
      setForecasting(true);
      setError(null);
      
      const response = await axios.post('http://localhost:8001/forecast/price', {
        item_id: itemId,
        periods: periods
      });
      
      console.log('API Response:', response.data); // Debug log
      
      // Combine historical and forecast data
      const combinedData = [
        ...(response.data.historical_data || []).map(item => ({
          ...item,
          price: parseFloat(item.price) || 0,
          predicted: false
        })),
        ...(response.data.forecast_data || []).map(item => ({
          ...item,
          price: parseFloat(item.price) || 0,
          predicted: true
        }))
      ];

      if (combinedData.length === 0) {
        throw new Error('No forecast data available');
      }

      setForecastData({
        ...response.data,
        full_data: combinedData
      });
      
    } catch (err) {
      console.error('Forecast error:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to load forecast');
    } finally {
      setForecasting(false);
    }
  };

  useEffect(() => {
    fetchForecast();
  }, [itemId, periods]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 shadow rounded">
          <p className="font-medium">{label}</p>
          <p className="text-blue-600">${data.price.toFixed(2)}</p>
          {data.predicted && (
            <p className="text-orange-500 text-sm">Forecasted</p>
          )}
        </div>
      );
    }
    return null;
  };

  if (forecasting) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6 h-96 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-3 text-gray-600">Generating price forecast...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-2">Price Forecast</h3>
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <p className="text-red-700">{error}</p>
          <button
            onClick={fetchForecast}
            className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!forecastData || !forecastData.historical_data) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-2">Price Forecast</h3>
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
          <p>No forecast data available</p>
        </div>
      </div>
    );
  }

  // Find where predictions start
  const historicalCount = forecastData.historical_data?.length || 0;
  const hasForecastData = forecastData.forecast_data?.length > 0;

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Price Forecast</h3>
        <div className="flex space-x-4">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
            <span className="text-sm">Historical</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-orange-500 mr-2"></div>
            <span className="text-sm">Forecast</span>
          </div>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={forecastData.full_data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis 
              dataKey="date"
              tick={{ fontSize: 12 }}
            />
            <YAxis
              tickFormatter={(value) => `$${value}`}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {hasForecastData && historicalCount > 0 && (
              <ReferenceLine
                x={forecastData.full_data[historicalCount]?.date}
                stroke="#f97316"
                strokeDasharray="3 3"
                label={{
                  value: 'Forecast Start',
                  position: 'insideTopRight',
                  fill: '#f97316'
                }}
              />
            )}
            
            <Line
              type="monotone"
              dataKey="price"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={({ payload }) => (
                <circle
                  cx={0}
                  cy={0}
                  r={4}
                  fill={payload.predicted ? "#f97316" : "#3b82f6"}
                />
              )}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="bg-gray-50 p-3 rounded">
          <p className="text-sm text-gray-500">Current Price</p>
          <p className="font-semibold">
            ${typeof forecastData.current_price === 'number' 
              ? forecastData.current_price.toFixed(2) 
              : forecastData.current_price}
          </p>
        </div>
        <div className="bg-orange-50 p-3 rounded">
          <p className="text-sm text-orange-500">{periods}-month Forecast</p>
          <p className="font-semibold text-orange-600">
            ${hasForecastData 
              ? forecastData.forecast_data[forecastData.forecast_data.length - 1]?.price.toFixed(2) 
              : 'N/A'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PriceForecastChart;