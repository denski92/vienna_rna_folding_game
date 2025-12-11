/**
 * Frontend logic for the RNA Folding Game.
 * Handles initialization, click interaction, and mutation logic.
 */

// Initialize the visualization container
let container = new FornaContainer("#rna_container", {
    'animation': true,
    'zoomable': true,
    'applyForce': true
});

// State variables
let currentSequence = "GGGGAAAACCCC"; 
let targetStructure = "((((....))))"; // The goal we want to achieve (checking logic later)
let selectedNodeIndex = -1; 

function initGame() {
    let options = {
        'sequence': currentSequence,
        'structure': '((((....))))' // Initial structure (will update dynamically)
    };
    container.addRNA(options.structure, options);
    setTimeout(attachClickListeners, 500);
}

function attachClickListeners() {
    d3.selectAll('.node')
        .on('click', function(d) {
            selectedNodeIndex = d.num - 1; // 1-based to 0-based
            console.log("Selected Node:", selectedNodeIndex);

            let menu = document.getElementById('mutation-menu');
            menu.style.display = 'block';
            menu.style.left = (d3.event.pageX + 15) + 'px';
            menu.style.top = (d3.event.pageY + 15) + 'px';
            
            d3.event.stopPropagation();
        });

    // Close menu on click outside
    d3.select('body').on('click', function() {
        if (d3.event.target.tagName !== 'circle') {
             document.getElementById('mutation-menu').style.display = 'none';
        }
    });
}

/**
 * Called when the user clicks A, U, G, or C in the menu.
 * 1. Modifies the sequence string locally.
 * 2. Sends it to the Python backend to calculate physics.
 * 3. Updates the visualization with the result.
 */
function mutateNode(newBase) {
    // 1. Hide the menu immediately
    document.getElementById('mutation-menu').style.display = 'none';

    if (selectedNodeIndex === -1) return;

    // 2. Construct the new sequence string
    // Strings are immutable in JS, so we convert to array -> modify -> join
    let seqArray = currentSequence.split('');
    seqArray[selectedNodeIndex] = newBase;
    let nextSequence = seqArray.join('');

    console.log("Mutating index", selectedNodeIndex, "to", newBase);
    console.log("New Sequence:", nextSequence);

    // 3. Send to Backend
    fetch('/api/mutate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            sequence: nextSequence,
            target: targetStructure
        })
    })
    .then(response => response.json())
    .then(data => {
        // 4. Update Game State with Backend Data
        currentSequence = data.sequence;
        
        // Log physics data for debugging
        console.log("New Structure:", data.structure);
        console.log("Free Energy:", data.mfe);

        // 5. Update Visualization
        // We must clear the old nodes or Forna gets confused
        container.clearNodes(); 
        
        let options = {
            'sequence': data.sequence,
            'structure': data.structure
        };
        container.addRNA(options.structure, options);

        // 6. Re-attach listeners (because the nodes were deleted and recreated)
        setTimeout(attachClickListeners, 500);
    })
    .catch(error => console.error('Error:', error));
}

// Start
initGame();