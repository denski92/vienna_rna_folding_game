/**
 * Frontend logic for the RNA Folding Game.
 * Initializes the FornaContainer and renders a hardcoded RNA molecule
 * to verify integration with the visualization library.
 */

// Initialize the visualization container
let container = new FornaContainer("#rna_container", {
    'animation': true,
    'zoomable': true,
    'applyForce': true
});

/**
 * Renders the initial hardcoded sequence.
 * Sequence: GGGGCCCC
 * Structure: ((((....))))
 * This represents a simple hairpin loop, ideal for visual verification.
 */
function initGame() {
    let options = {
        'sequence': 'GGGGAAAACCCC',
        'structure': '((((....))))'
    };

    container.addRNA(options.structure, options);
}

// Execute initialization
initGame();