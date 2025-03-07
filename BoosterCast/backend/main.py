from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from scraper import run
import uuid
from services import create_driver
app = FastAPI()

# MongoDB Connection
MONGO_URI = "mongodb://localhost:27017"
client = AsyncIOMotorClient(MONGO_URI)
db = client["pokemon_db"]
queue_collection = db["queue"]
pokemon_collection = db["pokemon_data"]

# Pydantic Model for Queue Items
class QueueItem(BaseModel):
    url: str

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

@app.get("/pokemon/{item_id}", response_model=PokemonData)
async def get_pokemon_data(item_id: str):
    item = await pokemon_collection.find_one({"_id": item_id})
    if item:
        return item
    return {"error": "Data not found"}

async def scrape_pokemon_data(item_id, url):
    """Scrapes data from TCGplayer and updates MongoDB."""
    
    # Mark item as completed in the queue
    await queue_collection.update_one({"_id": item_id}, {"$set": {"status": "completed"}})
    driver = create_driver()
    output = run(url, driver, 20)

    queue_collection.update_one({"_id": item_id}, {"$set": {"status": "completed"}})
    pokemon_collection.insert_one({"_id": item_id, "output": output, "url": url})