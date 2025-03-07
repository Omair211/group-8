from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
import requests
from bs4 import BeautifulSoup
import uuid

app = FastAPI()

# MongoDB Connection
MONGO_URI = "mongodb://localhost:27017"
client = AsyncIOMotorClient(MONGO_URI)
db = client["pokemon_db"]
queue_collection = db["queue"]
pokemon_collection = db["pokemon_data"]

class QueueItem(BaseModel):
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

@app.get("/pokemon/{item_id}")
async def get_pokemon_data(item_id: str):
    item = await pokemon_collection.find_one({"_id": item_id})
    if item:
        return item
    return {"error": "Data not found"}

def scrape_pokemon_data(item_id, url):
    """Scrapes data from TCGplayer and updates MongoDB."""
    response = requests.get(url)
    soup = BeautifulSoup(response.text, "html.parser")

    # Extract sample data (Modify selectors based on TCGplayer's structure)
    name = soup.find("h1").text if soup.find("h1") else "Unknown"
    price = soup.find(class_="price-class").text if soup.find(class_="price-class") else "N/A"

    data = {"_id": item_id, "name": name, "price": price, "url": url}

    # Update status in queue and insert data into pokemon collection
    queue_collection.update_one({"_id": item_id}, {"$set": {"status": "completed"}})
    pokemon_collection.insert_one(data)