from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from scraper import run
import uuid
from services import create_driver
app = FastAPI()
from typing import Optional, List

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
# Pydantic Model for Pokémon Data
class PokemonData(BaseModel):
  id: str = Field(..., alias="_id")
  name: str
  price: str
  rarity: str
  release_date: str
  url: str

@app.get("/collection/")
async def get_collection():
  """Fetch user's collection from the database and convert ObjectId to string."""
  print("slp")
  items = await collection_collection.find().to_list(1000)
  # Convert ObjectId to string for JSON serialization
  for item in items:
    item["_id"] = str(item["_id"]) # Convert ObjectId to string
  return items

@app.get("/collection/sets")
async def get_sets():
  sets = await collection_collection.aggregate([
    {"$group": {"_id": "$category", "count": {"$sum": "$count"}}}
  ]).to_list(1000)
  print(sets)
  return sets


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
  text_height = len(wrapped_text) * 12 # Approximate height based on number of lines
  
  # Add the chart to the PDF after the analysis
  # Adjust the y-coordinate based on the text height
  chart_y = 590 - text_height - 20 # 20px padding after text
  p.drawImage(chart_path, 50, chart_y - 300, width=500, height=300)
  
  # Adjust the y-coordinate for the collection items table header
  table_y = chart_y - 320 # 20px padding after chart
  
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
  y = table_y - 20 # Starting y-coordinate after the header
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
    
    y -= 15 # Move down for the next line
  
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