from fastapi import FastAPI, BackgroundTasks, HTTPException, Body
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from scraper import run
import uuid
from services import create_driver
from fastapi.middleware.cors import CORSMiddleware
from collection_scraper import scrape_collections
from typing import Optional, List
import asyncio
from bson import ObjectId
from collections import defaultdict
from multi_scraper_proxy import ma
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import queue
import pickle
import joblib
import threading
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional, List
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import re
import joblib
import asyncio

# Use modern lifespan pattern instead of on_event
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Load the TF-IDF model if it exists
    global tfidf_vectorizer
    try:
        tfidf_vectorizer = joblib.load("booster_tfidf_model.pkl")
        print("TF-IDF model loaded successfully")
    except FileNotFoundError:
        print("TF-IDF model not found. You need to train it first.")
    
    yield  # This is where FastAPI serves requests
    
    # Shutdown: Cleanup if needed
    print("Shutting down application")

app = FastAPI(lifespan=lifespan)

# Enable CORS to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

# Create 5 queues for distributing the links
queues = [asyncio.Queue() for _ in range(5)]

try:
    forecast_model = joblib.load("pokemon_forecaster_no_quantity.pkl")
    print("Forecasting model loaded successfully")
    # Verify the model has the expected features
    if not hasattr(forecast_model, 'feature_names_in_'):
        print("Warning: Loaded model doesn't have feature names. May not work as expected.")
except FileNotFoundError:
    print("Forecasting model file not found. Some features will be disabled.")
    forecast_model = None
except Exception as e:
    print(f"Error loading forecasting model: {e}")
    forecast_model = None
def add_temporal_features(df):
    """Add temporal features to the dataset."""
    df['date'] = pd.to_datetime(df['date'])
    df['day_of_year'] = df['date'].dt.dayofyear
    df['month'] = df['date'].dt.month
    df['day_of_week'] = df['date'].dt.dayofweek
    df['week_of_year'] = df['date'].dt.isocalendar().week
    return df

def add_lag_features(df):
    """Add lagged price features."""
    # Remove groupby since we're working with a single item's data
    df['price_lag_1'] = df['price'].shift(1)
    df['price_lag_2'] = df['price'].shift(2)
    df['price_lag_7'] = df['price'].shift(7)
    return df

def add_differenced_features(df):
    """Add price difference features."""
    # Remove groupby since we're working with a single item's data
    df['price_diff_1'] = df['price'].diff(1)  # Daily change
    df['price_diff_7'] = df['price'].diff(7)  # Weekly change
    df['price_pct_change_1'] = df['price'].pct_change(1)
    return df

def add_rolling_features(df):
    """Add rolling statistics."""
    windows = [3, 7, 14]
    for window in windows:
        df[f'rolling_avg_{window}'] = df['price'].rolling(window=window, min_periods=1).mean()
        df[f'rolling_std_{window}'] = df['price'].rolling(window=window, min_periods=1).std()
    return df


def clean_price_data(price_data):
    """Convert price data to consistent float format."""
    if isinstance(price_data, str):
        return float(price_data.replace('$', '').replace(',', ''))
    return float(price_data)

def prepare_forecast_data(historical_prices):
    """
    Prepare the data in the exact same way as during model training.
    Returns a DataFrame with all expected features.
    """
    # Create DataFrame with date and price
    df = pd.DataFrame(historical_prices)
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date')
    
    # Add all features exactly as done during training
    df = add_temporal_features(df)
    df = add_lag_features(df)
    df = add_rolling_features(df)
    
    # Drop rows with missing values (from lag features)
    df = df.dropna()
    
    return df

# Updated forecasting function
def prepare_forecast_features(historical_data, current_date):
    """Prepare features in the same format as the model was trained"""
    df = pd.DataFrame(historical_data)
    df['date'] = pd.to_datetime(df['date'])
    
    # Ensure we have the required columns
    if 'price' not in df.columns:
        raise ValueError("Historical data must contain 'price' column")
    
    # Add all the features your model expects
    df = add_temporal_features(df)
    df = add_lag_features(df)
    df = add_rolling_features(df)
    
    # Get the most recent row with all features
    latest = df.iloc[-1:].copy()
    
    # Ensure we have all expected features
    required_features = forecast_model.feature_names_in_
    missing_features = set(required_features) - set(latest.columns)
    
    if missing_features:
        raise ValueError(f"Missing required features: {missing_features}")
    
    return latest[required_features]
# MongoDB Connection
MONGO_URI = "mongodb://localhost:27017"
client = AsyncIOMotorClient(MONGO_URI)
db = client["pokemon_db"]
queue_collection = db["queue"]
pokemon_collection = db["pokemon_data"]
library_collection = db["library_data"]
collection_collection = db["user_collection"]
wishlist_collection = db["wishlist"]
class CollectionItem(BaseModel):
    item_id: str
    title: str
    text: str
    category: Optional[str] = None
    rarity: Optional[str] = None
    condition: Optional[str] = "Near Mint"
    release_date: Optional[str] = None
    price_at_tcg: str
    img: str
    link: str
    count: int = 1
    liked: bool = False

class QueueItem(BaseModel):
    url: str

class ForecastRequest(BaseModel):
    item_id: str
    periods: int = Field(3, ge=1, le=12)  # 1-12 periods validation

# Pydantic Model for Pokémon Data
class PokemonData(BaseModel):
    id: str = Field(..., alias="_id")
    name: str
    price: str
    rarity: str
    release_date: str
    url: str

@app.post("/queue")
async def add_to_queue(item: QueueItem, background_tasks: BackgroundTasks):
    item_id = str(uuid.uuid4())
    await queue_collection.insert_one({"_id": item_id, "url": item.url, "status": "pending"})
    background_tasks.add_task(scrape_pokemon_data, item_id, item.url)
    return {"id": item_id, "message": "Added to queue"}

