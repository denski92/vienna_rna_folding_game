/**
 * Frontend logic: Initialization, interaction, mutation, and Level Management.
 */

// Initialize the visualization container
let container = new FornaContainer("#rna_container", {
    'animation': true,
    'zoomable': true,
    'applyForce': true,
    'displayBackground': false,
    'labelInterval': 5
});

// Initialize target container (Non-interactive)
let targetContainer = new FornaContainer("#target-rna-container", {
    'animation': true,
    'zoomable': false,
    'allowPanning': false,
    'applyForce': true,
    'labelInterval': 5
});

// Level Definitions
const LEVELS = [
    {
        name: "The Hairpin",
        target: "(((((.....)))))",
        startSeq: "AUGGGUUAAACCCAU"
    },
    {
        name: "Internal Loop",
        target: "(((...((...))...)))",
        startSeq: "GGGAAAGGAAACCAAACCC"
    },
    {
        name: "The Bulge",
        target: "(((.((....)))))",
        startSeq: "GGGUAAUUUUUGCCC"
    },
    {
        name: "Twin Towers",
        target: "((((...)))).((((...))))",
        startSeq: "GGGGAAACCCCACCCCAAAGGGG"
    },
    {
        name: "The Cross",
        target: "((((..(((...)))..(((...)))..))))",
        startSeq: "UGCGAAGCCAGAGGCCAGGGACCCCCAACGCG"
    },
    {
        name: "tRNA",
        target: "(((((((..((((.........))))...((((((...))))))....(((((.......)))))))))))).",
        startSeq: "GCCCCUAUCGUCUAGUGGUUCAGGACAUCUCUCUUUCAAGGAGGCAGCGGGGAUUCGACUUCCCCUGGGGGUA"
    }
];

// Current State
let currentSequence = "";
let targetStructure = "";
let selectedNodeIndex = -1;
let mutationHistory = []; // Stack for undo functionality
let currentDifficulty = "EASY";
let isLevelSolvedAndContinued = false; // Flag to suppress popup if user wants to keep tinkering
let currentLevelIndex = -1; // Track which level we are playing
let levelProgress = {}; // { levelIndex: { 'EASY': bool, 'NORMAL': bool, 'EXTREME': bool } }

