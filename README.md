```markdown
# PACKCast: Smart Pokémon Collection Manager with Predictive Analytics

PACKCast is a full-stack web app that helps users manage, analyze, and forecast the value of their Pokémon card collections using intelligent filtering, semantic search, and machine learning-based price prediction.

---

## 📦 Prerequisites

Ensure the following are installed on your system:

- **Latest Python** (3.10+ recommended)
- **Node.js and npm**
- **MongoDB Compass** → [Download Here](https://www.mongodb.com/try/download/compass)
- **Chrome browser + Latest ChromeDriver** (needed for scraping)

---

## 🗃️ MongoDB Setup

1. Open **MongoDB Compass**.
2. Create a new **database** called:

   ```
   pokemon_db
   ```

3. Inside `pokemon_db`, create the following **collections**:
   - `library_data`
   - `pokemon_data`
   - `queue`
   - `user_collection`
   - `wishlist`

4. Download and import data into these collections from this Google Drive folder:  
   🔗 [Collection Files – Google Drive](https://drive.google.com/drive/folders/1kSrn-hFedzV9V6ylm44j7U0trbuL1H8x?usp=sharing)

   You'll find `.json` or `.bson` files that should be loaded into:
   - `pokemon_db.user_collection`
   - `pokemon_db.pokemon_data`
   - `pokemon_db.library_data`

   > You can use Compass → `Collection` → `...` → `Import` to upload the files.

---

## 🤖 Machine Learning Model Setup

1. Download the trained model from this link:  
   🔗 [Download Model](https://drive.google.com/file/d/1C69lH-xzGnrZj8SQhIP00zlGg1IXLdfi/view?usp=sharing)

2. Place the downloaded model file into the `backend/` folder of the project.

---

## 🔧 Backend Setup (Python + FastAPI)

1. Clone the repository and navigate into it:

   ```bash
   git clone <your-repo-url>
   cd <project-folder>
   ```

2. Create and activate a virtual environment:

   ```bash
   python -m venv venv
   source venv/bin/activate  # For Windows: venv\Scripts\activate
   ```

3. Install all Python dependencies:

   ```bash
   pip install -r requirements.txt
   ```
   
4. Start the backend server using Uvicorn (you have to be within the backend folder):

   ```bash
   uvicorn main:app --reload --port 8001
   ```

   The backend will run at:  
   📍 `http://localhost:8001`

---

## 🌐 Frontend Setup (React + Vite)

1. Navigate to the frontend folder (if applicable):

   ```bash
   cd frontend  # or wherever the frontend is located
   ```

2. Install frontend dependencies:

   ```bash
   npm install
   ```

3. Install required libraries:

   ```bash
   npm install react-router-dom axios recharts lucide-react react-chartjs-2 chart.js
   ```

4. Start the React app:

   ```bash
   npm run dev
   ```

   The app should open at:  
   📍 `http://localhost:5173`

---

## 🔐 OpenRouter AI Integration

1. Create a free account at **https://openrouter.ai**.
2. Get your **API key**.
3. Open the file:

   ```
   src/components/OpenRouterQA.jsx
   ```

4. Go to **line 126** (or wherever the `Authorization` header is set), and replace the existing key with your own:

   ```js
   headers: {
     "Authorization": "Bearer <your-api-key>",
     ...
   }
   ```

---

## 🧪 Final Checks

✅ MongoDB running  
✅ Backend running on `localhost:8001`  
✅ Frontend running on `localhost:5173`  
✅ OpenRouter API key added  
✅ ML model downloaded and placed in `/backend`  
✅ Collections loaded from Google Drive  

```
