import os
import json
import requests
from pathlib import Path
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = "gemini-3.6-flash"
GEMINI_ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent?key={GEMINI_API_KEY}"

app = Flask(__name__)

# Load catalog data
CATALOG_PATH = Path(__file__).parent / "products.json"
products_data = []
if CATALOG_PATH.exists():
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        products_data = json.load(f)

def build_system_prompt():
    prompt = """You are 'Derma & Bare AI', an expert, helpful, and empathetic Beauty & Skincare/Haircare Consultant representing two premier brands:
1. 'The Derma Co' - Active ingredient-focused science-backed skincare (Serums, Sunscreens, Cleansers, Peelings, Moisturizers).
2. 'Bare Anatomy' - Advanced personalized and botanical haircare (Shampoos, Conditioners, Serums, Masks, Styling).

Here is the exact official product catalog data you have access to:
"""
    for p in products_data:
        prompt += f"- ID {p['id']}: [{p['brand']}] {p['name']} ({p['size']}) - Price: ₹{p['price']} | Category: {p['category']} | Target: {p['target_type']} | Ingredients: {p['ingredients']} | Concerns: {', '.join(p.get('concerns', []))}\n"

    prompt += """
GUIDELINES FOR YOUR RESPONSES:
- Provide clear, professional, warm, and highly structured advice.
- When users mention skin issues (e.g. acne, dark spots, dryness, oiliness) or hair issues (e.g. hair fall, dandruff, frizz, damage), recommend exact products from the catalog above with exact prices in ₹ and key active ingredients.
- Explain WHY each recommended product helps based on its ingredients (e.g., Salicylic Acid unclogs pores, Niacinamide controls oil, Vitamin C brightens, Redensyl stimulates hair growth, Hyaluronic Acid hydrates).
- Recommend proper application routines (e.g. Cleanser -> Active Serum -> Moisturizer -> Sunscreen for morning; Shampoos -> Conditioner/Mask -> Leave-in serum for hair).
- Format responses cleanly using Markdown (bullet points, bold text for product names, rupee symbols for prices).
- If a user asks about prices or comparisons under a certain budget (e.g. under ₹500), filter the catalog and list the matching products with prices.
- Be polite, encouraging, and informative. If asked something completely unrelated to skincare, haircare, or these brands, gently redirect to skincare and haircare advice.
"""
    return prompt

SYSTEM_PROMPT = build_system_prompt()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/products", methods=["GET"])
def get_products():
    brand = request.args.get("brand", "").strip()
    category = request.args.get("category", "").strip()
    concern = request.args.get("concern", "").strip()
    target_type = request.args.get("target_type", "").strip()
    search = request.args.get("search", "").strip().lower()
    max_price = request.args.get("max_price", type=float)

    filtered = []
    for p in products_data:
        if brand and brand.lower() != "all" and p["brand"].lower() != brand.lower():
            continue
        if category and category.lower() != "all" and p["category"].lower() != category.lower():
            continue
        if target_type and target_type.lower() != "all" and p["target_type"].lower() != target_type.lower():
            continue
        if concern and concern.lower() != "all":
            concerns_lower = [c.lower() for c in p.get("concerns", [])]
            if not any(concern.lower() in c for c in concerns_lower):
                continue
        if max_price and p["price"] > max_price:
            continue
        if search:
            match_text = (p["name"] + " " + p["brand"] + " " + p["ingredients"] + " " + p["category"] + " " + " ".join(p.get("concerns", []))).lower()
            if search not in match_text:
                continue
        filtered.append(p)

    return jsonify({"status": "success", "count": len(filtered), "products": filtered})

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json or {}
    user_message = data.get("message", "").strip()
    history = data.get("history", [])

    if not user_message:
        return jsonify({"status": "error", "message": "Message content cannot be empty."}), 400

    # Build Gemini request payload
    contents = []
    # Add system context as first message turn
    contents.append({
        "role": "user",
        "parts": [{"text": f"System Context & Instructions:\n{SYSTEM_PROMPT}\n\nAcknowledge instructions."}]
    })
    contents.append({
        "role": "model",
        "parts": [{"text": "Understood. I am Derma & Bare AI consultant ready to assist users with personalized skincare and haircare routines using The Derma Co and Bare Anatomy catalog."}]
    })

    # Add past chat history (up to last 10 messages)
    for msg in history[-10:]:
        role = "user" if msg.get("sender") == "user" else "model"
        text = msg.get("text", "")
        if text:
            contents.append({
                "role": role,
                "parts": [{"text": text}]
            })

    # Add current user message
    contents.append({
        "role": "user",
        "parts": [{"text": user_message}]
    })

    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 1000
        }
    }

    try:
        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is missing.")

        resp = requests.post(GEMINI_ENDPOINT, json=payload, timeout=20)
        if resp.status_code == 200:
            res_data = resp.json()
            try:
                reply_text = res_data["candidates"][0]["content"]["parts"][0]["text"]
                return jsonify({"status": "success", "reply": reply_text})
            except (KeyError, IndexError):
                pass
        
        # Fallback response if API responds with non-200 or unexpected structure
        print(f"Gemini API returned status {resp.status_code}: {resp.text}")
        reply_text = generate_smart_fallback(user_message)
        return jsonify({"status": "success", "reply": reply_text, "fallback": True})

    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        reply_text = generate_smart_fallback(user_message)
        return jsonify({"status": "success", "reply": reply_text, "fallback": True})

def generate_smart_fallback(query):
    """Rule-based intelligent fallback matching products from catalog"""
    q = query.lower()
    matched_prods = []
    for p in products_data:
        text = (p["name"] + " " + p["brand"] + " " + p["ingredients"] + " " + " ".join(p.get("concerns", []))).lower()
        if any(term in text for term in q.split() if len(term) > 3):
            matched_prods.append(p)
            if len(matched_prods) >= 4:
                break

    if not matched_prods:
        matched_prods = products_data[:3]

    reply = f"Here are top recommendations from **Derma & Bare** catalog tailored for your query:\n\n"
    for p in matched_prods:
        reply += f"• **{p['brand']} - {p['name']}** ({p['size']})\n"
        reply += f"  - **Price**: ₹{p['price']}\n"
        reply += f"  - **Key Ingredients**: {p['ingredients']}\n"
        reply += f"  - **Best For**: {', '.join(p.get('concerns', []))}\n\n"
    
    reply += "💡 *Tip: Check out the Product Explorer tab to filter the complete catalog by skin/hair concern!*"
    return reply

@app.route("/api/recommend", methods=["POST"])
def recommend():
    data = request.json or {}
    care_type = data.get("care_type", "both") # skincare, haircare, both
    concerns = data.get("concerns", [])
    max_budget = data.get("budget", 2000)

    recommended = []
    for p in products_data:
        if care_type == "skincare" and p["target_type"] != "Skincare":
            continue
        if care_type == "haircare" and p["target_type"] != "Haircare":
            continue
        if p["price"] > max_budget:
            continue
        
        # Check concern match
        p_concerns = [c.lower() for c in p.get("concerns", [])]
        if not concerns or any(c.lower() in " ".join(p_concerns) for c in concerns):
            recommended.append(p)

    return jsonify({
        "status": "success",
        "count": len(recommended),
        "recommendations": recommended[:6]
    })

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    print(f"Starting Derma n Bare AI Chatbot Server on http://localhost:{port} ...")
    app.run(host="0.0.0.0", port=port, debug=True)