function setDifficulty(diff) {
    currentDifficulty = diff;

    // Update UI
    const buttons = document.querySelectorAll('.diff-btn');
    buttons.forEach(btn => {
        if (btn.innerText.toUpperCase() === diff) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

/**
 * Helper to mutate a sequence n times randomly.
 */
function mutateSequence(sequence, numMutations) {
    let seqArray = sequence.split('');
    let indices = [];

    // Create an array of all possible indices
    for (let i = 0; i < seqArray.length; i++) {
        indices.push(i);
    }

    // Shuffle indices to pick random ones
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    // Pick the first n indices
    let distinctIndices = indices.slice(0, numMutations);

    const bases = ['A', 'U', 'G', 'C'];

    distinctIndices.forEach(idx => {
        let oldBase = seqArray[idx];
        let newBase = oldBase;

        // Pick a new base different from the old one
        while (newBase === oldBase) {
            newBase = bases[Math.floor(Math.random() * bases.length)];
        }
        seqArray[idx] = newBase;
    });

    return seqArray.join('');
}

/**
 * Start Level
 */
function startLevel(lvlIndex) {
    const lvl = LEVELS[lvlIndex];
    if (!lvl) return;

    currentLevelIndex = lvlIndex; // Store current level index

    // 1. Set State
    // Apply difficulty logic
    let mutationCount = 3;
    if (currentDifficulty === 'NORMAL') mutationCount = 5;
    if (currentDifficulty === 'EXTREME') mutationCount = 10;

    currentSequence = mutateSequence(lvl.startSeq, mutationCount);

    targetStructure = lvl.target;

    // 2. Update UI Titles
    document.getElementById('level-title').innerText = lvl.name;

    // 3. Switch Screens
    document.getElementById('level-menu').style.display = 'none';
    const gameView = document.getElementById('game-view');
    gameView.style.display = 'flex';

    // 4. Init Target Container FIRST
    setTimeout(() => {
        targetContainer.clearNodes();
        targetContainer.addRNA(targetStructure, {
            sequence: " ".repeat(targetStructure.length), // Hide letters
            structure: targetStructure,
            'labelInterval': 5
        });

        // Center view for target
        targetContainer.center_view();

        // 5. THEN Init Game (Main Container)
        // This ensures mismatch highlighting works because targetContainer is ready.
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
            initGame();
        }, 50);

    }, 50);

    // 6. Reset History
    mutationHistory = [];
    isLevelSolvedAndContinued = false; // Reset flag on new level
    isHelpViewActive = false;
    savedMFEPositions = null;
    document.getElementById('help-btn').classList.remove('active');
    updateUndoUI();
}

/**
 * Return to Menu
 */
function showMenu() {
    document.getElementById('game-view').style.display = 'none';
    document.getElementById('celebration-overlay').style.display = 'none'; // Hide popup if open
    document.getElementById('level-menu').style.display = 'flex';

    renderLevelMenu(); // Update pips

    // Optional: Clear container to save memory?
    container.clearNodes();
    targetContainer.clearNodes();
}

/**
 * Init Forna Container
 */
function initGame() {
    container.clearNodes();

    // Display nothing or a loader initially? 
    // container is already cleared.

    // Trigger an initial "mutate" call with the starting sequence 
    // to get the real initial MFE and Distance from the backend.
    fetch('/api/mutate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequence: currentSequence, target: targetStructure })
    })
        .then(r => r.json())
        .then(data => {
            // Render the RNA with the calculated structure logic
            let options = {
                'sequence': currentSequence,
                'structure': data.structure, // Use calculated MFE structure
                'labelInterval': 5
            };

            container.addRNA(data.structure, options);

            updateMetrics(data);
            updateTargetHighlighting(data.structure);

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
        distEl.style.textShadow = '0 0 10px rgba(50, 205, 50, 0.4)';
        distEl.innerText = "SOLVED!";

        // Show Celebration Popup ONLY if not tinkered
        if (!isLevelSolvedAndContinued) {
            // Mark Level as Completed for this difficulty
            if (currentLevelIndex !== -1) {
                if (!levelProgress[currentLevelIndex]) levelProgress[currentLevelIndex] = {};
                levelProgress[currentLevelIndex][currentDifficulty] = true;
            }

            document.getElementById('celebration-overlay').style.display = 'flex';
        }
    } else {
        distEl.style.color = '#FF4500'; // Red
        distEl.style.textShadow = '0 0 10px rgba(255, 69, 0, 0.4)';
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

            // Highlight corresponding node in target container
            d3.select("#target-rna-container").selectAll('.node')
                .filter(function (t) { return t.num === d.num; })
                .style('stroke', '#ffe343ff', 'important')
                .style('stroke-width', '6px', 'important')
                .style('stroke-opacity', '0.95', 'important')
                .style('filter', 'drop-shadow(0 0 3px #FFD700) drop-shadow(0 0 15px #FFD700)', 'important');

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

function mutateNode(newBase, recordHistory = true) {

    document.getElementById('mutation-menu').style.display = 'none';
    if (selectedNodeIndex === -1) return;

    // Reset help view if active
    if (isHelpViewActive) {
        clearHelpHighlighting();
        isHelpViewActive = false;
        savedMFEPositions = null;
        document.getElementById('help-btn').classList.remove('active');
    }

    // 1. Capture Camera
    let prevTranslate = [0, 0], prevScale = 1;
    if (container.zoomer) {
        prevTranslate = container.zoomer.translate();
        prevScale = container.zoomer.scale();
    }

    let seqArray = currentSequence.split('');
    let oldBase = seqArray[selectedNodeIndex];

    // Safety check: don't mutate if same base
    if (oldBase === newBase) return;

    if (recordHistory) {
        mutationHistory.push({
            index: selectedNodeIndex,
            oldBase: oldBase
        });
        updateUndoUI();
    }

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
        })
        .classed('wrong', function (d) {
            return !correctIndices.has(d.num - 1);
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


function undoLastMutation() {
    if (mutationHistory.length === 0) return;

    const lastStep = mutationHistory.pop();

    // Select the node we are undoing (visual feedback)
    selectedNodeIndex = lastStep.index;

    // Apply mutation back to old base, but DO NOT record it in history again
    mutateNode(lastStep.oldBase, false);
    updateUndoUI();
}

function updateUndoUI() {
    const btn = document.getElementById('undo-btn');
    const countSpan = document.getElementById('undo-count');

    if (mutationHistory.length > 0) {
        btn.style.display = 'flex';
        countSpan.innerText = mutationHistory.length;
    } else {
        btn.style.display = 'none';
    }
}

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
/**
 * Handle "Keep Tinkering" Action
 */
function keepTinkering() {
    isLevelSolvedAndContinued = true;
    document.getElementById('celebration-overlay').style.display = 'none';
}

function renderLevelMenu() {
    // Loop through all level cards
    const cards = document.querySelectorAll('.level-card');
    cards.forEach(card => {
        const lvlIdx = parseInt(card.getAttribute('data-level'));
        if (isNaN(lvlIdx)) return;

        const progress = levelProgress[lvlIdx];
        if (!progress) return; // No progress for this level yet

        // Update Pips
        if (progress['EASY']) card.querySelector('.pip.easy').classList.add('done');
        if (progress['NORMAL']) card.querySelector('.pip.normal').classList.add('done');
        if (progress['EXTREME']) card.querySelector('.pip.extreme').classList.add('done');

        // Check for Full Completion
        if (progress['EASY'] && progress['NORMAL'] && progress['EXTREME']) {
            card.classList.add('fully-solved');
        }
    });
}

// --- Help View (Lightbulb) ---
let isHelpViewActive = false;
let savedMFEPositions = null; // Stores nucleotide positions from the MFE layout
let lastKnownMFEStructure = ""; // Store the last MFE structure string

/**
 * Toggle the help view: morph nucleotide positions to target structure layout
 * while keeping the current MFE basepairs intact. This lets the user see which
 * basepairs are wrong in the context of the target geometry.
 */
function toggleHelpView() {
    if (!targetStructure || !container.graph.nodes.length) return;

    const rnaKeys = Object.keys(container.rnas);
    if (!rnaKeys.length) return;
    const rna = container.rnas[rnaKeys[0]];

    const btn = document.getElementById('help-btn');
    const duration = 900;

    if (!isHelpViewActive) {
        // --- Activate Help View: Move to target positions ---

        // Save current nucleotide positions so we can restore later
        savedMFEPositions = rna.get_positions('nucleotide');

        // Compute target layout positions from the target structure
        const targetLayout = container.createInitialLayout(targetStructure, {
            sequence: ' '.repeat(targetStructure.length),
            labelInterval: container.options.labelInterval
        });

        // Get target nucleotide positions
        let targetNuc = targetLayout.get_positions('nucleotide');
        let targetLabel = targetLayout.get_positions('label');
        let targetMiddle = targetLayout.nodes
            .filter(function(n) { return n.node_type === 'middle'; })
            .map(function(n) { return [n.x, n.y]; });

        // Get current positions for alignment
        const currentNuc = rna.get_positions('nucleotide');
        const currentLabel = rna.get_positions('label');

        // Align target to current orientation using bestFitTransform
        const transform = bestFitTransform(currentNuc, targetNuc);
        targetNuc = targetNuc.map(transform);
        targetLabel = targetLabel.map(transform);
        targetMiddle = targetMiddle.map(transform);

        // Stop force layout during transition
        container.force.stop();

        // Animate nodes to target positions without changing graph structure
        const linkSel = d3.select('#rna_container').select('svg').selectAll('line.link');
        const labelNodes = rna.nodes.filter(function(n) { return n.node_type === 'label'; });
        const middleNodes = rna.nodes.filter(function(n) { return n.node_type === 'middle'; });
        const gnodes = d3.select('#rna_container').selectAll('g.gnode');

        let total = 0, done = 0;
        gnodes.each(function() { total++; });

        gnodes.transition().duration(duration).tween('helpMorph', function(node) {
            var target;
            if (node.node_type === 'nucleotide') {
                target = targetNuc[node.num - 1];
            } else if (node.node_type === 'label') {
                target = targetLabel[labelNodes.indexOf(node)];
            } else if (node.node_type === 'middle') {
                // Find the closest matching middle node position
                var idx = middleNodes.indexOf(node);
                target = idx >= 0 && idx < targetMiddle.length ? targetMiddle[idx] : null;
            }
            if (!target) return function() {};

            var ix = d3.interpolateNumber(node.x, target[0]);
            var iy = d3.interpolateNumber(node.y, target[1]);

            return function(t) {
                node.x = ix(t);
                node.y = iy(t);
                node.px = node.x;
                node.py = node.y;
                d3.select(this).attr('transform', 'translate(' + node.x + ',' + node.y + ')');
                linkSel
                    .attr('x1', function(l) { return l.source.x; })
                    .attr('y1', function(l) { return l.source.y; })
                    .attr('x2', function(l) { return l.target.x; })
                    .attr('y2', function(l) { return l.target.y; });
            };
        });

        // Apply correctness pulsing to nucleotides
        applyHelpHighlighting(rna.dotbracket);

        btn.classList.add('active');
        isHelpViewActive = true;

    } else {
        // --- Deactivate Help View: Move back to MFE positions ---

        if (!savedMFEPositions) return;

        container.force.stop();

        // Align saved positions to current orientation
        const currentNuc = rna.get_positions('nucleotide');

        // Recompute MFE layout positions fresh to ensure they're correct
        const mfeLayout = container.createInitialLayout(rna.dotbracket, {
            sequence: rna.seq,
            labelInterval: container.options.labelInterval
        });

        let mfeNuc = mfeLayout.get_positions('nucleotide');
        let mfeLabel = mfeLayout.get_positions('label');
        let mfeMiddle = mfeLayout.nodes
            .filter(function(n) { return n.node_type === 'middle'; })
            .map(function(n) { return [n.x, n.y]; });

        // Align MFE layout to current view orientation
        const transform = bestFitTransform(currentNuc, mfeNuc);
        mfeNuc = mfeNuc.map(transform);
        mfeLabel = mfeLabel.map(transform);
        mfeMiddle = mfeMiddle.map(transform);

        const linkSel = d3.select('#rna_container').select('svg').selectAll('line.link');
        const labelNodes = rna.nodes.filter(function(n) { return n.node_type === 'label'; });
        const middleNodes = rna.nodes.filter(function(n) { return n.node_type === 'middle'; });
        const gnodes = d3.select('#rna_container').selectAll('g.gnode');

        let total = 0, done = 0;
        gnodes.each(function() { total++; });

        gnodes.transition().duration(duration).tween('helpMorphBack', function(node) {
            var target;
            if (node.node_type === 'nucleotide') {
                target = mfeNuc[node.num - 1];
            } else if (node.node_type === 'label') {
                target = mfeLabel[labelNodes.indexOf(node)];
            } else if (node.node_type === 'middle') {
                var idx = middleNodes.indexOf(node);
                target = idx >= 0 && idx < mfeMiddle.length ? mfeMiddle[idx] : null;
            }
            if (!target) return function() {};

            var ix = d3.interpolateNumber(node.x, target[0]);
            var iy = d3.interpolateNumber(node.y, target[1]);

            return function(t) {
                node.x = ix(t);
                node.y = iy(t);
                node.px = node.x;
                node.py = node.y;
                d3.select(this).attr('transform', 'translate(' + node.x + ',' + node.y + ')');
                linkSel
                    .attr('x1', function(l) { return l.source.x; })
                    .attr('y1', function(l) { return l.source.y; })
                    .attr('x2', function(l) { return l.target.x; })
                    .attr('y2', function(l) { return l.target.y; });
            };
        }).each('end', function() {
            if (++done === total && container.animation) {
                container.force.alpha(0.15).resume();
            }
        });

        // Remove correctness pulsing
        clearHelpHighlighting();

        btn.classList.remove('active');
        isHelpViewActive = false;
        savedMFEPositions = null;
    }
}

/**
 * Apply pulsing correct/wrong classes to nucleotides in the main container
 * based on whether their base-pairing matches the target structure.
 */
function applyHelpHighlighting(currentStructureString) {
    if (!targetStructure || !currentStructureString) return;

    // Reuse the same pair-map logic from updateTargetHighlighting
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

    // Identify correct indices
    let correctIndices = new Set();
    for (let i = 0; i < targetPairs.length; i++) {
        if (targetPairs[i] === currentPairs[i]) {
            correctIndices.add(i);
        }
    }

    // Apply classes to main container nucleotide nodes
    d3.select('#rna_container').selectAll('.node')
        .classed('help-correct', function(d) {
            return d.node_type === 'nucleotide' && correctIndices.has(d.num - 1);
        })
        .classed('help-wrong', function(d) {
            return d.node_type === 'nucleotide' && !correctIndices.has(d.num - 1);
        });
}

/**
 * Remove all help highlighting classes from the main container.
 */
function clearHelpHighlighting() {
    d3.select('#rna_container').selectAll('.node')
        .classed('help-correct', false)
        .classed('help-wrong', false);
}
