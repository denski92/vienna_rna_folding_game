/**
 * Frontend logic for the RNA Folding Game.
 * Handles initialization, click interaction, mutation logic, and Level Management.
 */

// Initialize the visualization container
let container = new FornaContainer("#rna_container", {
    'animation': true,
    'zoomable': true,
    'applyForce': true
});

// Level Definitions
const LEVELS = [
    { 
        name: "The Hairpin",
        target: "((((((((.........))))))))",
        startSeq: "GGGGGGGGAAAAAAAAACCCCCCCC" // 25 nts
    },
    { 
        name: "Internal Loop",
        target: "((((((....((....))....))))))",
        startSeq: "GGGGGGAAAAGGGGAAAACCCCACCCCC" // 28 nts
    },
    { 
        name: "The Bulge",
        target: "((((((.((....)).))))))",
        startSeq: "GGGGGGUAAUUUUUAGCCCCCC" // 22 nts
    },
    { 
        name: "Twin Towers",
        target: "((((....)))).((((....))))",
        startSeq: "GGGGAAAACCCCGGGGAAAACCCC" // 25 nts
    },
    { 
        name: "The Cross",
        target: "((((..((...))..((...))..))))",
        startSeq: "GGGGUUGGGAAACCAAGGAAACCACCCC" // 28 nts
    },
    { 
        name: "Long Distance",
        target: "((((((((((....))))))))))",
        startSeq: "GGGGGGGGGGAAAACCCCCCCCCC" // 24 nts
    }
];

// Current State
let currentSequence = ""; 
let targetStructure = "";
let selectedNodeIndex = -1; 

/**
 * Called by HTML buttons: startLevel(0), startLevel(1), etc.
 */
function startLevel(lvlIndex) {
    const lvl = LEVELS[lvlIndex];
    if (!lvl) return;

    // 1. Set State
    currentSequence = lvl.startSeq;
    targetStructure = lvl.target;
    
    // 2. Update UI Titles
    document.getElementById('level-title').innerText = lvl.name;

    // 3. Switch Screens
    document.getElementById('level-menu').style.display = 'none';
    const gameView = document.getElementById('game-view');
    gameView.style.display = 'flex'; 
    
    // 4. CRITICAL FIX: Give the browser 50ms to render the div, 
    //    then trigger a resize so Forna knows how big the window is.
    setTimeout(() => {
        // 1. Tell Forna/Browser "The window size changed, check dimensions!"
        window.dispatchEvent(new Event('resize'));

        // 2. Now that dimensions are correct, draw the RNA
        initGame();
    }, 50);
}

/**
 * Return to Menu
 */
function showMenu() {
    document.getElementById('game-view').style.display = 'none';
    document.getElementById('level-menu').style.display = 'flex';
    
    // Optional: Clear container to save memory?
    container.clearNodes();
}

/**
 * Initializes the Forna Container with current data
 */
function initGame() {
    container.clearNodes();
    let options = {
        'sequence': currentSequence,
        'structure': targetStructure
    };
    
    // Calculate initial metrics immediately so the numbers aren't empty
    // (We do a dummy fetch or just set 0 if we assume start isn't solved)
    // For now, let's just render the RNA:
    container.addRNA(options.structure, options);
    
    // Reset metrics display
    document.getElementById('dist-val').innerText = "--";
    document.getElementById('mfe-val').innerText = "--";

    // Trigger an initial "mutate" call with the starting sequence 
    // to get the real initial MFE and Distance from the backend.
    fetch('/api/mutate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ sequence: currentSequence, target: targetStructure })
    })
    .then(r => r.json())
    .then(data => {
        updateMetrics(data);
        // Re-center after initial load
        setTimeout(() => container.center_view(), 100);
    });

    setTimeout(attachClickListeners, 500);
}

function updateMetrics(data) {
    document.getElementById('dist-val').innerText = data.distance;
    document.getElementById('mfe-val').innerText = data.mfe;
    
    // Color coding
    const distEl = document.getElementById('dist-val');
    if (data.distance === 0) {
        distEl.style.color = '#32CD32'; // Green
        distEl.innerText = "SOLVED!";
    } else {
        distEl.style.color = '#FF4500'; // Red
    }
}

