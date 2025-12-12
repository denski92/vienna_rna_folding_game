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
let currentSequence = "GGGGGGGGAAAAAAAAACCCCCCCC"; 
let targetStructure = "((((((((.........))))))))";
let selectedNodeIndex = -1; 

function initGame() {
    let options = {
        'sequence': currentSequence,
        'structure': '((((((((.........))))))))'
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

    d3.select('body').on('click', function() {
        if (d3.event.target.tagName !== 'circle') {
             document.getElementById('mutation-menu').style.display = 'none';
        }
    });
}

function mutateNode(newBase) {
    document.getElementById('mutation-menu').style.display = 'none';
    if (selectedNodeIndex === -1) return;

    // 1. Capture Camera State (Zoom/Pan)
    let prevTranslate = [0,0];
    let prevScale = 1;
    if (container.zoomer) {
        prevTranslate = container.zoomer.translate(); 
        prevScale = container.zoomer.scale();         
    }

    // --- POSITION FIX START: Capture Molecule Position ---
    // Where is the molecule currently floating?
    let oldCentroid = getMoleculeCentroid();
    // ----------------------------------------------------

    let seqArray = currentSequence.split('');
    seqArray[selectedNodeIndex] = newBase;
    let nextSequence = seqArray.join('');

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
        currentSequence = data.sequence;
        
        container.clearNodes(); 
        
        let options = {
            'sequence': data.sequence,
            'structure': data.structure
        };

        // 2. Monkey Patch: Stop the camera from resetting
        let originalCenterView = container.center_view;
        container.center_view = function() {}; 

        // 3. Add the new RNA (It will be created at default coordinates)
        container.addRNA(options.structure, options);

        // --- POSITION FIX START: Shift New Molecule ---
        // Calculate where the new molecule spawned
        let newCentroid = getMoleculeCentroid();

        // Calculate the difference vector
        let deltaX = oldCentroid.x - newCentroid.x;
        let deltaY = oldCentroid.y - newCentroid.y;

        // Apply this offset to EVERY node in the new graph
        container.graph.nodes.forEach(node => {
            node.x += deltaX;
            node.y += deltaY;
            // D3 Force layout also uses 'px' (previous x) for physics
            node.px += deltaX;
            node.py += deltaY;
        });

        // Force Forna to recognize the moved nodes
        container.update();
        // ----------------------------------------------

        // Restore camera behavior
        container.center_view = originalCenterView;

        // 4. Sync D3 Camera
        if (container.zoomer) {
            container.zoomer.translate(prevTranslate);
            container.zoomer.scale(prevScale);
        }

        setTimeout(attachClickListeners, 500);
    })
    .catch(error => console.error('Error:', error));
}

/**
 * Calculates the geometric center (centroid) of the RNA molecule.
 * Used to keep the molecule in the same place after a mutation.
 */
function getMoleculeCentroid() {
    let nodes = container.graph.nodes;
    let sumX = 0, sumY = 0, count = 0;

    nodes.forEach(node => {
        // We only care about the actual nucleotides, not labels or helper nodes
        if (node.node_type === 'nucleotide') {
            sumX += node.x;
            sumY += node.y;
            count++;
        }
    });

    if (count === 0) return {x: 0, y: 0};
    return {x: sumX / count, y: sumY / count};
}

// Start
initGame();