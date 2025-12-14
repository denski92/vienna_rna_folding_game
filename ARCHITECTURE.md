# Project Context: RNA Builders

## Tech Stack
- **Frontend**: HTML5, CSS3, JavaScript (ES6+), D3.js, jQuery.
- **Backend**: Python (Flask).
- **Libraries**:
  - **ViennaRNA (RNAlib)**: Python bindings used on the backend for thermodynamic folding (`RNA.fold`) and base-pair distance calculations (`RNA.bp_distance`).
  - **Forna (fornac.js)**: JavaScript library used on the frontend for visualization of secondary structures.
  - **D3.js / jQuery**: Dependencies for Forna.

## File Structure

```text
/
├── app.py                -> Main Flask application. Handles API endpoints for folding.
├── environment.yml       -> Conda environment definition.
├── README.md             -> General project documentation.
├── setup_assets.py       -> Utility script for assets.
├── static/
│   ├── css/
│   │   ├── fornac.css    -> Styles required by the Forna container.
│   │   ├── style.css     -> Main stylesheet for the game layout and UI.
│   │   └── style.css.bak -> Backup of the stylesheet.
│   └── js/
│       ├── d3.js         -> Data-Driven Documents library (visualization dependency).
│       ├── fornac.js     -> Forna Container customization and library code.
│       ├── game.js       -> Main game logic: initialization, state, user interaction.
│       └── jquery.js     -> jQuery library (dependency).
└── templates/
    └── index.html        -> Main HTML template serving the single-page application.
```

## Library Integration

### ViennaRNA Setup
The **ViennaRNA** library is **not** loaded directly in the browser. Instead, it runs on the server side:
1. The Flask backend imports it via `import RNA`.
2. When a user mutates a sequence, the frontend sends a POST request to `/api/mutate`.
3. The backend uses `RNA.fold(sequence)` to compute the Minimum Free Energy (MFE) structure and `RNA.bp_distance` to compare it against the target.
4. The result (structure string, MFE value, distance) is returned as JSON to the client.

### Forna Setup
The **Forna** visualization library is loaded in the frontend:
1. `index.html` includes `d3.js` and `jquery.js` as prerequisites.
2. `fornac.js` is loaded afterwards.
3. In `game.js`, a `FornaContainer` is instantiated:
   ```javascript
   let container = new FornaContainer("#rna_container", { ...options... });
   ```
4. This container renders the SVG visualization of the RNA structure based on the dot-bracket string received from the backend.

## State Management

State is primarily managed on the client-side within `static/js/game.js`, with the backend acting as a stateless calculation engine.

### Core State Variables
- `currentSequence` (String): The active RNA sequence (e.g., "GGGG...CCCC").
- `targetStructure` (String): The goal secondary structure in dot-bracket notation.
- `selectedNodeIndex` (Integer): The 0-based index of the currently selected nucleotide in the sequence. `-1` denotes no selection.

### Logic Flow
1. **Level Selection**: `startLevel(index)` retrieves the level config from the `LEVELS` constant and initializes `currentSequence` and `targetStructure`.
2. **Interaction**: When a user clicks a node (`attachClickListeners`), `selectedNodeIndex` is updated, and the mutation menu is shown.
3. **Mutation**:
   - `mutateNode(newBase)` updates the character at `selectedNodeIndex` in the local `currentSequence`.
   - A `fetch` request sends the new sequence to the backend.
   - The UI waits for the backend response to update the visualization (`container.transitionRNA`) and metrics (MFE, Distance).