@app.get("/status/{item_id}")
async def check_status(item_id: str):
    item = await queue_collection.find_one({"_id": item_id})
    if item:
        return {"status": item["status"]}
    return {"error": "Item not found"}

import asyncio
from fastapi import BackgroundTasks, HTTPException
from bson import ObjectId

@app.get("/pokemon/{item_id}")
async def get_pokemon_data(item_id: str):
    """Fetches Pokémon data or starts the scraper if not found. Supports ObjectId and UUIDs."""
    
    # Determine query format (ObjectId if valid, otherwise treat as UUID string)

    # Try fetching the item from MongoDB
    item = await library_collection.find_one({"_id": str(item_id)})

    if item:
        item["_id"] = str(item["_id"])  # Convert ObjectId/UUID to string
        return item

    # # If item is not found, start the scraper
    # url = f"https://www.tcgplayer.com/product/{item_id}"
    # print(f"Item {item_id} not found. Starting scraper for {url}...")

    # # ✅ Ensure the scraper is only added once to the queue
    # existing_queue_item = await queue_collection.find_one({"_id": item_id})
    # if not existing_queue_item:
    #     await queue_collection.insert_one({"_id": item_id, "url": url, "status": "pending"})
        
    #     # ✅ Run the scraper in a separate async task (not using BackgroundTasks)
    #     asyncio.create_task(scrape_and_store_pokemon_data(item_id, url))

    # # ✅ Wait up to 30 seconds for the scraper to complete
    # for _ in range(30):
    #     await asyncio.sleep(1)  # Wait for 1 second before checking again
    #     item = await pokemon_collection.find_one(query)
    #     if item:
    #         item["_id"] = str(item["_id"])
    #         print(f"Scraper completed. Returning data for {item_id}")
    #         return item  # ✅ Return the newly scraped data

    # If still not found after 30 seconds, return an error
    raise HTTPException(status_code=404, detail=f"Item {item_id} not found. Scraper is still running.")

import uuid
from bson import ObjectId
async def scrape_and_store_pokemon_data(tcg_id, url):
    """Scrapes data and stores it in MongoDB with both UUID and TCG ID."""
    
    print(f"Scraping for TCG ID: {tcg_id}")
    driver = create_driver()
    output = run(url, driver, 20)  # Scrape data

    if not output:
        print(f"Failed to scrape data for {tcg_id}")
        return

    # Generate a new UUID for internal `_id`
    item_id = str(uuid.uuid4())

    # Store in MongoDB with UUID `_id` and TCG ID
    pokemon_data = {
        "_id": item_id,  # UUID
        "tcg_id": tcg_id,  # TCGPlayer ID
        "output": output,
        "url": url
    }

    await pokemon_collection.insert_one(pokemon_data)
    print(f"Stored {item_id} (TCG ID: {tcg_id}) in MongoDB")


async def scrape_pokemon_data(item_id, url):
    """Scrapes data from TCGplayer and updates MongoDB."""
    
    # Scrape item data
    driver = create_driver()
    output = run(url, driver, 20)

    # Store in the user's collection
    await pokemon_collection.insert_one({"_id": item_id, "output": output, "url": url})

    # Mark queue item as completed
    await queue_collection.delete_one({"_id": item_id})  # Remove from queue after processing



async def scrape_queue(q, batch_size=5):
    """Scrapes links from a queue in batches and updates MongoDB."""
    print("[INFO] Starting scrape_queue task.")
    while True:
        try:
            # Collect a batch of links
            batch = []
            for _ in range(batch_size):
                data = await q.get()
                if data is None:
                    # Sentinel value to stop the task
                    print("[INFO] Received sentinel value. Stopping task.")
                    return
                batch.append(data)

            # Extract links from the batch
            links = [item.get("link") for item in batch if item.get("link")]
            if not links:
                continue  # Skip if no links in the batch

            # Scrape the batch of links
            print(f"[INFO] Scraping batch of {len(links)} links: {links}")
            results = ma(links)  # Pass the batch to the multi-scraper

            # Save the scraped data to MongoDB
            for result in results:
                if result:
                    item_id = str(uuid.uuid4())
                    scraped_data = {
                        "_id": item_id,
                        "title": result.get("title", "Unknown"),
                        "description": result.get("text", ""),
                        "category": result.get("category", "Unknown"),
                        "price_at_tcg": result.get("price", "N/A"),
                        "chart_data": result.get("chart_data", []),
                        "img": result.get("img", ""),
                        "link": result.get("link")
                    }
                    await library_collection.insert_one(scraped_data)
                    print(f"[INFO] Inserted scraped data for {result.get('link')} into MongoDB")
        except Exception as e:
            print(f"[ERROR] Error processing batch: {e}")
        finally:
            # Mark all tasks in the batch as done
            for _ in range(len(batch)):
                q.task_done()

async def run_library_scraper():
    """Scrapes all Pokémon collections and updates MongoDB with structured data."""
    driver = create_driver()
    
    # Start scraping tasks for each queue
    scraping_tasks = [asyncio.create_task(scrape_queue(q)) for q in queues]
    
    try:
        # Run the synchronous generator in a separate thread
        def sync_scrape_collections():
            for data in scrape_collections(driver):
                yield data

        # Process the generator asynchronously
        for data in await asyncio.to_thread(sync_scrape_collections):
            link = data.get("link")
            if link:
                # Distribute links across the 5 queues
                queue_index = hash(link) % 5  # Simple hashing to distribute links
                await queues[queue_index].put(data)  # Add the link and its data to the queue
                print(f"[INFO] Added {link} to queue {queue_index}")
    except Exception as e:
        print(f"[ERROR] Error during scraping: {e}")
    finally:
        # Wait for all queues to be processed
        for q in queues:
            await q.join()
        
        # Signal the tasks to stop by adding a sentinel value to each queue
        for q in queues:
            await q.put(None)
        
        # Wait for all tasks to complete
        await asyncio.gather(*scraping_tasks)
        
        # Close the driver
        driver.quit()
        print("[INFO] Scraping completed and driver closed.")
