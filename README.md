# RNA Folding Game

A "web-based" interactive game where players mutate RNA sequences (A, U, C, G) to achieve a target secondary structure. The application uses the **ViennaRNA** package for real-time thermodynamic folding and Minimum Free Energy (MFE) calculations.

## Features

- **Real-time Folding**: Instantly calculates the MFE structure of the RNA sequence using `RNAFold`.
- **Target Comparison**: Compares the user's current folded structure against a goal structure using base-pair distance.
- **Visual Feedback**: Uses **Fornac** (force-directed RNA graph visualization) to render the RNA structures.
- **Interactive Gameplay**: Users can modify the sequence and see immediate results.

## Prerequisites

- **Conda** is required to manage the environment and dependencies, like `viennarna`.

## Installation

1.  **Clone the repository:**
    ```bash
    git clone git@github.com:denski92/vienna_rna_folding_game.git
    cd vienna_rna_folding_game
    ```

2.  **Create and activate the Conda environment:**
    This will install Python 3.10, Flask, ViennaRNA, and other dependencies.
    ```bash
    conda env create -f environment.yml
    conda activate rna_game
    ```

## Running the Game

1.  **Start the Flask server:**
    ```bash
    python app.py
    ```

2.  **Play:**
    Open your web browser and navigate to:
    ```
    http://localhost:5000
    ```

## Project Structure

- **`app.py`**: The main Flask application. Handles routes and the `/api/mutate` endpoint for folding calculations.
- **`environment.yml`**: Conda environment definition file.
- **`templates/`**: Contains the HTML templates (e.g., `index.html`).
- **`static/`**: Hosts static files (CSS, JavaScript, images).

## Technologies Used

- **Flask**: Python web framework.
- **ViennaRNA**: Python bindings (`RNAFold`) for RNA secondary structure prediction.
- **Fornac**: RNA secondary structure visualization container.
- **D3.js & jQuery**: Frontend libraries for visualization and DOM manipulation.

