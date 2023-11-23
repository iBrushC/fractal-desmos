// Primary
const updateEquation = document.getElementById("update-equation");
const inputsContainer = document.getElementById("inputs-container");

// Title bar for resizing
const titleBar = document.getElementById("title");

// Hard coded inputs since they'll never dissapear
const zEquation = document.getElementById("INPUT_z").children[2];
const z0Equation = document.getElementById("INPUT_z0").children[2];

const addVariableButton = document.getElementById("add-variable");

// Coordinates and indicators
const domainZoom = document.getElementById("domain-zoom");
const domainCenterA = document.getElementById("domain-center-a");
const domainCenterB = document.getElementById("domain-center-b");
const timeIndicator = document.getElementById("timer");

// Fractal parameters
const downscaleFactor = document.getElementById("downscale-factor");
const iterationDepth = document.getElementById("iteration-depth");
const iterationDepthSlider = document.getElementById("iteration-depth-slider");
const escapeMethod = document.getElementById("escape-method");
const displayMethod = document.getElementById("display-method");

let globalRPN = null;
let variableRPNs = {};

const availableLetters = ['y', 'x', 'w', 'v', 'u'];
const usedLetters = [];

let DOWNSCALE = 2;

const STARTING_FRACTALS = [
    "log(z^9, z^9 + c)",
    "z^(4 + 2sin(t / 100)) + c",
    "z - (z^(4 + 2sin(t/100)) - 1) / ((4 + 2sin(t/100))z^(3 + 2sin(t/100))) + c",
    "ln((2z^2 - c) / ((1 + sin(t / 100)^2)2z))",
    "log(z^3 + c, (4 + 4sin(t / 100))z + c)",
    "(z^2 + c) / (2 + log(c, z^2.5))"
];

// Movement trackers
let dragPreviousPose = null;
let previousOffset = null;
let paused = false;

// Pixel position to coordinate
const pixelToCoord = (x, y) => {
    const aspect = u_dimensions[1] / u_dimensions[0];

    let sX = (x / u_dimensions[0]) / aspect;
    let sY = y / u_dimensions[1];

    sX = (sX - 0.5) * u_zoom + previousOffset[0];
    sY = (sY - 0.5) * u_zoom + previousOffset[1];
    return [sX, sY];
}

// Update canvas size
const updateCanvasSize = () => {
    // Stupid hack because I couldn't get the topbar to work otherwise.
    let correctedHeight = canvas.offsetHeight;
    if (correctedHeight > (window.innerHeight - titleBar.offsetHeight)) {
        correctedHeight = window.innerHeight - titleBar.offsetHeight;
    }

    canvas.width = Math.round(canvas.offsetWidth / DOWNSCALE);
    canvas.height = Math.round(correctedHeight / DOWNSCALE);

    u_dimensions = [canvas.width, canvas.height];
    pushUniforms(null, u_dimensions, null, null);
}

// Updates time
const updateTime = (newTime) => {
    u_variables["t"].a = newTime;
    const timeString = `${newTime}`.padStart(7, " ");
    timeIndicator.innerHTML = `Time: ${timeString}`;
    pushUniforms();
}

// Removes a variable
const removeFractalVariable = (letter) => {
    const element = document.getElementById(`INPUT_${letter}`);
    inputsContainer.removeChild(element);
    availableLetters.push(letter);

    const usedIndex = usedLetters.indexOf(letter);
    usedLetters.splice(usedIndex, 1);

    if (availableLetters.length > 0) {
        addVariableButton.disabled = false;
    }
}

// Creates the new variable for fractals
const addFractalVariable = () => {
    const letter = availableLetters.pop();
    usedLetters.push(letter);

    const container = document.createElement("div");
    container.className = "input-field";
    container.id = `INPUT_${letter}`;

    const labeller = document.createElement("p");
    labeller.innerHTML = `${letter}`;

    const equals = document.createElement("p", {innerHTML: "="});
    equals.innerHTML = "=";

    const input = document.createElement("input");
    input.spellcheck = false;
    input.type = "text";
    input.placeholder = `${letter} value`;

    const removeButton = document.createElement("button");
    removeButton.innerHTML = "x";
    removeButton.id = `INPUT_REMOVE_${letter}`;
    removeButton.onclick = () => { removeFractalVariable(letter) };

    container.appendChild(labeller);
    container.appendChild(equals);
    container.appendChild(input);
    container.appendChild(removeButton);
    inputsContainer.insertBefore(container, addVariableButton);

    if (availableLetters.length == 0) {
        addVariableButton.disabled = true;
    }
}

// Plots the fractal
const drawFractal = () => {
    if (!GL_INITIALIZED) return;
    drawGL();
}

