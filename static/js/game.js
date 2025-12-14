/**
 * Frontend logic: Initialization, interaction, mutation, and Level Management.
 */

// Initialize the visualization container
let container = new FornaContainer("#rna_container", {
    'animation': true,
    'zoomable': true,
    'applyForce': true
});

// Initialize target container (Non-interactive)
let targetContainer = new FornaContainer("#target-rna-container", {
    'animation': true,
    'zoomable': false,
    'allowPanning': false,
    'applyForce': true
});

// Level Definitions
const LEVELS = [
    {
        name: "The Hairpin",
        target: "((((((.......))))))",
        startSeq: "GGGGGGAAAAAAACCCCCC"
    },
    {
        name: "Internal Loop",
        target: "((((((....((....))....))))))",
        startSeq: "GGGGGGAAAAGGAAAACCAAAACCCCCC"
    },
    {
        name: "The Bulge",
        target: "((((((.((....)).))))))",
        startSeq: "GGGGGGUAAUUUUUAGCCCCCC"
    },
    {
        name: "Twin Towers",
        target: "((((....)))).((((....))))",
        startSeq: "GGGGAAAACCCCAGGGGAAAACCCC"
    },
    {
        name: "The Cross",
        target: "((((..((...))..((...))..))))",
        startSeq: "GGGGAAGGAAACCAAGGAAACCAACCCC"
    },
    {
        name: "Long Distance",
        target: "((((((((((....))))))))))",
        startSeq: "GGGGGGGGGGAAAACCCCCCCCCC"
    }
];

// Current State
let currentSequence = "";
let targetStructure = "";
let selectedNodeIndex = -1;

/**
 * Start Level
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

    // 4. FIX: Allow render time, then resize for Forna.
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        initGame();
    }, 50);

    // 5. Init Target Container
    setTimeout(() => {
        targetContainer.clearNodes();
        targetContainer.addRNA(targetStructure, {
            sequence: " ".repeat(targetStructure.length), // Hide letters
            structure: targetStructure
        });

        setTimeout(() => {
            updateTargetHighlighting(lvl.startSeq);
            targetContainer.center_view();
        }, 100);
    }, 100);
}

/**
 * Return to Menu
 */
function showMenu() {
    document.getElementById('game-view').style.display = 'none';
    document.getElementById('level-menu').style.display = 'flex';

    // Optional: Clear container to save memory?
    container.clearNodes();
    targetContainer.clearNodes();
}

/**
 * Init Forna Container
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
        headers: { 'Content-Type': 'application/json' },
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
        .on('click', function (d) {
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

    d3.select('body').on('click', function () {
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

    // 1. Capture Camera
    let prevTranslate = [0, 0], prevScale = 1;
    if (container.zoomer) {
        prevTranslate = container.zoomer.translate();
        prevScale = container.zoomer.scale();
    }

    let seqArray = currentSequence.split('');
    seqArray[selectedNodeIndex] = newBase;
    let nextSequence = seqArray.join('');

    fetch('/api/mutate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sequence: nextSequence,
            target: targetStructure
        })
    })
        .then(response => response.json())
        .then(data => {
            currentSequence = data.sequence;

            // Update Target Highlights based on new structure
            updateTargetHighlighting(data.structure);

            // 2. Morph to new structure
            if (typeof container.transitionRNA === 'function') {
                container.transitionRNA(data.structure, {
                    sequence: data.sequence,
                    duration: 900
                });
            } else {
                container.clearNodes();
                container.addRNA(data.structure, { sequence: data.sequence });
            }

            // 3. Restore Zoom/Pan
            if (container.zoomer) {
                container.zoomer.translate(prevTranslate);
                container.zoomer.scale(prevScale);
            }

            updateMetrics(data);
            setTimeout(attachClickListeners, 500);
        })
        .catch(error => console.error('Error:', error));
}

/**
 * Updates target structure highlights.
 */
function updateTargetHighlighting(currentStructureString) {
    if (!targetStructure || !currentStructureString) return;

    // Simple dot-bracket parser to get pair map: [index -> pairIndex or -1]

    function getPairMap(structure) {
        let stack = [];
        let map = new Array(structure.length).fill(-1);
        for (let i = 0; i < structure.length; i++) {
            if (structure[i] === '(') {
                stack.push(i);
            } else if (structure[i] === ')') {
                let open = stack.pop();
                if (open !== undefined) {
                    map[open] = i;
                    map[i] = open;
                }
            }
        }
        return map;
    }

    const targetPairs = getPairMap(targetStructure);
    const currentPairs = getPairMap(currentStructureString);

    // Identify which indices are correct
    let correctIndices = new Set();
    for (let i = 0; i < targetPairs.length; i++) {
        if (targetPairs[i] === currentPairs[i]) {
            correctIndices.add(i);
        }
    }

    // Apply styles to targetContainer nodes
    d3.select("#target-rna-container").selectAll('.node')
        .classed('correct', function (d) {
            return correctIndices.has(d.num - 1);
        });
}

function getMoleculeCentroid() {
    let nodes = container.graph.nodes;
    let sumX = 0, sumY = 0, count = 0;
    nodes.forEach(node => {
        if (node.node_type === 'nucleotide') {
            sumX += node.x; sumY += node.y; count++;
        }
    });
    if (count === 0) return { x: 0, y: 0 };
    return { x: sumX / count, y: sumY / count };
}

/* --- Settings Widget Logic --- */
document.addEventListener("DOMContentLoaded", function () {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const closeSettingsBtn = document.getElementById('close-settings');
    const colorRadios = document.querySelectorAll('input[name="color-scheme"]');

    // Monkey Patch Colors
    const originalChangeColorScheme = container.changeColorScheme.bind(container);
    container.changeColorScheme = function (scheme) {
        originalChangeColorScheme(scheme);
        if (scheme === 'sequence') {
            const colorMap = {
                'A': '#FFD700', 'a': '#FFD700',
                'U': '#1E90FF', 'u': '#1E90FF',
                'G': '#FF4500', 'g': '#FF4500',
                'C': '#32CD32', 'c': '#32CD32',
                'T': '#1E90FF', 't': '#1E90FF'
            };
            // Only apply to MAIN container
            d3.select("#rna_container").selectAll('.node[node_type="nucleotide"]')
                .style('fill', function (d) { return colorMap[d.name] || 'white'; });
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

    // Init is triggered by level buttons.

    attachMenuHoverListeners();
});

function attachMenuHoverListeners() {
    const pairs = {
        'A': ['line-AU'],
        'U': ['line-AU', 'line-GU'],
        'G': ['line-GC', 'line-GU'],
        'C': ['line-GC']
    };

    document.querySelectorAll('.base-btn').forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            const base = btn.innerText; // or data-base if added
            const lineIds = pairs[base];
            if (lineIds) {
                lineIds.forEach(id => {
                    const line = document.getElementById(id);
                    if (line) line.classList.add('glow');
                });
            }
        });

        btn.addEventListener('mouseleave', () => {
            const base = btn.innerText;
            const lineIds = pairs[base];
            if (lineIds) {
                lineIds.forEach(id => {
                    const line = document.getElementById(id);
                    if (line) line.classList.remove('glow');
                });
            }
        });
    });
}