import os
import json
import re
import zipfile
import xml.etree.ElementTree as ET

PPTX_PATH = r"c:\Users\dravi\OneDrive\Desktop\Derma n Bare.pptx"
OUTPUT_JSON = r"c:\Users\dravi\OneDrive\Desktop\derma_bare_chatbot\products.json"

def extract_raw_slide_texts():
    slides_data = []
    with zipfile.ZipFile(PPTX_PATH, 'r') as z:
        slide_files = [f for f in z.namelist() if f.startswith('ppt/slides/slide') and f.endswith('.xml')]
        slide_files.sort(key=lambda x: int(''.join(filter(str.isdigit, x.split('/')[-1]))))
        
        for sf in slide_files:
            tree = ET.fromstring(z.read(sf))
            texts = []
            for elem in tree.iter():
                if elem.tag.endswith('}t') and elem.text:
                    t = elem.text.strip()
                    if t:
                        texts.append(t)
            slides_data.append((sf, texts))
    return slides_data

def derive_concerns_and_type(brand, category, name, ingredients):
    text = (name + " " + ingredients + " " + category).lower()
    concerns = []
    
    # Skincare concern rules
    if any(k in text for k in ['acne', 'salicylic', 'sali-cinamide', 'breakout', 'blemish', 'pimples']):
        concerns.append('Acne & Blemishes')
    if any(k in text for k in ['kojic', 'arbutin', 'cica-glow', 'brighten', 'pigmentation', 'dark spot', 'vitamin c', 'tranexamic', 'licorice']):
        concerns.append('Pigmentation & Dark Spots')
    if any(k in text for k in ['hyaluronic', 'moistur', 'hydrat', 'dry', 'ceramide', 'oat', 'aqua gel']):
        concerns.append('Dryness & Hydration')
    if any(k in text for k in ['sunscreen', 'spf', 'pa++++', 'titanium dioxide', 'heat protection']):
        concerns.append('Sun Protection')
    if any(k in text for k in ['oil-free', 'pore', 'pha', 'zinc pca', 'oil control', 'matte', 'witch hazel']):
        concerns.append('Oil & Pore Control')
    if any(k in text for k in ['peel', 'glycolic', 'lactic', 'aha', 'retinol', 'anti-aging']):
        concerns.append('Exfoliation & Anti-Aging')
        
    # Haircare concern rules
    if any(k in text for k in ['dandruff', 'scalp', 'piroctone', 'neem', 'lemon']):
        concerns.append('Dandruff & Scalp Care')
    if any(k in text for k in ['hair growth', 'hair fall', 'redensyl', 'anagain', 'baicapil', 'rosemary', 'strengthening', 'adenosine']):
        concerns.append('Hair Fall & Growth')
    if any(k in text for k in ['frizz', 'smoothing', 'argan', 'ultra smoothing']):
        concerns.append('Frizz & Smoothness')
    if any(k in text for k in ['curl', 'defining']):
        concerns.append('Curl Care & Styling')
    if any(k in text for k in ['damage', 'repair', 'coconut milk', 'ceramide a2']):
        concerns.append('Damage Repair & Strengthening')
    if any(k in text for k in ['color', 'protect']):
        concerns.append('Color Protection')
    if any(k in text for k in ['volume', 'volumizing', 'root lift']):
        concerns.append('Volume & Thin Hair')
    if any(k in text for k in ['kids', 'junior']):
        concerns.append('Kids Care')
        
    if not concerns:
        if brand == "The Derma Co":
            concerns.append('Daily Skincare Maintenance')
        else:
            concerns.append('Hair Maintenance & Nourishment')
            
    return list(set(concerns))

def parse_catalog():
    slides = extract_raw_slide_texts()
    products = []
    
    current_brand = ""
    current_category = ""
    
    for sf, texts in slides:
        text_block = "\n".join(texts)
        
        # Check brand
        if "The Derma Co" in text_block:
            current_brand = "The Derma Co"
        elif "Bare Anatomy" in text_block:
            current_brand = "Bare Anatomy"
            
        # Check category headers
        if "Serums" in text_block and "Derma Co" in text_block:
            current_category = "Serums"
        elif "Sunscreens & Hair Care" in text_block:
            current_category = "Sunscreens & Hair Care"
        elif "Face Wash" in text_block:
            current_category = "Face Wash"
        elif "Moisturizers" in text_block:
            current_category = "Moisturizers"
        elif "Hair Serums" in text_block:
            current_category = "Hair Serums"
        elif "Shampoos" in text_block:
            current_category = "Shampoos"
        elif "Conditioners & Oils" in text_block:
            current_category = "Conditioners & Oils"
        elif "Hair Masks" in text_block:
            current_category = "Hair Masks"
        elif "Leave-In & Styling" in text_block:
            current_category = "Leave-In & Styling"
        elif "Hair Sprays" in text_block:
            current_category = "Hair Sprays"
            
        # Parse table rows containing prices (₹...)
        # Find indices of ₹
        for idx, t in enumerate(texts):
            if t.startswith('₹') or '₹' in t:
                price_str = t.replace('₹', '').replace(',', '').strip()
                try:
                    price = int(price_str)
                except ValueError:
                    continue
                    
                # Look backwards for product name and ingredients
                # In slide tables, row elements usually come as Name, Ingredients, Price OR in preceding lines
                if idx >= 2:
                    prod_name = texts[idx-2]
                    ingredients = texts[idx-1]
                    
                    # Sanity check if prod_name is actually a header like "Product" or "Price"
                    if prod_name in ["Product", "Key Contents / Ingredients", "Price"] or ingredients in ["Product", "Key Contents / Ingredients", "Price"]:
                        continue
                    if "—" in prod_name or "•" in prod_name or "Table" in prod_name:
                        continue
                        
                    concerns = derive_concerns_and_type(current_brand, current_category, prod_name, ingredients)
                    
                    # Extract size if present in prod_name (e.g. 30ml, 50g, 250ml)
                    size_match = re.search(r'–\s*([\d\w\s+–-]+)$|\b(\d+\s*(?:ml|g|gm|kg))\b', prod_name, re.IGNORECASE)
                    size = size_match.group(0).replace('–', '').strip() if size_match else "Standard Size"
                    
                    product_entry = {
                        "id": len(products) + 1,
                        "brand": current_brand,
                        "category": current_category,
                        "name": prod_name,
                        "size": size,
                        "ingredients": ingredients,
                        "price": price,
                        "currency": "INR",
                        "concerns": concerns,
                        "target_type": "Skincare" if current_brand == "The Derma Co" and current_category != "Sunscreens & Hair Care" or (current_category == "Sunscreens & Hair Care" and "Sunscreen" in prod_name) else "Haircare"
                    }
                    products.append(product_entry)
                    
    return products

if __name__ == "__main__":
    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    catalog = parse_catalog()
    print(f"Extracted {len(catalog)} products.")
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)
    print(f"Saved catalog to {OUTPUT_JSON}")