@app.post("/scrape-library")
async def scrape_library(background_tasks: BackgroundTasks):
    """
    Scrapes all available Pokémon collections from TCGplayer and stores them in `library_data`.
    """
    background_tasks.add_task(run_library_scraper)
    return {"message": "Library scraping started"}

# Endpoint to fetch all available Pokémon cards in the inventory system
from collections import defaultdict

@app.get("/library")
async def get_library():
    """Returns all scraped Pokémon collections grouped by category."""
    
    # Fetch all items from `library_collection`
    all_items = await library_collection.find().to_list(1000)

    # Group items by category
    grouped_data = defaultdict(list)
    for item in all_items:
        category = item.get("category", "Unknown")
        grouped_data[category].append(item)

    return grouped_data 

from bson import ObjectId

@app.get("/collection")
async def get_collection():
    """Fetch user's collection from the database and convert ObjectId to string."""
    items = await collection_collection.find().to_list(1000)

    # Convert ObjectId to string for JSON serialization
    for item in items:
        item["_id"] = str(item["_id"])  # Convert ObjectId to string

    return items

@app.post("/collection/add")
async def add_to_collection(item_id: str = Body(...)):
    print(f"Received item_id: {item_id}")  # Log the item_id
    library_item = await library_collection.find_one({"_id": item_id})
    if not library_item:
        print(f"Item not found in library: {item_id}")  # Log if item not found
        raise HTTPException(status_code=404, detail="Item not found in library")
    print(f"Library item: {library_item}")  # Log the fetched library item

    # Transform the library item into a CollectionItem
    collection_item = {
        "item_id": library_item["_id"],
        "title": library_item.get("title", "Unknown"),
        "text": library_item.get("description", ""),  # Map description to text
        "category": library_item.get("category", "Unknown"),
        "rarity": library_item.get("rarity", "Unknown"),
        "condition": "Near Mint",  # Default condition
        "release_date": library_item.get("release_date", ""),
        "price_at_tcg": library_item.get("price_at_tcg", "N/A"),
        "img": library_item.get("img", ""),
        "link": library_item.get("link", ""),
        "count": 1,  # Default count
        "liked": False  # Default liked status
    }

    # Check if the item already exists in the user's collection
    existing_item = await collection_collection.find_one({"item_id": collection_item["item_id"]})
    
    if existing_item:
        # Increment the count if the item already exists
        await collection_collection.update_one(
            {"item_id": collection_item["item_id"]}, {"$inc": {"count": 1}}
        )
    else:
        # Insert the new item into the user's collection
        await collection_collection.insert_one(collection_item)
    
    return {"message": "Item added to collection"}
@app.post("/collection/remove")
async def remove_from_collection(item: dict = Body(...)):
    """Remove an item from the user's collection."""
    item_id = item.get("item_id")
    if not item_id:
        raise HTTPException(status_code=400, detail="Item ID is required")

    existing_item = await collection_collection.find_one({"item_id": item_id})
    if not existing_item:
        raise HTTPException(status_code=404, detail="Item not found")

    if existing_item["count"] > 1:
        await collection_collection.update_one(
            {"item_id": item_id}, {"$inc": {"count": -1}}
        )
    else:
        await collection_collection.delete_one({"item_id": item_id})

    return {"message": "Item removed from collection"}

@app.post("/collection/like")
async def like_item(item: dict = Body(...)):
    """Toggle like on an item."""
    item_id = item.get("item_id")
    if not item_id:
        raise HTTPException(status_code=400, detail="Item ID is required")

    existing_item = await collection_collection.find_one({"item_id": item_id})
    if not existing_item:
        raise HTTPException(status_code=404, detail="Item not found")

    new_liked_status = not existing_item.get("liked", False)
    await collection_collection.update_one(
        {"item_id": item_id}, {"$set": {"liked": new_liked_status}}
    )

    return {"message": "Item like status updated", "liked": new_liked_status}
def clean_price(price):
    """
    Remove dollar signs and commas from the price string and convert it to a float.
    """
    if isinstance(price, str):
        # Remove dollar signs and commas
        price = price.replace('$', '').replace(',', '')
    try:
        return float(price)
    except (ValueError, TypeError):
        return None  # Return None if conversion fails
def exponential_smoothing(historical_prices, periods, alpha=0.3):
    forecasts = []
    last_forecast = historical_prices[-1]
    for _ in range(periods):
        last_forecast = alpha * historical_prices[-1] + (1 - alpha) * last_forecast
        forecasts.append(last_forecast)
    return forecasts

def forecast_future_prices(model, historical_prices, periods):
    predictions = []
    required_features = model.n_features_in_

    if len(historical_prices) < required_features:
        last_val = historical_prices[-1]
        while len(historical_prices) < required_features:
            historical_prices.insert(0, last_val)

    for _ in range(periods):
        features = historical_prices[-required_features:]
        next_price = model.predict([features])
        predictions.append(next_price[0])
        historical_prices.append(next_price[0])

    return predictions

# @app.post("/forecast/price")
# async def forecast_price(request: dict = Body(...)):
#     """
#     Forecast the future price of a Pokémon card.
    
#     Request body should contain:
#     - item_id: The ID of the item to forecast
#     - periods: Number of future periods to forecast (default: 3)
#     """
#     item_id = request.get("item_id")
#     periods = request.get("periods", 3)
    
#     if not item_id:
#         raise HTTPException(status_code=400, detail="Item ID is required")
    
#     # Fetch the item data
#     item = await library_collection.find_one({"_id": item_id})
#     if not item:
#         item = await collection_collection.find_one({"item_id": item_id})
#         if not item:
#             raise HTTPException(status_code=404, detail="Item not found")
    
