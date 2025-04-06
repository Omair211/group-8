import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  InfoIcon, ShareIcon, ChevronRightIcon, HeartIcon,
  CopyIcon, AwardIcon, BoxIcon, ClockIcon,
  PenIcon, FileTextIcon, UserIcon, ChevronDownIcon
} from 'lucide-react';
import { Pie } from 'react-chartjs-2';
import MistralQA from '../components/OpenRouterQA';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
ChartJS.register(ArcElement, Tooltip, Legend);

const PieChartComponent = ({ data }) => {
  const chartData = {
    labels: data.map((d) => d.name),
    datasets: [
      {
        data: data.map((d) => parseFloat(d.value)),
        backgroundColor: data.map((d) => d.color),
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          boxWidth: 14,
          padding: 12,
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.raw || 0;
            return `${label}: ${value.toFixed(2)}%`;
          },
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-md shadow-md p-4">
      <h2 className="text-lg font-semibold mb-4 text-gray-700">Asset Value Distribution</h2>
      <div className="w-full flex justify-center">
        <div className="w-full md:w-3/4">
          <Pie data={chartData} options={options} />
        </div>
      </div>
    </div>
  );
};

// Modify the SetsTable component to work with your current data format
const SetsTable = ({ sets }) => {
  return (
    <div className="bg-white rounded-md shadow-md p-4">
      <h2 className="text-lg font-semibold mb-4 text-gray-700">
        Set Distribution
      </h2>
      <table className="w-full">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Set Name</th>
            <th className="py-2">Unique Cards</th>
            <th className="py-2">Total Cards</th>
            <th className="py-2">% Complete</th>
          </tr>
        </thead>
        <tbody>
          {sets.map((set, index) => {
            return (
              <tr key={index} className="border-b">
                <td className="py-2">{set._id}</td>
                <td className="py-2">{set.count}</td>
                <td className="py-2">--</td>
                <td className="py-2">--</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default function CollectionDashboard() {
  const [summary, setSummary] = useState({
    unique: 0,
    uniqueSets: 0,
    total: 0,
    value: 0,
    unique_sets: 0,
    pokemon: 0,
    trainer: 0,
    energy: 0,
    rarityBreakdown: {},
  });

  const [collection, setCollection] = useState([]);
  const [sets, setSets] = useState([]); // New state for sets data
  const [loading, setLoading] = useState(true);
  const [showExportOptions, setShowExportOptions] = useState(false);

  // Fetch user collection data
  useEffect(() => {
    axios.get('http://localhost:8001/collection')
      .then((res) => {
        setCollection(res.data);
      })
      .catch((error) => {
        console.error("Error fetching user collection:", error);
      });

    axios.get('http://localhost:8001/collection/summary')
      .then((res) => {
        setSummary(res.data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching summary:", error);
        setLoading(false);
      });
      
    // New API call to fetch sets data
    axios.get('http://localhost:8001/collection/sets')
      .then((res) => {
        setSets(res.data);
      })
      .catch((error) => {
        console.error("Error fetching sets data:", error);
      });
  }, []);

  const totalValue = collection.map((sum, item) => {
    const price = item.price_at_tcg || 0;
    return sum + price * item.count;
  }, 0);

  const chartData = collection.map((item, index) => {
    const price = parseFloat(item.price_at_tcg) || 0;
    const value = price * item.count;
    return {
      name: item.title,
      value,
      color: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'][index % 6],
    };
  });

  // Handle export option selection
  const handleExport = async (format) => {
    setShowExportOptions(false); // Hide the export options

    try {
      const response = await axios.get(`http://localhost:8001/reports/export/${format}`, {
        responseType: 'blob', // Ensure the response is treated as a binary file
      });

      // Create a download link for the file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `collection.${format}`); // Set the file name
      document.body.appendChild(link);
      link.click(); // Trigger the download
      link.remove(); // Clean up
    } catch (error) {
      console.error(`Error exporting ${format}:`, error);
      alert(`Failed to export ${format}. Please try again.`);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
    </div>
  );

  return (
    <div className="bg-gray-100 min-h-screen w-full font-sans">
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
{/*  */}
      {/* Main Content */}
      <main className="container mx-auto p-4 md:p-6">
        {/* Share Button and Export Options */}
        
        <div className="mb-6">
          <div className="flex justify-end mt-4 relative">
            <button
              onClick={() => setShowExportOptions(!showExportOptions)}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md flex items-center transition-colors"
            >
              <ShareIcon size={16} className="mr-2" /> Share my collection
            </button>

            {/* Export Options Dropdown */}
            {showExportOptions && (
              <div className="absolute top-12 right-0 bg-white rounded-md shadow-lg z-10">
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                >
                  <FileTextIcon size={16} className="mr-2" /> Export as CSV
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                >
                  <FileTextIcon size={16} className="mr-2" /> Export as PDF
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-orange-400 text-white rounded-md shadow-md overflow-hidden">
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <div className="text-4xl font-bold">{summary.unique}</div>
              <div className="text-sm mt-1">Unique booster</div>
            </div>
          </div>
          
          <div className="bg-blue-500 text-white rounded-md shadow-md overflow-hidden">
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <div className="text-4xl font-bold">{summary.unique_sets}</div>
              <div className="text-sm mt-1">Unique sets</div>
            </div>
          </div>
          
          <div className="bg-purple-500 text-white rounded-md shadow-md overflow-hidden">
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <div className="text-4xl font-bold">{summary.total}</div>
              <div className="text-sm mt-1">Total boosters</div>
            </div>
          </div>
          
          <div className="bg-teal-600 text-white rounded-md shadow-md overflow-hidden">
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <div className="text-4xl font-bold">${summary.value.toFixed(2)}</div>
              <div className="text-sm mt-1">Market price</div>
            </div>
          </div>
        </div>
            {/* Card Insights Section */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">Card Insights</h3>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-gray-700 mb-2">
                <span className="font-medium">Need help with your collection?</span> Click the chat icon in the bottom right corner to:
              </p>
              <ul className="text-sm text-gray-600 pl-5 list-disc">
                <li>Get an overview of your collection's value</li>
                <li>Explore trends across your entire portfolio</li>
                <li>Receive suggestions to strengthen your collection</li>
                <li>Discover boosters that complement what you already own</li>
              </ul>
              </div>
            </div>
        
        {/* Sets Table - NEW */}
        <div className="mb-6">
          <SetsTable sets={sets} />
        </div>
        
        {/* Pie Chart and Asset Table */}
        <div className="grid grid-cols-1 gap-6 mb-6">
          <PieChartComponent data={chartData} />
          <AssetTable collection={collection} totalValue={totalValue} />
        </div>
        <MistralQA collectionData={collection} summaryData={summary} />
      </main>
    </div>
  );
}

const AssetTable = ({ collection, totalValue }) => {
  return (
    <div className="bg-white rounded-md shadow-md p-4">
      <h2 className="text-lg font-semibold mb-4 text-gray-700">
        Asset Details
      </h2>
      <table className="w-full">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Name</th>
            <th className="py-2">Quantity</th>
            <th className="py-2">Price</th>
            <th className="py-2">Value</th>
            <th className="py-2">% of Total</th>
          </tr>
        </thead>
        <tbody>
          {collection.map((item, index) => {
            const price = item.price_at_tcg || 0;
            const value = price * item.count;
            const percentage = ((value / totalValue) * 100).toFixed(2);
            return (
              <tr key={index} className="border-b">
                <td className="py-2">{item.title}</td>
                <td className="py-2">{item.count}</td>
                <td className="py-2">${price.toFixed(2)}</td>
                <td className="py-2">${value.toFixed(2)}</td>
                <td className="py-2">{percentage}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};