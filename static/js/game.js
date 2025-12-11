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
let targetStructure = "((((....))))";
let selectedNodeIndex = -1; 

function initGame() {
    let options = {
        'sequence': currentSequence,
        'structure': '((((....))))'
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

    // --- STEP 1: Capture current Zoom State ---
    let prevTranslate = [0,0];
    let prevScale = 1;
    if (container.zoomer) {
        prevTranslate = container.zoomer.translate(); 
        prevScale = container.zoomer.scale();         
    }

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

        // --- STEP 2: The "Monkey Patch" ---
        // Disable the auto-centering function temporarily
        let originalCenterView = container.center_view;
        container.center_view = function() {}; 

        container.addRNA(options.structure, options);

        // Restore the function
        container.center_view = originalCenterView;

        // --- STEP 3: Sync D3 ---
        // Ensure D3 internal state matches the visual state
        if (container.zoomer) {
            container.zoomer.translate(prevTranslate);
            container.zoomer.scale(prevScale);
        }

        setTimeout(attachClickListeners, 500);
    })
    .catch(error => console.error('Error:', error));
}

// Start
initGame();