#     # Extract and parse chart data
#     chart_data = item.get("chart_data", [])
#     if len(chart_data) % 3 != 0:
#         raise HTTPException(status_code=400, detail="Invalid chart_data format")
    
#     # Example usage in your parsing loop
#     parsed_data = []
#     for i in range(0, len(chart_data), 3):
#         try:
#             date = chart_data[i]
#             price = clean_price(chart_data[i + 1])  # Price is already a float
#             volume = clean_price(chart_data[i + 2])  # Volume is already a float
            
#             parsed_data.append({
#                 "date": date,
#                 "price": price,
#                 "volume": volume
#             })
#         except (ValueError, IndexError) as e:
#             print(f"Error parsing chart data at index {i}: {e}")
#             continue
    
#     if not parsed_data:
#         raise HTTPException(status_code=400, detail="Insufficient historical data for forecasting")
    
#     # Prepare data for the model
#     df = pd.DataFrame(parsed_data)
#     df["price"] = df["price"].replace('[\$,]', '', regex=True).astype(float)
    
#     # Define last_date here so it's accessible in all code paths
#     try:
#         # Extract the start date from the range (e.g., '3/18 to 3/20' -> '3/18')
#         start_date_str = df["date"].iloc[-1].split(" to ")[0]
#         # Parse the date (assuming '3/18' means March 2018)
#         last_date = datetime.strptime(start_date_str, "%m/%d")
#         # If the year is missing, assume the current year
#         last_date = last_date.replace(year=datetime.now().year)
#     except ValueError as e:
#         print(f"Error parsing date: {e}")
#         # Fallback to a default date if parsing fails
#         last_date = datetime.now()
    
#     # Use the ML model for forecasting if available
#     if forecast_model:
#         try:
#             # Forecast future prices
#             predictions = forecast_future_prices(forecast_model, df["price"].tolist(), periods)
            
#             # Generate future dates
#             future_dates = [
#                 (last_date + timedelta(days=30 * (i + 1))).strftime("%b %Y")
#                 for i in range(periods)
#             ]
            
#             # Structure forecast data as a list of dictionaries
#             forecast_data = [
#                 {"date": date, "price": price, "predicted": True}
#                 for date, price in zip(future_dates, predictions)
#             ]
#         except Exception as e:
#             print(f"Forecasting error: {e}")
#             # Fallback to exponential smoothing
#             forecast_data = exponential_smoothing(df["price"].tolist(), periods)
#             # Generate future dates for fallback
#             future_dates = [
#                 (last_date + timedelta(days=30 * (i + 1))).strftime("%b %Y")
#                 for i in range(periods)
#             ]
#             forecast_data = [
#                 {"date": date, "price": price, "predicted": True}
#                 for date, price in zip(future_dates, forecast_data)
#             ]
#     else:
#         # Fallback to exponential smoothing
#         forecast_data = exponential_smoothing(df["price"].tolist(), periods)
#         # Generate future dates for fallback
#         future_dates = [
#             (last_date + timedelta(days=30 * (i + 1))).strftime("%b %Y")
#             for i in range(periods)
#         ]
#         forecast_data = [
#             {"date": date, "price": price, "predicted": True}
#             for date, price in zip(future_dates, forecast_data)
#         ]
    
#     # Combine historical and forecast data
#     full_data = [
#         {"date": d["date"], "price": d["price"], "predicted": False}
#         for d in parsed_data
#     ] + forecast_data
    
#     return {
#         "item_id": item_id,
#         "title": item.get("title", ""),
#         "current_price": item.get("price_at_tcg", "$0"),
#         "forecast_data": forecast_data,  # Add this line
#         "full_data": full_data,
#         "timestamp": datetime.utcnow().isoformat()
#     }



# Mock functions for forecasting (replace with your actual implementation)
def forecast_future_prices(model, price_list, periods):
    """
    Forecast future prices using a trained model.
    
    Args:
        model: Trained forecasting model
        price_list: List of historical prices
        periods: Number of future periods to forecast
        
    Returns:
        List of forecasted prices
    """
    # Replace this with your actual forecasting logic
    return [price_list[-1] * (1 + 0.05 * (i + 1)) for i in range(periods)]

def exponential_smoothing(price_list, periods, alpha=0.3):
    """
    Forecast future prices using exponential smoothing.
    
    Args:
        price_list: List of historical prices
        periods: Number of future periods to forecast
        alpha: Smoothing factor
        
    Returns:
        List of forecasted prices
    """
    # Replace this with your actual exponential smoothing logic
    return [price_list[-1] * (1 + 0.02 * (i + 1)) for i in range(periods)]
feature_columns = [
    'day_of_year', 
    'month',
    'day_of_week',
    'price_lag_1',
    'price_lag_2',
    'price_lag_7',       # Added back
    'price_diff_1',      # Added back
    'price_diff_7',      # Added back
    'price_pct_change_1',# Added back
    'rolling_avg_7',
    'rolling_std_7'
]

def parse_date_range(date_str):
    """Parse date ranges like '12/21 to 12/23' into datetime objects"""
    try:
        # Extract just the start date (first part before " to ")
        start_date_str = date_str.split(" to ")[0]
        
        # Add current year if not present (assuming MM/DD format)
        if len(start_date_str.split('/')) == 2:
            start_date_str = f"{start_date_str}/{datetime.now().year}"
            
        # Parse with explicit format
        return datetime.strptime(start_date_str, "%m/%d/%Y")
    except Exception as e:
        print(f"Failed to parse date '{date_str}': {str(e)}")
        return None  # or raise an exception if you prefer
    
