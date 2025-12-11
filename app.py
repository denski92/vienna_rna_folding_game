"""
Backend server for the RNA Folding Game.
Integrates Flask with the ViennaRNA Python bindings (RNAlib) to perform
real-time thermodynamic folding and structure comparison.
"""

from flask import Flask, render_template, request, jsonify
import RNA

app = Flask(__name__)

def calculate_metrics(sequence, target_structure):
    """
    Computes the Minimum Free Energy (MFE) structure and compares it to the target.

    Args:
        sequence (str): The RNA sequence (AUCG).
        target_structure (str): The goal secondary structure in dot-bracket notation.

    Returns:
        dict: Contains the folded structure, MFE value, base-pair distance,
              and a boolean 'solved' flag.
    """
    current_structure, mfe = RNA.fold(sequence)
    distance = RNA.bp_distance(current_structure, target_structure)

    return {
        "sequence": sequence,
        "structure": current_structure,
        "mfe": round(mfe, 2),
        "distance": distance,
        "solved": (distance == 0)
    }

@app.route('/')
def index():
    """
    Serves the main game interface.
    """
    return render_template('index.html')

@app.route('/api/mutate', methods=['POST'])
def mutate_sequence():
    """
    API Endpoint: Processes a sequence mutation.

    Expected JSON payload:
    {
        "sequence": "GGG...CCC",
        "target": "((...))"
    }
    """
    data = request.json
    sequence = data.get('sequence', '')
    target = data.get('target', '')

    if not all(n in "AUCG" for n in sequence):
        return jsonify({"error": "Invalid Nucleotides"}), 400

    result = calculate_metrics(sequence, target)
    return jsonify(result)

if __name__ == '__main__':
    """
    Runs the Flask development server.
    Note: For the final kiosk deployment, a WSGI server like Waitress or Gunicorn
    should be used instead.
    """
    app.run(host='0.0.0.0', port=5000, debug=True)