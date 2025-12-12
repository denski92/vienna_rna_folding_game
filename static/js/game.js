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
// big testseq GGGGGGGGAAAAAAAAACCCCCCCCAAAAAAAGGGGGGGGAAAAAAAAACCCCCCCCAAAAAAAGGGGGGGGAAAAAAAAACCCCCCCCAAAAAAAGGGGGGGGAAAAAAAAACCCCCCCC
// big teststruc "((((((((.........)))))))).......((((((((.........)))))))).......((((((((.........)))))))).......((((((((.........))))))))";

// State variables
let currentSequence = "GGGGGGGGAAAAAAAAACCCUUCCC"; 
let targetStructure = "((((((((.........))))))))";
let selectedNodeIndex = -1; 

function initGame() {
    let options = {
        'sequence': currentSequence,
        'structure': targetStructure
    };
    container.addRNA(options.structure, options);
    setTimeout(attachClickListeners, 500);
}

function attachClickListeners() {
    d3.selectAll('.node')
        .on('click', function(d) {
            // 1. Ignore helper nodes
            if (d.node_type !== 'nucleotide') return;

            // 2. CLEAR Styles from ALL nodes (Reset to default CSS)
            d3.selectAll('.node')
              .style('stroke', null)        // Removes inline stroke
              .style('stroke-width', null)  // Removes inline width
              .style('filter', null)        // Removes inline glow
              .classed('selected', false);

            // 3. APPLY Styles to THIS node
            d3.select(this)
              .style('stroke', '#ffe343ff')         // Gold color
              .style('stroke-width', '3.8px')       // Thick border
              .style('stroke-opacity', '0.95')
              .style('filter', 'drop-shadow(0 0 3px #FFD700) drop-shadow(0 0 15px #FFD700)')
              

            selectedNodeIndex = d.num - 1; 
            console.log("Selected Node:", selectedNodeIndex);

            // 4. Show Menu
            let menu = document.getElementById('mutation-menu');
            menu.style.display = 'flex'; // Changed from 'block' to 'flex' to keep CSS layout
            
            // Offset slightly so it doesn't spawn exactly under the cursor
            // (15px to the right, 15px down)
            menu.style.left = (d3.event.pageX + 15) + 'px';
            menu.style.top = (d3.event.pageY + 15) + 'px';
            
            d3.event.stopPropagation();
        });

    // Background Click Listener (Reset everything)
    d3.select('body').on('click', function() {
        if (d3.event.target.tagName !== 'circle') {
             document.getElementById('mutation-menu').style.display = 'none';
             
             // Clear all manual styles
             d3.selectAll('.node')
               .style('stroke', null)
               .style('stroke-width', null)
               .style('filter', null);
               
             selectedNodeIndex = -1;
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


/* --- Settings Widget Logic --- */


document.addEventListener("DOMContentLoaded", function() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const closeSettingsBtn = document.getElementById('close-settings');
    const colorRadios = document.querySelectorAll('input[name="color-scheme"]');

    // 1. Monkey Patch Forna to use Custom Colors for "Sequence" Mode
    // We save the original function so we can still use it for other modes.
    const originalChangeColorScheme = container.changeColorScheme.bind(container);

    container.changeColorScheme = function(scheme) {
        // Let the original function run first (handles state updates and other modes)
        originalChangeColorScheme(scheme);

        // If the user wants "Nucleotide Type", we overwrite the pale colors with yours
        if (scheme === 'sequence') {
            const colorMap = {
                'A': '#FFD700', // Gold
                'U': '#1E90FF', // DodgerBlue
                'G': '#FF4500', // OrangeRed
                'C': '#32CD32', // LimeGreen
                'T': '#1E90FF'  // Treat T like U just in case
            };

            // Select all nucleotide nodes and apply the custom fill
            d3.selectAll('.node[node_type="nucleotide"]')
              .style('fill', function(d) {
                  return colorMap[d.name] || 'white';
              });
        }
    };

    // 2. Toggle Panel Visibility
    function toggleSettings() {
        settingsPanel.classList.toggle('hidden');
    }

    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSettings();
    });

    closeSettingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsPanel.classList.add('hidden');
    });

    // 3. Handle Radio Button Changes
    colorRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const scheme = e.target.value;
            // Call our patched function
            container.changeColorScheme(scheme);
        });
    });

    // 4. Close panel when clicking outside
    document.body.addEventListener('click', (e) => {
        if (!settingsPanel.contains(e.target) && e.target !== settingsBtn) {
            settingsPanel.classList.add('hidden');
        }
    });
});

// Start
initGame();