@app.post("/forecast/price")
async def forecast_price(request: ForecastRequest):
    """Complete forecast endpoint with feature engineering and error handling"""
    print(f"[DEBUG] Received forecast request: {request.dict()}")
    
    if forecast_model is None:
        raise HTTPException(status_code=503, detail="Forecasting service unavailable")

    try:
        # Get validated request parameters
        item_id = request.item_id
        periods = request.periods
        
        print(f"[DEBUG] Processing forecast for item {item_id}")

        # Fetch item data from either library or collection
        item = await library_collection.find_one({"_id": item_id}) or \
               await collection_collection.find_one({"item_id": item_id})
        
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")

        # Parse historical price data
        chart_data = item.get("chart_data", [])
        historical_prices = []
        
        print("here")
        for i in range(0, len(chart_data), 3):
            if i + 1 >= len(chart_data):
                break
                
            date_str = chart_data[i]
            price_str = chart_data[i + 1]
            
            try:
                parsed_date = parse_date_range(date_str)
                if not parsed_date:
                    continue
                    
                price = float(price_str.replace('$', '').replace(',', ''))
                
                historical_prices.append({
                    'date': parsed_date,
                    'price': price
                })
            except Exception as e:
                print(f"Skipping invalid data at position {i}: {str(e)}")
                continue

        print("2")

        # Validate we have enough historical data
        if len(historical_prices) < 14:
            raise HTTPException(
                status_code=400,
                detail=f"Need at least 14 data points, got {len(historical_prices)}"
            )

        # Create DataFrame and prepare features
        df = pd.DataFrame(historical_prices)
        df = df.sort_values('date')
        
        print("here2222")
        # Feature engineering (must match training pipeline)
        df = add_temporal_features(df)
        print("feature1")
        df = add_lag_features(df)
        print("feature2")
        df = add_rolling_features(df)
        print("feature3")
        df = add_differenced_features(df)
        print("feature4")
        df = df.dropna()

        
        # Verify we have all required features
        print("here22")
        missing_features = set(forecast_model.feature_names_in_) - set(df.columns)
        if missing_features:
            raise HTTPException(
                status_code=500,
                detail=f"Missing required features: {missing_features}"
            )

        # Generate forecasts
        forecasts = []
        current_features = df[forecast_model.feature_names_in_].iloc[-1:].copy()
        
        for _ in range(periods):
            # Predict next price
            next_price = forecast_model.predict(current_features)[0]
            
            # Create next date (monthly intervals)
            next_date = df['date'].iloc[-1] + timedelta(days=30)
            
            forecasts.append({
                'date': next_date.strftime("%b %Y"),
                'price': round(float(next_price), 2),
                'predicted': True
            })
            
            # Update features for next prediction
            new_row = {
                'date': next_date,
                'price': next_price,
                'day_of_year': next_date.dayofyear,
                'month': next_date.month,
                'day_of_week': next_date.dayofweek,
                'week_of_year': next_date.isocalendar().week,
                'price_lag_1': df['price'].iloc[-1],
                'price_lag_2': df['price'].iloc[-2],
                'price_lag_7': df['price'].iloc[-7],
                'rolling_avg_7': df['price'].iloc[-7:].mean(),
                'rolling_std_7': df['price'].iloc[-7:].std(),
                'price_diff_1': next_price - df['price'].iloc[-1],
                'price_diff_7': next_price - df['price'].iloc[-7],
                'price_pct_change_1': (next_price - df['price'].iloc[-1]) / df['price'].iloc[-1]
            }
            
            # Update DataFrame for next prediction
            df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
            current_features = df[forecast_model.feature_names_in_].iloc[-1:].copy()

        # Format historical data for response
        historical_formatted = [{
            'date': row['date'].strftime("%b %Y"),
            'price': row['price'],
            'predicted': False
        } for _, row in df.iloc[:-periods].iterrows()]

        return {
            'item_id': item_id,
            'historical_data': historical_formatted,
            'forecast_data': forecasts,
            'current_price': historical_prices[-1]['price'],
            'model_version': 'v2',
            'timestamp': datetime.utcnow().isoformat()
        }

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[ERROR] Unhandled exception: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Forecasting failed: {str(e)}"
        )    
from fastapi.responses import StreamingResponse
import csv
from io import StringIO
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from io import BytesIO

@app.get("/reports/export/csv")
async def export_csv():
    """
    Export the user's collection as a CSV file.
    """
    # Fetch all items from the collection
    items = await collection_collection.find().to_list(1000)

    # Create a CSV file in memory
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=items[0].keys())
    writer.writeheader()
    writer.writerows(items)
    output.seek(0)

    # Return the CSV file as a downloadable response
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=collection.csv"}
    )


from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from io import BytesIO
import matplotlib.pyplot as plt
import numpy as np

