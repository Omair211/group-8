import { useEffect, useState } from "react";
import axios from "axios";
import React from "react";
import { Link, useNavigate } from "react-router-dom";

const LibraryPage = () => {
  const [libraryData, setLibraryData] = useState([]);
  const [collection, setCollection] = useState({});
  const [wishlist, setWishlist] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOption, setFilterOption] = useState("All");
  const [itemsPerPage, setItemsPerPage] = useState(30);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOption, setSortOption] = useState("Card number");
  const [sortDirection, setSortDirection] = useState("asc");
  const [viewMode, setViewMode] = useState("Images"); // "Images" or "List"
  const navigate = useNavigate();
  const [isSemanticSearch, setIsSemanticSearch] = useState(false); // Toggle for semantic search
  const [semanticResults, setSemanticResults] = useState([]); // Store semantic search results
  
  const [refresh, setRefresh] = useState(false); // Dummy state to trigger re-render

  const performSemanticSearch = async () => {
    // if (!searchTerm.trim()) {
    //   filteredItems = [...libraryData]; // Reset to all items if search term is empty
    //   setRefresh((prev) => !prev); // Trigger re-render
    //   return;
    // }
  
    // try {
    //   const response = await axios.post("http://localhost:8001/search/boosters", {
    //     query: searchTerm,
    //     limit: itemsPerPage,
    //   });
    //   filteredItems = response.data.results; // Update filteredItems with semantic results
    //   setRefresh((prev) => !prev); // Trigger re-render
    // } catch (error) {
    //   console.error("Error performing semantic search:", error);
    //   filteredItems = []; // Clear results on error
    //   setRefresh((prev) => !prev); // Trigger re-render
    // }
  };
  // Advanced filtering state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [priceRange, setPriceRange] = useState([0, 1000]);
  const [selectedRarities, setSelectedRarities] = useState([]);
  const [availableRarities, setAvailableRarities] = useState([]);
  const [selectedSets, setSelectedSets] = useState([]);
  const [availableSets, setAvailableSets] = useState([]);
  // Add categories state
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [isNew, setIsNew] = useState(false);
  const [hasPromo, setHasPromo] = useState(false);
  const [filteredItems, setFilteredItems] = useState([]); // Store filtered items

  useEffect(() => {
    if (isSemanticSearch) {
      setSemanticResults([]);
    }
  }, [searchTerm]);

  
  // Fetch library data & user collection from the backend
  useEffect(() => {
    const fetchLibrary = async () => {
      try {
        const response = await axios.get("http://localhost:8001/library");
        const data = Object.values(response.data).flat();
        setLibraryData(data);
        
        // Extract unique rarities and sets for filters
        const rarities = [...new Set(data.map(item => item.rarity).filter(Boolean))];
        setAvailableRarities(rarities);
        
        const sets = [...new Set(data.map(item => item.set_name).filter(Boolean))];
        setAvailableSets(sets);

        // Extract unique categories for filters
        const categories = [...new Set(data.map(item => item.category).filter(Boolean))];
        setAvailableCategories(categories);
      } catch (error) {
        console.error("Error fetching library data:", error);
      }
    };
    const handleSearch = async () => {
      if (isSemanticSearch) {
        await performSemanticSearch();
      } else {
        // Regular keyword search
        const results = libraryData.filter((item) =>
          item.title?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredItems(results);
      }
    };


    const fetchCollection = async () => {
      try {
        const response = await axios.get("http://localhost:8001/collection");
        const collectionData = response.data.reduce((acc, item) => {
          acc[item.item_id] = { count: item.count, liked: item.liked };
          return acc;
        }, {});
        setCollection(collectionData);
      } catch (error) {
        console.error("Error fetching collection:", error);
      }
    };

    const fetchWishlist = async () => {
      try {
        const response = await axios.get("http://localhost:8001/collection/wishlist");
        setWishlist(response.data);
      } catch (error) {
        console.error("Error fetching wishlist:", error);
      }
    };

    fetchLibrary();
    fetchCollection();
    fetchWishlist();
  }, []);

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
  // Function to Add Item to Collection (Backend API)
  const addToCollection = async (item) => {
    try {
      console.log("Adding to collection:", item._id);
      await axios.post("http://localhost:8001/collection/add", item._id);
  
      setCollection((prev) => ({
        ...prev,
        [item._id]: { count: (prev[item._id]?.count || 0) + 1, liked: prev[item._id]?.liked || false },
      }));
    } catch (error) {
      console.error("Error adding to collection:", error);
    }
  };

  // Function to Remove Item from Collection (Backend API)
  const removeFromCollection = async (item) => {
    try {
      await axios.post("http://localhost:8001/collection/remove", {
        item_id: item._id,
      });
  
      setCollection((prev) => {
        const updatedCount = (prev[item._id]?.count || 1) - 1;
        if (updatedCount > 0) {
          return { ...prev, [item._id]: { count: updatedCount, liked: prev[item._id]?.liked || false } };
        } else {
          const newCollection = { ...prev };
          delete newCollection[item._id];
          return newCollection;
        }
      });
    } catch (error) {
      console.error("Error removing from collection:", error.response ? error.response.data : error);
    }
  };

  // Function to Like/Unlike an Item (Backend API)
  const toggleLike = async (item) => {
    try {
      const response = await axios.post("http://localhost:8001/collection/like", {
        item_id: item._id,
      });
      const newLikedStatus = response.data.liked;

      setCollection((prev) => ({
        ...prev,
        [item._id]: { count: prev[item._id]?.count || 0, liked: newLikedStatus },
      }));

      // Update wishlist after toggling like status
      const wishlistItems = await axios.get("http://localhost:8001/collection/wishlist");
      setWishlist(wishlistItems.data);
    } catch (error) {
      console.error("Error toggling like:", error.response ? error.response.data : error);
    }
  };

  // Toggle wishlist status
  const toggleWishlist = async (item) => {
    await toggleLike(item);
  };

  // Extract item ID from image URL
  const extractItemIdFromImage = (imageUrl) => {
    const match = imageUrl.match(/product\/(\d+)_in_/);
    return match ? match[1] : null;
  };
  
  // Navigate to item detail page with proper ID
  const handleItemClick = (item) => {
    console.log("Item clicked:", item);
    
    // Use item._id as a fallback if image URL parsing fails
    const id = item._id;
    
    console.log("Navigating with ID:", id);
    
    if (!id || id === "undefined") {
      console.error("Invalid ID for item:", item);
      return; // Don't navigate if ID is invalid
    }
    
    navigate(`/pokemon/${id}`);
  };

  // Reset all filters
  const resetFilters = () => {
    setSearchTerm("");
    setFilterOption("All");
    setPriceRange([0, 1000]);
    setSelectedRarities([]);
    setSelectedSets([]);
    setSelectedCategories([]); // Reset categories
    setIsNew(false);
    setHasPromo(false);
  };

  // Handle rarity selection
  const handleRarityChange = (rarity) => {
    setSelectedRarities(prev => {
      if (prev.includes(rarity)) {
        return prev.filter(r => r !== rarity);
      } else {
        return [...prev, rarity];
      }
    });
  };

  // Handle set selection
  const handleSetChange = (set) => {
    setSelectedSets(prev => {
      if (prev.includes(set)) {
        return prev.filter(s => s !== set);
      } else {
        return [...prev, set];
      }
    });
  };

  // Handle category selection
  const handleCategoryChange = (category) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
  };

  // Handle price range change
  const handlePriceChange = (index, value) => {
    setPriceRange(prev => {
      const newRange = [...prev];
      newRange[index] = parseFloat(value);
      return newRange;
    });
  };

  useEffect(() => {
    let filtered = isSemanticSearch ? [...semanticResults] : [...libraryData];
  
    if (!isSemanticSearch) {
      if (filterOption === "In collection") {
        filtered = filtered.filter((item) => collection[item._id]);
      } else if (filterOption === "Not in collection") {
        filtered = filtered.filter((item) => !collection[item._id]);
      } else if (filterOption === "In wishlist") {
        filtered = filtered.filter((item) => collection[item._id]?.liked);
      }
  
      // Price filter
      filtered = filtered.filter((item) => {
        const price = parseFloat(getLatestPriceFromChartData(item.chart_data)) || 0;
        return price >= priceRange[0] && price <= priceRange[1];
      });
  
      if (selectedRarities.length > 0) {
        filtered = filtered.filter((item) => selectedRarities.includes(item.rarity));
      }
  
      if (selectedSets.length > 0) {
        filtered = filtered.filter((item) => selectedSets.includes(item.set_name));
      }
  
      if (selectedCategories.length > 0) {
        filtered = filtered.filter((item) => selectedCategories.includes(item.category));
      }
  
      if (isNew) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
        filtered = filtered.filter((item) => {
          if (!item.release_date) return false;
          const releaseDate = new Date(item.release_date);
          return releaseDate >= thirtyDaysAgo;
        });
      }
  
      if (hasPromo) {
        filtered = filtered.filter((item) =>
          item.is_promo === true ||
          (item.title && item.title.toLowerCase().includes("promo"))
        );
      }
    }
  
    // Sorting
    filtered.sort((a, b) => {
      if (sortOption === "Card number") {
        const aIndex = a.card_number || 0;
        const bIndex = b.card_number || 0;
        return sortDirection === "asc" ? aIndex - bIndex : bIndex - aIndex;
      } else if (sortOption === "Price") {
        const aPrice = parseFloat(getLatestPriceFromChartData(a.chart_data)) || 0;
        const bPrice = parseFloat(getLatestPriceFromChartData(b.chart_data)) || 0;
        return sortDirection === "asc" ? aPrice - bPrice : bPrice - aPrice;
      } else if (sortOption === "Name") {
        return sortDirection === "asc"
          ? (a.title || "").localeCompare(b.title || "")
          : (b.title || "").localeCompare(a.title || "");
      } else if (sortOption === "Rarity") {
        const rarityOrder = { "Common": 1, "Uncommon": 2, "Rare": 3, "Ultra Rare": 4, "Secret Rare": 5 };
        const aRarity = rarityOrder[a.rarity] || 0;
        const bRarity = rarityOrder[b.rarity] || 0;
        return sortDirection === "asc" ? aRarity - bRarity : bRarity - aRarity;
      }
      return 0;
    });
  
    setFilteredItems(filtered);
  }, [
    isSemanticSearch,
    semanticResults,
    libraryData,
    filterOption,
    collection,
    wishlist,
    priceRange,
    selectedRarities,
    selectedSets,
    selectedCategories,
    isNew,
    hasPromo,
    sortOption,
    sortDirection,
  ]);
  

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const totalItems = filteredItems.length;

  const handleSortChange = (option) => {
    if (sortOption === option) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortOption(option);
      setSortDirection("asc");
    }
  };

  // Card number formatting
  const formatCardNumber = (index, total) => {
    const padLength = String(total).length;
    return `${String(index).padStart(padLength, '0')}/${total}`;
  };

  // Find maximum price for price range input
  // Max price for slider
  const maxPrice = Math.max(
    ...libraryData.map(item => parseFloat(getLatestPriceFromChartData(item.chart_data)) || 0),
    100
  );


  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
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

      {/* Search & Basic Filters */}
      <div className="bg-white p-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between">
        <div className="flex w-full md:w-auto space-x-2 mb-4 md:mb-0">
          <div className="relative w-full md:w-64">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </span>
            <input
  type="text"
  placeholder="Search cards..."
  className="pl-10 pr-4 py-2 w-full border rounded-md focus:ring-2 focus:ring-blue-500"
  value={searchTerm}
  onChange={(e) => {
    setSearchTerm(e.target.value);
    if (isSemanticSearch) {
      performSemanticSearch(); // Trigger semantic search on input change
    }
  }}
  onKeyDown={(e) => {
    if (e.key === "Enter") {
      if (isSemanticSearch) {
        performSemanticSearch(); // Trigger semantic search on Enter
      } else {
        // Regular keyword search
        const results = libraryData.filter((item) =>
          item.title?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        console.log(searchTerm, "result",results)
        setFilteredItems(results);
      }
    }
  }}
/>
          </div>
          <button 
            className="flex items-center px-3 py-2 border border-gray-300 rounded-md text-gray-600 bg-white hover:bg-gray-50"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
            </svg>
            {showAdvancedFilters ? "Hide Filters" : "Advanced Filters"}
          </button>
        </div>
        <div className="flex items-center space-x-1">
  {/* <input
    type="checkbox"
    id="semantic-search"
    checked={isSemanticSearch}
    onChange={() => setIsSemanticSearch(!isSemanticSearch)}
    className="h-4 w-4 text-orange-500 rounded" */}
  {/* /> */}
  {/* <label htmlFor="semantic-search" className="text-sm text-gray-700">
    Semantic Search
  </label> */}
</div>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-1">
            <input 
              type="radio" 
              id="all" 
              name="filter" 
              value="All" 
              checked={filterOption === "All"} 
              onChange={() => setFilterOption("All")}
              className="h-4 w-4 text-orange-500"
            />
            <label htmlFor="all" className="text-sm text-gray-700">All</label>
          </div>
          <div className="flex items-center space-x-1">
            <input 
              type="radio" 
              id="in-collection" 
              name="filter" 
              value="In collection" 
              checked={filterOption === "In collection"} 
              onChange={() => setFilterOption("In collection")}
              className="h-4 w-4 text-orange-500"
            />
            <label htmlFor="in-collection" className="text-sm text-gray-700">In collection</label>
          </div>
          <div className="flex items-center space-x-1">
            <input 
              type="radio" 
              id="not-in-collection" 
              name="filter" 
              value="Not in collection" 
              checked={filterOption === "Not in collection"} 
              onChange={() => setFilterOption("Not in collection")}
              className="h-4 w-4 text-orange-500"
            />
            <label htmlFor="not-in-collection" className="text-sm text-gray-700">Not in collection</label>
          </div>
          <div className="flex items-center space-x-1">
            {/* <input 
              type="radio" 
              id="in-wishlist" 
              name="filter" 
              value="In wishlist" 
              checked={filterOption === "In wishlist"} 
              onChange={() => setFilterOption("In wishlist")}
              className="h-4 w-4 text-orange-500"
            />
            <label htmlFor="in-wishlist" className="text-sm text-gray-700">In wishlist</label> */}
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="bg-gray-50 p-4 border-b border-gray-200">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-700">Advanced Filters</h3>
              <button 
                onClick={resetFilters}
                className="text-sm text-orange-500 hover:text-orange-700"
              >
                Reset All Filters
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Price Range Filter */}
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <h4 className="font-medium text-gray-700 mb-2">Price Range</h4>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">${priceRange[0].toFixed(2)}</span>
                  <span className="text-sm text-gray-500">${priceRange[1].toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="minPrice" className="block text-sm text-gray-600 mb-1">Min Price</label>
                    <input 
                      type="number" 
                      id="minPrice"
                      min="0"
                      max={priceRange[1]}
                      value={priceRange[0]}
                      onChange={(e) => handlePriceChange(0, e.target.value)}
                      className="w-full p-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label htmlFor="maxPrice" className="block text-sm text-gray-600 mb-1">Max Price</label>
                    <input 
                      type="number" 
                      id="maxPrice"
                      min={priceRange[0]}
                      max={maxPrice}
                      value={priceRange[1]}
                      onChange={(e) => handlePriceChange(1, e.target.value)}
                      className="w-full p-2 border rounded-md"
                    />
                  </div>
                </div>
              </div>
              
              {/* Rarity Filter */}
              {/* <div className="bg-white p-4 rounded-lg shadow-sm">
                <h4 className="font-medium text-gray-700 mb-2">Rarity</h4>
                <div className="flex flex-wrap gap-2">
                  {availableRarities.map((rarity) => (
                    <div key={rarity} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`rarity-${rarity}`}
                        checked={selectedRarities.includes(rarity)}
                        onChange={() => handleRarityChange(rarity)}
                        className="h-4 w-4 text-orange-500 rounded"
                      />
                      <label htmlFor={`rarity-${rarity}`} className="ml-2 text-sm text-gray-700">
                        {rarity}
                      </label>
                    </div>
                  ))}
                </div>
              </div> */}
              
              {/* Card Sets Filter */}
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <h4 className="font-medium text-gray-700 mb-2">Card Sets</h4>
                <div className="max-h-36 overflow-y-auto">
                  {availableSets.slice(0, 10).map((set) => (
                    <div key={set} className="flex items-center mb-1">
                      <input
                        type="checkbox"
                        id={`set-${set}`}
                        checked={selectedSets.includes(set)}
                        onChange={() => handleSetChange(set)}
                        className="h-4 w-4 text-orange-500 rounded"
                      />
                      <label htmlFor={`set-${set}`} className="ml-2 text-sm text-gray-700">
                        {set}
                      </label>
                    </div>
                  ))}
                  {availableSets.length > 10 && (
                    <button className="text-sm text-blue-500 mt-1">
                      View All Sets
                    </button>
                  )}
                </div>
              </div>
              
              {/* Category Filter */}
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <h4 className="font-medium text-gray-700 mb-2">Categories</h4>
                <div className="max-h-36 overflow-y-auto">
                  {availableCategories.map((category) => (
                    <div key={category} className="flex items-center mb-1">
                      <input
                        type="checkbox"
                        id={`category-${category}`}
                        checked={selectedCategories.includes(category)}
                        onChange={() => handleCategoryChange(category)}
                        className="h-4 w-4 text-orange-500 rounded"
                      />
                      <label htmlFor={`category-${category}`} className="ml-2 text-sm text-gray-700">
                        {category}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Additional Filters */}
              <div className="bg-white p-4 rounded-lg shadow-sm md:col-span-2">
                <h4 className="font-medium text-gray-700 mb-2">Additional Filters</h4>
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="new-items"
                      checked={isNew}
                      onChange={() => setIsNew(!isNew)}
                      className="h-4 w-4 text-orange-500 rounded"
                    />
                    <label htmlFor="new-items" className="ml-2 text-sm text-gray-700">
                      New Releases (Last 30 Days)
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="promo-items"
                      checked={hasPromo}
                      onChange={() => setHasPromo(!hasPromo)}
                      className="h-4 w-4 text-orange-500 rounded"
                    />
                    <label htmlFor="promo-items" className="ml-2 text-sm text-gray-700">
                      Promotional Cards
                    </label>
                  </div>
                  
                  {/* Additional filter options can be added here */}
                </div>
              </div>
            </div>
            
            {/* Applied Filters */}
            {(selectedRarities.length > 0 || selectedSets.length > 0 || selectedCategories.length > 0 ||
             priceRange[0] > 0 || priceRange[1] < maxPrice || isNew || hasPromo) && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Applied Filters:</h4>
                <div className="flex flex-wrap gap-2">
                  {priceRange[0] > 0 && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      Min Price: ${priceRange[0].toFixed(2)}
                      <button 
                        className="ml-1 text-blue-500"
                        onClick={() => setPriceRange([0, priceRange[1]])}
                      >×</button>
                    </span>
                  )}
                  
                  {priceRange[1] < maxPrice && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      Max Price: ${priceRange[1].toFixed(2)}
                      <button 
                        className="ml-1 text-blue-500"
                        onClick={() => setPriceRange([priceRange[0], maxPrice])}
                      >×</button>
                    </span>
                  )}
                  
                  {selectedRarities.map(rarity => (
                    <span key={rarity} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      Rarity: {rarity}
                      <button 
                        className="ml-1 text-blue-500"
                        onClick={() => handleRarityChange(rarity)}
                      >×</button>
                    </span>
                  ))}
                  
                  {selectedSets.map(set => (
                    <span key={set} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      Set: {set}
                      <button 
                        className="ml-1 text-blue-500"
                        onClick={() => handleSetChange(set)}
                      >×</button>
                    </span>
                  ))}
                  
                  {/* Show selected categories */}
                  {selectedCategories.map(category => (
                    <span key={category} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      Category: {category}
                      <button 
                        className="ml-1 text-blue-500"
                        onClick={() => handleCategoryChange(category)}
                      >×</button>
                    </span>
                  ))}
                  
                  {isNew && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      New Releases
                      <button 
                        className="ml-1 text-blue-500"
                        onClick={() => setIsNew(false)}
                      >×</button>
                    </span>
                  )}
                  
                  {hasPromo && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      Promotional Cards
                      <button 
                        className="ml-1 text-blue-500"
                        onClick={() => setHasPromo(false)}
                      >×</button>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Card Count and Sort Options */}
      <div className="p-4 bg-white border-b border-gray-200 flex flex-col md:flex-row justify-between items-center">
        <p className="text-sm text-gray-700 mb-2 md:mb-0">
          {totalItems === 0 ? "No cards found" : `${indexOfFirstItem + 1} – ${Math.min(indexOfLastItem, totalItems)} of ${totalItems} cards`}
        </p>
        
        <div className="flex flex-wrap gap-2 md:gap-4">
          <div className="flex items-center">
            <span className="text-sm text-gray-600 mr-2">Sort by:</span>
            <button 
              onClick={() => handleSortChange("Card number")}
              className={`text-sm px-2 py-1 rounded ${sortOption === "Card number" ? "text-orange-500" : "text-gray-600"}`}
            >
              Card number {sortOption === "Card number" && (sortDirection === "asc" ? "↑" : "↓")}
            </button>
            <button 
              onClick={() => handleSortChange("Price")}
              className={`text-sm px-2 py-1 rounded ${sortOption === "Price" ? "text-orange-500" : "text-gray-600"}`}
            >
              Price {sortOption === "Price" && (sortDirection === "asc" ? "↑" : "↓")}
            </button>
            <button 
              onClick={() => handleSortChange("Name")}
              className={`text-sm px-2 py-1 rounded ${sortOption === "Name" ? "text-orange-500" : "text-gray-600"}`}
            >
              Name {sortOption === "Name" && (sortDirection === "asc" ? "↑" : "↓")}
            </button>
            <button 
              onClick={() => handleSortChange("Rarity")}
              className={`text-sm px-2 py-1 rounded ${sortOption === "Rarity" ? "text-orange-500" : "text-gray-600"}`}
            >
              Rarity {sortOption === "Rarity" && (sortDirection === "asc" ? "↑" : "↓")}
            </button>
          </div>
          
          <div className="flex items-center">
            <span className="text-sm text-gray-600 mr-2">Show:</span>
            <select 
              value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="text-sm px-2 py-1 border rounded-md"
              >
                <option value={30}>30 cards</option>
                <option value={60}>60 cards</option>
                <option value={90}>90 cards</option>
                <option value={120}>120 cards</option>
              </select>
            </div>
            
            <div className="flex items-center">
              <span className="text-sm text-gray-600 mr-2">View:</span>
              <button 
                onClick={() => setViewMode("Images")} 
                className={`text-sm px-2 py-1 rounded ${viewMode === "Images" ? "text-blue-500" : "text-gray-600"}`}
              >
                Images
              </button>
              <button 
                onClick={() => setViewMode("List")} 
                className={`text-sm px-2 py-1 rounded ${viewMode === "List" ? "text-blue-500" : "text-gray-600"}`}
              >
                List
              </button>
            </div>
          </div>
        </div>
  
        {/* Card Grid */}
        <div className="p-4 bg-white max-w-7xl mx-auto">
          {filteredItems.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-600">No cards match your filters.</p>
              <button 
                onClick={resetFilters}
                className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600"
              >
                Reset Filters
              </button>
            </div>
          ) : (
<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
{filteredItems.slice(indexOfFirstItem, indexOfLastItem).map((item, index) => {
    if (!item?._id || !item?.img || !item?.title) {
      return null; // Skip items with missing data
    }

    const itemId = item._id;
    const isInCollection = collection[itemId]?.count > 0;
    const isInWishlist = wishlist.some((wishlistItem) => wishlistItem.item_id === itemId);

    return (
      <div key={itemId} className="flex flex-col border border-gray-200 rounded-md overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow w-40">
        {/* Card Number */}
        <div className="flex justify-between items-center px-2 py-1 bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
          <span>{formatCardNumber(indexOfFirstItem + index + 1, totalItems)}</span>
          <span className="flex items-center space-x-1">
            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path d="M9.049 2.927c.3-.916 1.603-.916 1.902 0l1.286 3.953a1.5 1.5 0 001.421 1.033h4.165c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1.5 1.5 0 00-.545 1.675l1.286 3.953c.3.916-.755 1.688-1.539 1.118l-3.367-2.446a1.5 1.5 0 00-1.767 0l-3.367 2.446c-.784.57-1.838-.201-1.539-1.118l1.286-3.953a1.5 1.5 0 00-.545-1.675L.834 9.723c-.783-.57-.38-1.81.588-1.81h4.165a1.5 1.5 0 001.421-1.033l1.286-3.953z"></path>
            </svg>
          </span>
        </div>

        {/* Card Image with Link */}
        <Link to={`/pokemon/${itemId}`} className="relative">
          <img
            src={item.img}
            alt={item.title}
            className="w-full h-40 object-contain cursor-pointer"
          />

          {/* Rarity Indicator */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-1">
            <div className="flex justify-between items-center">
              <span
                className={`inline-block w-3 h-3 rounded-full ${
                  item.rarity === "Common"
                    ? "bg-black"
                    : item.rarity === "Uncommon"
                    ? "bg-gray-400"
                    : item.rarity === "Rare"
                    ? "bg-yellow-400"
                    : "bg-blue-500"
                }`}
              ></span>
              <span className="text-white text-xs">${getLatestPriceFromChartData(item.chart_data)}</span>

            </div>
          </div>
        </Link>

        {/* Card Controls */}
        <div className="flex items-center border-t border-gray-200 bg-gray-50">
          <button
            onClick={() => removeFromCollection(item)}
            className="flex-1 py-2 text-center text-gray-500 hover:bg-gray-100 transition-colors"
            disabled={!isInCollection}
          >
            −
          </button>
          <span className="flex-1 py-2 text-center font-medium text-sm">
            {collection[itemId]?.count || 0}
          </span>
          <button
            onClick={() => addToCollection(item)}
            className="flex-1 py-2 text-center text-gray-500 hover:bg-gray-100 transition-colors"
          >
            +
          </button>
        </div>
      </div>
    );
  })}
            </div>
          )}
        </div>
  
        {/* Pagination Controls */}
        <div className="p-4 bg-white border-t border-gray-200 flex justify-center">
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-600 disabled:opacity-50 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border border-gray-300 rounded-md bg-blue-500 text-white disabled:opacity-50 hover:bg-blue-600"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  export default LibraryPage;