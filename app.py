"""Backend for RNA Folding Game. Integrates Flask with ViennaRNA."""

from flask import Flask, render_template, request, jsonify
import RNA

app = Flask(__name__)

def calculate_metrics(sequence, target_structure):
    """Computes MFE structure and compares to target."""
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
    """Serves main game interface."""
    return render_template('index.html')

@app.route('/api/mutate', methods=['POST'])
def mutate_sequence():
    """API: Processes sequence mutation. Expects {"sequence": "...", "target": "..."}."""
    data = request.json
    sequence = data.get('sequence', '')
    target = data.get('target', '')

    if not all(n in "AUCG" for n in sequence):
        return jsonify({"error": "Invalid Nucleotides"}), 400

    result = calculate_metrics(sequence, target)
    return jsonify(result)

if __name__ == '__main__':
    # Runs the Flask development server.
    app.run(host='0.0.0.0', port=5000, debug=True)