from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from io import BytesIO
import matplotlib.pyplot as plt
import tempfile
import os
import os
import tempfile
from io import BytesIO
from datetime import datetime
import logging
import httpx
import matplotlib.pyplot as plt
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from fastapi.responses import StreamingResponse
@ app.get("/reports/export/pdf")
async def export_pdf():
    """
    Export the user's collection as a PDF report with a chart and AI-generated analysis.
    """
    # Fetch all items from the collection
    items = await collection_collection.find().to_list(1000)
    
    # Prepare data for the chart
    titles = [item["title"] for item in items]
    counts = [item.get("count", 1) for item in items]
    prices = [float(item.get("price_at_tcg", 0)) for item in items]
    values = [count * price for count, price in zip(counts, prices)]
    
    # Calculate collection summary metrics
    total_items = sum(counts)
    total_value = sum(values)
    avg_card_value = total_value / total_items if total_items > 0 else 0
    most_valuable_idx = values.index(max(values)) if values else 0
    most_valuable_card = titles[most_valuable_idx] if titles else "None"
    most_valuable_value = max(values) if values else 0
    
    # Create a bar chart using matplotlib
    plt.figure(figsize=(10, 6))
    plt.bar(titles, values, color='skyblue')
    plt.xlabel('Items')
    plt.ylabel('Total Value ($)')
    plt.title('Collection Value by Item')
    plt.xticks(rotation=45, ha='right')
    plt.tight_layout()
    
    # Save the chart to a temporary file
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as temp_file:
        chart_path = temp_file.name
        plt.savefig(chart_path, format='png')
        plt.close()
    
    # Generate AI analysis of the collection using OpenRouter API
    analysis = await generate_collection_analysis(items, total_items, total_value, avg_card_value, most_valuable_card, most_valuable_value)
    
    # Create a PDF file in memory
    pdf_buffer = BytesIO()
    p = canvas.Canvas(pdf_buffer, pagesize=letter)
    
    # Add a title to the PDF
    p.setFont("Helvetica-Bold", 16)
    p.drawString(50, 750, "PACKCast Pokémon Collection Manager")
    
    # Add date
    p.setFont("Helvetica", 10)
    current_date = datetime.now().strftime("%Y-%m-%d")
    p.drawString(450, 750, f"Generated: {current_date}")
    
    # Add collection summary
    p.setFont("Helvetica-Bold", 14)
    p.drawString(50, 610, "Collection Analysis")
    p.setFont("Helvetica", 10)
    
    # Add the analysis text with manual line wrapping
    textobject = p.beginText(50, 590)
    textobject.setFont("Helvetica", 10)
    
    # Simple manual line wrapping function (no textwrap dependency)
    def wrap_text(text, width=80):
        lines = []
        for paragraph in text.split('\n'):
            words = paragraph.split()
            if not words:
                lines.append('')
                continue
                
            current_line = words[0]
            for word in words[1:]:
                if len(current_line) + 1 + len(word) <= width:
                    current_line += " " + word
                else:
                    lines.append(current_line)
                    current_line = word
            lines.append(current_line)
        return lines
    
    wrapped_text = wrap_text(analysis)
    for line in wrapped_text:
        textobject.textLine(line)
    
    p.drawText(textobject)
    
    # Calculate the height needed for the text
    text_height = len(wrapped_text) * 12  # Approximate height based on number of lines
    
    # Add the chart to the PDF after the analysis
    # Adjust the y-coordinate based on the text height
    chart_y = 590 - text_height - 20  # 20px padding after text
    p.drawImage(chart_path, 50, chart_y - 300, width=500, height=300)
    
    # Adjust the y-coordinate for the collection items table header
    table_y = chart_y - 320  # 20px padding after chart
    
    # Add collection items table header
    p.setFont("Helvetica-Bold", 12)
    p.drawString(50, table_y, "Pack Name")
    p.drawString(250, table_y, "Rarity")
    p.drawString(350, table_y, "Price")
    p.drawString(450, table_y, "Quantity")
    p.drawString(510, table_y, "Total Value")
    
    # Draw a line under the header
    p.line(50, table_y - 5, 550, table_y - 5)
    
    # Add collection items to the PDF
    y = table_y - 20  # Starting y-coordinate after the header
    p.setFont("Helvetica", 10)
    
    for item in items:
        title = item['title']
        rarity = item.get('rarity', 'Unknown')
        price = float(item.get('price_at_tcg', 0))
        count = item.get('count', 1)
        item_value = price * count
        
        # Check if we need a new page
        if y < 50:
            p.showPage()
            # Reset y position and add header on new page
            y = 750
            p.setFont("Helvetica-Bold", 12)
            p.drawString(50, y, "Pack Name")
            p.drawString(250, y, "Rarity")
            p.drawString(350, y, "Price")
            p.drawString(450, y, "Quantity")
            p.drawString(510, y, "Total Value")
            p.line(50, y-5, 550, y-5)
            y -= 20
            p.setFont("Helvetica", 10)
        
        # Truncate long titles
        if len(title) > 25:
            title = title[:22] + "..."
            
        p.drawString(50, y, title)
        p.drawString(250, y, rarity)
        p.drawString(350, y, f"${price:.2f}")
        p.drawString(450, y, str(count))
        p.drawString(510, y, f"${item_value:.2f}")
        
        y -= 15  # Move down for the next line
    
    # Add footer
    p.showPage()
    p.setFont("Helvetica", 8)
    p.drawString(50, 30, "PACKCast Pokémon Collection Manager")
    p.drawCentredString(letter[0]/2, 30, "Page 1")
    
    # Save the PDF
    p.save()
    pdf_buffer.seek(0)
    
    # Clean up the temporary chart file
    os.remove(chart_path)
    
    # Return the PDF file as a downloadable response
    return StreamingResponse(
        pdf_buffer, 
        media_type="application/pdf", 
        headers={"Content-Disposition": "attachment; filename=pokemon_collection_report.pdf"}
    )

