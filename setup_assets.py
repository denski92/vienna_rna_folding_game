"""
Utility script to download the correct static assets for the RNA Folding Game.
Run this once to ensure you have the clean, raw JavaScript libraries.
"""
import os
import requests

# Define the target directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JS_DIR = os.path.join(BASE_DIR, 'static', 'js')
CSS_DIR = os.path.join(BASE_DIR, 'static', 'css')

# Ensure directories exist
os.makedirs(JS_DIR, exist_ok=True)
os.makedirs(CSS_DIR, exist_ok=True)

# correct URL mapping
assets = {
    # D3 v3.5.17 (Required for Forna)
    os.path.join(JS_DIR, 'd3.js'): 
        'https://d3js.org/d3.v3.min.js',
    
    # jQuery 3.6.0
    os.path.join(JS_DIR, 'jquery.js'): 
        'https://code.jquery.com/jquery-3.6.0.min.js',

    # Fornac JS (Raw content)
    os.path.join(JS_DIR, 'fornac.js'): 
        'https://raw.githubusercontent.com/ViennaRNA/fornac/master/dist/fornac.js',

    # Fornac CSS (Raw content)
    os.path.join(CSS_DIR, 'fornac.css'): 
        'https://raw.githubusercontent.com/ViennaRNA/fornac/master/dist/fornac.css'
}

print("Downloading assets...")
for file_path, url in assets.items():
    print(f"Downloading {os.path.basename(file_path)}...")
    try:
        r = requests.get(url)
        r.raise_for_status()
        with open(file_path, 'wb') as f:
            f.write(r.content)
        print(f" -> Success! ({len(r.content)} bytes)")
    except Exception as e:
        print(f" -> Failed: {e}")

print("\nDone. Please restart your Flask server.")