// TODO
const updateFractalInputs = () => {
    const varInputs = inputsContainer.children;
    variableRPNs = {};

    for (const letter of usedLetters) {
        const letterElement = document.getElementById(`INPUT_${letter}`);
        const letterEquation = letterElement.children[2];
        if (letterEquation.value.length > 0) {
            variableRPNs[letter] = parseExpression(letterEquation.value, complexOperators);
        }
    }
}

const updateFractal = () => {
    // Reset time
    u_variables["t"].a = 0;

    // Get variables
    updateFractalInputs();

    // Get RPNs
    let z0RPN = zeroRPN;
    if (z0Equation.value.length != 0) {
        z0RPN = parseExpression(z0Equation.value, complexOperators);
    }
    globalRPN = parseExpression(zEquation.value, complexOperators);
    compileGL(
        // VariableRPNs
        {
            main: globalRPN,
            ...variableRPNs,
            z: z0RPN,
        }
        // 
    );
    pushUniforms();
    drawFractal();
}

// Update fractal
updateEquation.onclick = (e) => { updateFractal(); }

// Update coordinate inputs
domainZoom.oninput = (e) => { 
    u_zoom = Number(domainZoom.value); 
    pushUniforms(); 
    drawFractal(); 
}
domainCenterA.oninput = (e) => { 
    u_offset[0] = Number(domainCenterA.value); 
    pushUniforms();
    drawFractal(); 
}
domainCenterB.oninput = (e) => { 
    u_offset[1] = Number(domainCenterB.value); 
    pushUniforms();
    drawFractal(); 
}

// Resize handler
document.body.onresize = (e) => { updateCanvasSize(); drawFractal(); };

// Drag handler
canvas.onmousedown = (e) => {
    previousOffset = [...u_offset];
    dragPreviousPose = pixelToCoord(e.x, e.y);
}
document.onmousemove = (e) => {
    if (dragPreviousPose == null) return;

    const currentPose = pixelToCoord(e.x, e.y);
    const tOffsetX = previousOffset[0] + (dragPreviousPose[0] - currentPose[0]) / DOWNSCALE;
    const tOffsetY = previousOffset[1] + (dragPreviousPose[1] - currentPose[1]) / DOWNSCALE;
    u_offset = [tOffsetX, tOffsetY];
    pushUniforms();
    drawFractal();

    // Update coordinates
    domainCenterA.value = tOffsetX.toFixed(4);
    domainCenterB.value = tOffsetY.toFixed(4);
}
document.onmouseup = (e) => {
    dragPreviousPose = null;
}

// Key handler
document.onkeydown = (e) => {
    if (document.activeElement.tagName !== "BODY") return;

    switch (e.code) {
        case ("Space"): {
            paused = !paused;
        } break;
        case ("KeyR"): {
            u_variables["t"].a = 0;
            pushUniforms(); 
        }

        default: break
    }
}

// Scroll handler
canvas.onwheel = (e) => {
    u_zoom += (e.deltaY < 0 ? -1 : 1) * u_zoom * 0.1;
    pushUniforms();
    drawFractal();

    // Update u_zoom
    domainZoom.value = u_zoom.toFixed(4);
}

// Fractal parameter handler
downscaleFactor.onchange = (e) => {
    DOWNSCALE = Number(downscaleFactor.value);
    updateCanvasSize();
    drawFractal();
}
escapeMethod.onchange = (e) => {
    u_escape = escapeMethod.selectedIndex;
    pushUniforms();
}
displayMethod.onchange = (e) => {
    u_display = displayMethod.selectedIndex;
    pushUniforms();
}
iterationDepth.onchange = (e) => {
    const value = Math.min(512, Math.max(0, Math.round(iterationDepth.value)));
    iterationDepth.value = value;
    iterationDepthSlider.value = value;
    u_depth = value;
    pushUniforms();
}
iterationDepthSlider.oninput = (e) => {
    iterationDepth.value = iterationDepthSlider.value;
    u_depth = iterationDepthSlider.value;
    pushUniforms();
}

// Variable Handlers
addVariableButton.onclick = (e) => {
    addFractalVariable("l");
}

// A constant refresh, should be able to be turned off
const fixedUpdate = () => {
    updateTime(u_variables["t"].a + !paused)
    drawFractal();

    window.requestAnimationFrame(fixedUpdate);
}
fixedUpdate();

// Set input initial values
domainCenterA.value = u_offset[0].toFixed(4);
domainCenterB.value = u_offset[1].toFixed(4);
domainZoom.value = u_zoom.toFixed(4);

window.onload = () => {
    setTimeout(() => updateFractal(), 100); // Arbitrary wait
    updateCanvasSize();
    drawFractal();
    
    updateFractalInputs();
}