async def generate_collection_analysis(items, total_items, total_value, avg_card_value, most_valuable_card, most_valuable_value):
    """
    Generate an AI analysis of the collection using OpenRouter API.
    """
    try:
        # Prepare collection summary for the AI
        rarities = {}
        for item in items:
            rarity = item.get('rarity', 'Unknown')
            if rarity in rarities:
                rarities[rarity] += item.get('count', 1)
            else:
                rarities[rarity] = item.get('count', 1)
        
        rarity_breakdown = ", ".join([f"{count} {rarity}" for rarity, count in rarities.items()])
        
        # Top 5 most valuable cards
        sorted_items = sorted(items, key=lambda x: float(x.get('price_at_tcg', 0)) * x.get('count', 1), reverse=True)
        top_cards = []
        for i, item in enumerate(sorted_items[:5]):
            if i >= 5:
                break
            price = float(item.get('price_at_tcg', 0))
            count = item.get('count', 1)
            top_cards.append(f"{item['title']} (${price:.2f} x {count})")
        
        top_cards_text = ", ".join(top_cards)
        
        # Create prompt for AI
        prompt = f"""
        Generate a concise analysis of this Pokémon booster collection (4-5 sentences):
        
        Collection Facts:
        - Total packs: {total_items}
        - Total value: ${total_value:.2f}
        - Average Pack value: ${avg_card_value:.2f}
        - Most valuable pack: {most_valuable_card} (${most_valuable_value:.2f})
        - Rarity breakdown: {rarity_breakdown}
        - Top valuable packs: {top_cards_text}
        
        Focus on overall collection value, any notable standouts, rarity distribution, and potential investment outlook.
        Keep your analysis professional and factual. Make the output report-ready. Do not mention cards, only boosters.
        """
        
        # Call OpenRouter API
        response = await httpx.post(
            'https://openrouter.ai/api/v1/chat/completions',
            json={
                "model": "deepseek/deepseek-r1-distill-qwen-14b:free",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a Pokémon booster collection analyzer providing concise, professional reports."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            },
            headers={
                'Content-Type': 'application/json',
                'Authorization': 'Bearer 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',
                'HTTP-Referer': 'https://packcast-collection.app',
                'X-Title': 'PACKCast Pokémon Collection'
            },
            timeout=15.0
        )
        
        data = response.json()
        analysis = data['choices'][0]['message']['content']
        
        return analysis
        
    except Exception as e:
        # Return a generic analysis if the API call fails
        logging.error(f"Error generating collection analysis: {str(e)}")
        return (
            f"This collection contains {total_items} cards with a total value of ${total_value:.2f}. "
            f"The average card value is ${avg_card_value:.2f}, with {most_valuable_card} being the most valuable at ${most_valuable_value:.2f}. "
            "Consider focusing on rare and holographic cards to increase the collection's overall value."
        )

@app.get("/collection/summary")
async def get_collection_summary():
    items = await collection_collection.find().to_list(1000)

    summary = {
        "unique": len(set(i["item_id"] for i in items)),
        "variants": len(items),
        "total": sum(i.get("count", 1) for i in items),
        "value": 0.0,
        "unique_sets": len(set(i["category"] for i in items)),
        "pokemon": sum(1 for i in items if i.get("category") == "Pokemon"),
        "trainer": sum(1 for i in items if i.get("category") == "Trainer"),
        "energy": sum(1 for i in items if i.get("category") == "Energy"),
        "rarityBreakdown": {}
    }

    for item in items:
        price = item.get("price_at_tcg")
        
        # Skip if price is None or "N/A"
        if price is None or price == "N/A":
            continue
        
        # If price is a string, clean it and convert to float
        if isinstance(price, str):
            try:
                price = float(price.replace("$", "").replace(",", ""))
            except ValueError:
                print(f"[WARNING] Invalid price format for item {item['item_id']}: {price}")
                continue
        # If price is already a float, use it directly
        elif not isinstance(price, (int, float)):
            print(f"[WARNING] Invalid price type for item {item['item_id']}: {price}")
            continue
        
        # Add to the total value
        summary["value"] += price * item.get("count", 1)

    # Calculate rarity breakdown
    rarity_count = {}
    for item in items:
        rarity = item.get("rarity", "Unknown")
        rarity_count[rarity] = rarity_count.get(rarity, 0) + 1
    summary["rarityBreakdown"] = rarity_count

    return summary

@app.get("/collection/activity")
async def get_recent_activity():
    recent = await collection_collection.find().sort("_id", -1).limit(5).to_list(5)
    for item in recent:
        item["_id"] = str(item["_id"])
    return recent

required_features = forecast_model.n_features_in_
print(required_features)
# next_price = forecast_model.predict([historical_prices[-required_features:]])

@app.post("/wishlist/add")
async def add_to_wishlist(item: dict = Body(...)):
    """Add an item to the user's wishlist."""
    item_id = item.get("item_id")
    if not item_id:
        raise HTTPException(status_code=400, detail="Item ID is required")

    # Fetch the item from the library_data collection
    library_item = await library_collection.find_one({"_id": item_id})
    if not library_item:
        raise HTTPException(status_code=404, detail="Item not found in library")

    # Check if the item already exists in the wishlist
    existing_item = await wishlist_collection.find_one({"item_id": item_id})
    if existing_item:
        raise HTTPException(status_code=400, detail="Item already in wishlist")

    # Add the item to the wishlist
    wishlist_item = {
        "item_id": library_item["_id"],
        "title": library_item.get("title", "Unknown"),
        "text": library_item.get("description", ""),
        "category": library_item.get("category", "Unknown"),
        "rarity": library_item.get("rarity", "Unknown"),
        "condition": "Near Mint",  # Default condition
        "release_date": library_item.get("release_date", ""),
        "price_at_tcg": library_item.get("price_at_tcg", "N/A"),
        "img": library_item.get("img", ""),
        "link": library_item.get("link", ""),
    }

    await wishlist_collection.insert_one(wishlist_item)
    return {"message": "Item added to wishlist"}

@app.post("/wishlist/remove")
async def remove_from_wishlist(item: dict = Body(...)):
    """Remove an item from the user's wishlist."""
    item_id = item.get("item_id")
    if not item_id:
        raise HTTPException(status_code=400, detail="Item ID is required")

    # Check if the item exists in the wishlist
    existing_item = await wishlist_collection.find_one({"item_id": item_id})
    if not existing_item:
        raise HTTPException(status_code=404, detail="Item not found in wishlist")

    # Remove the item from the wishlist
    await wishlist_collection.delete_one({"item_id": item_id})
    return {"message": "Item removed from wishlist"}

@app.get("/collection/wishlist")
async def get_wishlist():
    """Fetch the user's wishlist."""
    wishlist_items = await wishlist_collection.find().to_list(1000)
    for item in wishlist_items:
        item["_id"] = str(item["_id"])  # Convert ObjectId to string
    return wishlist_items


@app.get("/collection/duplicates")
async def get_duplicates():
    duplicates = await collection_collection.find({"count": {"$gt": 1}}).to_list(1000)
    for item in duplicates:
        item["_id"] = str(item["_id"])
    return duplicates

@app.get("/collection/graded")
async def get_graded():
    graded = await collection_collection.find({"condition": {"$regex": "graded", "$options": "i"}}).to_list(1000)
    for item in graded:
        item["_id"] = str(item["_id"])
    return graded

@app.get("/collection/sets")
async def get_sets():
    sets = await collection_collection.aggregate([
        {"$group": {"_id": "$category", "count": {"$sum": "$count"}}}
    ]).to_list(1000)
    print(sets)
    return sets


# Global variables for the model
tfidf_vectorizer = None
tfidf_matrix = None
booster_data = []

# Pydantic models for search
class SearchQuery(BaseModel):
    query: str
    limit: int = 5

# Function to preprocess text for TF-IDF
def preprocess_text(text):
    if not text:
        return ""
    # Convert to lowercase
    text = str(text).lower()
    # Remove special characters
    text = re.sub(r'[^\w\s]', ' ', text)
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text




# Training function
async def train_similarity_model():
    """
    Trains a TF-IDF similarity model using all booster data in the library_collection
    """
    global tfidf_vectorizer, tfidf_matrix, booster_data
    
    print("Training similarity model...")
    
    # Fetch all items from the library collection
    all_items = await library_collection.find().to_list(10000)
    
    if not all_items:
        print("No data found in library_collection to train the model")
        return False
        
    # Keep track of the original items
    booster_data = all_items
    
    # Extract and preprocess text data for TF-IDF
    # Combine title, category, and description for better matching
    corpus = []
    for item in all_items:
        title = item.get("title", "Unknown")
        category = item.get("category", "Unknown")
        description = item.get("description", "")
        
        # Combine fields with appropriate weighting (repeat important fields)
        combined_text = f"{title} {title} {category} {description}"
        processed_text = preprocess_text(combined_text)
        corpus.append(processed_text)
    
    # Create and fit TF-IDF vectorizer
    tfidf_vectorizer = TfidfVectorizer(
        max_features=2000,
        min_df=1,  # Keep terms that appear in at least 1 document
        ngram_range=(1, 2),  # Include both single words and pairs
        stop_words='english'  # Remove common English words
    )
    
    # Create TF-IDF matrix for all descriptions
    tfidf_matrix = tfidf_vectorizer.fit_transform(corpus)
    
    # Save the model
    joblib.dump(tfidf_vectorizer, "booster_tfidf_model.pkl")
    print(f"TF-IDF model trained with {len(all_items)} items and saved")
    
    return True

# Search function
def find_similar_boosters(query, top_n=5):
    """
    Find boosters similar to the query using the trained TF-IDF model
    """
    global tfidf_vectorizer, tfidf_matrix, booster_data
    
    if tfidf_vectorizer is None:
        # Try to load the model if it's not in memory
        try:
            tfidf_vectorizer = joblib.load("booster_tfidf_model.pkl")
        except:
            print("Model not found. Please train the model first.")
            return []
    
    # Preprocess the query
    processed_query = preprocess_text(query)
    
    # Transform the query to TF-IDF space
    query_tfidf = tfidf_vectorizer.transform([processed_query])
    
    # Calculate similarity between query and all boosters
    similarity_scores = cosine_similarity(query_tfidf, tfidf_matrix).flatten()
    
    # Get top N matches
    top_indices = np.argsort(similarity_scores)[-top_n:][::-1]
    
    # Return the results
    results = []
    for idx in top_indices:
        item = booster_data[idx]
        results.append({
            "id": str(item.get("_id")),
            "title": item.get("title", "Unknown"),
            "description": item.get("description", ""),
            "category": item.get("category", "Unknown"),
            "price_at_tcg": item.get("price_at_tcg", "N/A"),
            "img": item.get("img", ""),
            "link": item.get("link", ""),
            "similarity_score": float(similarity_scores[idx])
        })
    
    return results

# API Endpoints
@app.post("/train-booster-model")
async def train_model(background_tasks: BackgroundTasks):
    """
    Endpoint to train the TF-IDF similarity model for boosters
    """
    background_tasks.add_task(train_similarity_model)
    return {"message": "Training of booster similarity model started in the background"}

@app.post("/search/boosters")
async def search_boosters(search: SearchQuery):
    """
    Search for boosters using natural language queries
    """
    global tfidf_vectorizer, tfidf_matrix, booster_data
    
    # Check if model is loaded
    if tfidf_vectorizer is None or len(booster_data) == 0:
        try:
            # Try loading the model
            tfidf_vectorizer = joblib.load("booster_tfidf_model.pkl")
            
            # Also reload the data and matrix
            all_items = await library_collection.find().to_list(10000)
            if not all_items:
                raise HTTPException(status_code=500, detail="No booster data available in the database")
                
            booster_data = all_items
            
            # Recreate the corpus and matrix
            corpus = []
            for item in all_items:
                title = item.get("title", "Unknown")
                category = item.get("category", "Unknown")
                description = item.get("description", "")
                combined_text = f"{title} {title} {category} {description}"
                processed_text = preprocess_text(combined_text)
                corpus.append(processed_text)
            
            tfidf_matrix = tfidf_vectorizer.transform(corpus)
            
        except FileNotFoundError:
            # If model doesn't exist, train it
            success = await train_similarity_model()
            if not success:
                raise HTTPException(status_code=500, detail="Failed to train model. No data available.")
    
    # Find similar boosters
    results = find_similar_boosters(search.query, search.limit)
    
    if not results:
        return {"results": [], "message": "No matching boosters found"}
    
    return {"results": results}

@app.get("/interactive-search")
async def interactive_search(query: str = Query(...), limit: int = Query(5)):
    """
    Interactive search endpoint for boosters (GET method for easier testing)
    """
    search_request = SearchQuery(query=query, limit=limit)
    return await search_boosters(search_request)