function attachClickListeners() {
    d3.selectAll('.node')
        .on('click', function(d) {
            if (d.node_type !== 'nucleotide') return;

            // Clear previous styles
            d3.selectAll('.node')
              .style('stroke', null)
              .style('stroke-width', null)
              .style('filter', null)
              .classed('selected', false);

            // Highlight current
            d3.select(this)
              .style('stroke', '#ffe343ff')
              .style('stroke-width', '3.8px')
              .style('stroke-opacity', '0.95')
              .style('filter', 'drop-shadow(0 0 3px #FFD700) drop-shadow(0 0 15px #FFD700)');

            selectedNodeIndex = d.num - 1; 

            // Show Menu
            let menu = document.getElementById('mutation-menu');
            menu.style.display = 'flex';
            menu.style.left = (d3.event.pageX + 10) + 'px';
            menu.style.top = (d3.event.pageY + 10) + 'px';
            
            d3.event.stopPropagation();
        });

    d3.select('body').on('click', function() {
        if (d3.event.target.tagName !== 'circle') {
             document.getElementById('mutation-menu').style.display = 'none';
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

    let prevTranslate = [0,0], prevScale = 1;
    if (container.zoomer) {
        prevTranslate = container.zoomer.translate(); 
        prevScale = container.zoomer.scale();         
    }

    let oldCentroid = getMoleculeCentroid();

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
        let options = { 'sequence': data.sequence, 'structure': data.structure };

        let originalCenterView = container.center_view;
        container.center_view = function() {}; 

        container.addRNA(options.structure, options);

        // Position Fix
        let newCentroid = getMoleculeCentroid();
        let deltaX = oldCentroid.x - newCentroid.x;
        let deltaY = oldCentroid.y - newCentroid.y;

        container.graph.nodes.forEach(node => {
            node.x += deltaX; node.y += deltaY;
            node.px += deltaX; node.py += deltaY;
        });
        container.update();
        
        // Restore Camera
        container.center_view = originalCenterView;
        if (container.zoomer) {
            container.zoomer.translate(prevTranslate);
            container.zoomer.scale(prevScale);
        }

        updateMetrics(data);
        setTimeout(attachClickListeners, 500);
    })
    .catch(error => console.error('Error:', error));
}

function getMoleculeCentroid() {
    let nodes = container.graph.nodes;
    let sumX = 0, sumY = 0, count = 0;
    nodes.forEach(node => {
        if (node.node_type === 'nucleotide') {
            sumX += node.x; sumY += node.y; count++;
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

    // Monkey Patch Colors
    const originalChangeColorScheme = container.changeColorScheme.bind(container);
    container.changeColorScheme = function(scheme) {
        originalChangeColorScheme(scheme);
        if (scheme === 'sequence') {
             const colorMap = {
                'A': '#FFD700', 'a': '#FFD700',
                'U': '#1E90FF', 'u': '#1E90FF',
                'G': '#FF4500', 'g': '#FF4500',
                'C': '#32CD32', 'c': '#32CD32',
                'T': '#1E90FF', 't': '#1E90FF'
            };
            d3.selectAll('.node[node_type="nucleotide"]')
              .style('fill', function(d) { return colorMap[d.name] || 'white'; });
        }
    };

    function toggleSettings() { settingsPanel.classList.toggle('hidden'); }

    settingsBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleSettings(); });
    closeSettingsBtn.addEventListener('click', (e) => { e.stopPropagation(); settingsPanel.classList.add('hidden'); });
    colorRadios.forEach(radio => {
        radio.addEventListener('change', (e) => { container.changeColorScheme(e.target.value); });
    });
    document.body.addEventListener('click', (e) => {
        if (!settingsPanel.contains(e.target) && e.target !== settingsBtn) {
            settingsPanel.classList.add('hidden');
        }
    });

    // NOTE: initGame() is NOT called here anymore. 
    // The user must click a level button to trigger initGame().
});