const canvas = document.getElementById("fractal-canvas");
const gl = canvas.getContext("webgl2");
if (!gl) {
    console.error("Failed to initialize WebGL!");
}
let GL_INITIALIZED = false;

// Create the fullscreen quad
const quadPositions = new Float32Array([
    -1,  1,
     1,  1,
     1, -1,
    -1, -1
]);

const quadUVs = new Float32Array([
    0, 1,
    1, 1,
    1, 0,
    0, 0
]);

const quadIndices = new Uint16Array([
    3, 2, 1,
    3, 2, 0
]);

const uniforms = {
    dimensions: null,
    offset: null,
    zoom: null,
    variables: null,
}

// MUST BE SYNCED WITH SHADER
const MAXRPN = 10;

// Tracked uniforms
let u_dimensions = [canvas.width, canvas.height];
let u_offset = [0, 0];
let u_zoom = 3;

let u_depth = 128;
let u_escape = 0;
let u_display = 7;

// Very dumb but gives fine initial control
let u_variables = {
    a: {a: 0, b: 0       },   // 
    b: {a: 0, b: 0       },   // 
    c: {a: 0, b: 0       },   // 
    d: {a: 0, b: 0       },   // 
    e: {a: Math.E, b: 0  },   //   PROTECTED (euler's number)
    f: {a: 0, b: 0       },   // 
    g: {a: 0, b: 0       },   // 
    h: {a: 0, b: 0       },   // 
    i: {a: 0, b: 1       },   //   PROTECTED (imaginary number)
    j: {a: 0, b: 0       },   // 
    k: {a: 0, b: 0       },   // 
    l: {a: 0, b: 0       },   // 
    m: {a: 0, b: 0       },   // 
    n: {a: 0, b: 0       },   // 
    o: {a: 0, b: 0       },   // 
    p: {a: Math.PI, b: 0 },   //   PROTECTED (pi)
    q: {a: 0, b: 0       },   // 
    r: {a: 0, b: 0       },   // 
    s: {a: 0, b: 0       },   // 
    t: {a: 1, b: 0       },   //   PROTECTED (time)
    u: {a: 0, b: 0       },   //   1
    v: {a: 0, b: 0       },   //   2
    w: {a: 0, b: 0       },   //   3
    x: {a: 0, b: 0       },   //   4
    y: {a: 0, b: 0       },   //   5
    z: {a: 0, b: 0       },   //   SEMI-PROTECTED (recursive variable, can be given an initial value)
};
const formatted_variables = new Float64Array(52);

// Converts character to its respective variable index
const charIndex = (char) => {
    return char.toLowerCase().charCodeAt(0) - 97;
}

const formatVariablesUniform = () => {
    const variableKeys = Object.keys(u_variables);
    for (let i = 0; i < variableKeys.length; i++) {
        formatted_variables[2*i] = u_variables[variableKeys[i]].a;
        formatted_variables[2*i + 1] = u_variables[variableKeys[i]].b;
    }
}

const rpnToShaderOperators = (rpn, operatorSet) => {
    const stack = [];

    for (const token of rpn) {
        switch (token.type) {
            case ("number"): {
                if (token.value.a && token.value.b) {
                    stack.push(`vec2(${token.value.a}, ${token.value.b})`);
                } else {
                    stack.push(`vec2(${token.value}, 0)`);
                }
            } break;
            case ("variable"): {
                stack.push(`mv[${charIndex(token.value)}]`);
            } break;
            case ("operator"): {
                const operatorName = `cx${token.value.charAt(0).toUpperCase() + token.value.slice(1)}`;
                if (operatorSet[token.value].args == 1) {
                    const a = stack.pop();
                    stack.push(`${operatorName}(${a})`);
                } else if (operatorSet[token.value].args == 2) {
                    const b = stack.pop();
                    const a = stack.pop();
                    stack.push(`${operatorName}(${a}, ${b})`);
                }
            }
        }
    }

    return `${stack[0]}`;
}

const createShader = (gl, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const result = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (result !== false) {
        return shader;
    }

    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);

}

const createProgram = async (gl, vertexShaderFile, fragmentShaderFile, variableRPNs, substitutions) => {
    const vertexShaderSource = await (await fetch(vertexShaderFile)).text();

    // Insert the operation code
    let fragmentShaderSource = await (await fetch(fragmentShaderFile)).text();
    let variableExpressions = "";

    const fractalCode = rpnToShaderOperators(variableRPNs.main, complexOperators);
    for (const variableKey of Object.keys(variableRPNs)) {
        if (variableKey === "main") continue;
        
        const variableOperators = rpnToShaderOperators(variableRPNs[variableKey], complexOperators);
        variableExpressions += `mv[${charIndex(variableKey)}] = ${variableOperators};\n`;
    }

    // Specific substitutions
    fragmentShaderSource = fragmentShaderSource.replace("/*SHADERCODE*/", `mv[25] = ${fractalCode};`);
    fragmentShaderSource = fragmentShaderSource.replace("/*VARIABLES*/", variableExpressions);

    // Generalized
    if (substitutions != null) {
        for (const subKey of Object.keys(substitutions)) {
            fragmentShaderSource = fragmentShaderSource.replace(`/*${subKey.toUpperCase()}*/`, substitutions[subKey]);
        }
    }

    // console.log(fragmentShaderSource);

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    const result = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (result !== false) {
        return program;
    }

    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
}

// Drawing
const drawGL = () => {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0.8, 0.8, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.drawElements(gl.TRIANGLES, quadIndices.length, gl.UNSIGNED_SHORT, 0);
}

const pushUniforms = () => {
    formatVariablesUniform();
    gl.uniform2fv(uniforms.dimensions, u_dimensions);
    gl.uniform2fv(uniforms.offset, u_offset);
    gl.uniform1f(uniforms.zoom, u_zoom);

    gl.uniform1i(uniforms.depth, u_depth);
    gl.uniform1i(uniforms.escape, u_escape);
    gl.uniform1i(uniforms.display, u_display);

    gl.uniform2fv(uniforms.variables, formatted_variables);
}

// Setup
const compileGL = async (variableRPNs, substitutions) => {
    // Create the program and shaders
    const program = await createProgram(gl, "scripts/vertex.glsl", "scripts/fragment.glsl", variableRPNs, substitutions);

    // Bind positions and indices
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadPositions, gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, quadIndices, gl.STATIC_DRAW);

    gl.useProgram(program);

    // Setting positions
    const positionAttribLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionAttribLocation);
    gl.vertexAttribPointer(
        positionAttribLocation, 2, gl.FLOAT, false, 0, 0
    );

    // Setting UVs
    const uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadUVs, gl.STATIC_DRAW);

    const uvAttribLocation = gl.getAttribLocation(program, "a_uv");
    gl.enableVertexAttribArray(uvAttribLocation);
    gl.vertexAttribPointer(
        uvAttribLocation, 2, gl.FLOAT, false, 0, 0
    );

    // Setting uniforms
    uniforms.dimensions = gl.getUniformLocation(program, "dimensions");
    uniforms.offset = gl.getUniformLocation(program, "offset");
    uniforms.zoom = gl.getUniformLocation(program, "zoom");
    uniforms.variables = gl.getUniformLocation(program, "variables");

    uniforms.depth = gl.getUniformLocation(program, "depth");
    uniforms.escape = gl.getUniformLocation(program, "escape");
    uniforms.display = gl.getUniformLocation(program, "display");

    pushUniforms();
    
    // Sets up drawing and resizing
    drawGL();
    GL_INITIALIZED = true;
}

const plotFractal = () => {

}