const canvas = document.getElementById("fractal-canvas");
const context = canvas.getContext("2d", { willReadFrequently: true });

let imageData = context.getImageData(0, 0, canvas.width, canvas.width)
let pixels = imageData.data;

const fetchCanvasVars = () => {
    imageData = context.getImageData(0, 0, canvas.width, canvas.height)
    pixels = imageData.data;
}

const setPixel = (x, y, r, g, b) => {
    const index = 4 * (x + y*canvas.width);
    pixels[index] = r;
    pixels[index + 1] = g;
    pixels[index + 2] = b;
    pixels[index + 3] = 255;
}


const DEPTH = 16;


const plotMandelbrot = (zoom=3, offsetX=0.65, offsetY=0, cCoordinates=true, cX=0, cY=0, onlyDiverging=false) => {
    fetchCanvasVars();
    for (let x = 0; x < canvas.width; x++) {
        for (let y = 0; y < canvas.height; y++) {
            const z = {a: 0, b: 0};
            const c = {a: cX, b: cY};
            if (cCoordinates) {
                c.a = (x/canvas.width - 0.5) * zoom - offsetX;
                c.b = (y/canvas.height - 0.5) * zoom - offsetY;
            } else {
                z.a = (x/canvas.width - 0.5) * zoom - offsetX;
                z.b = (y/canvas.height - 0.5) * zoom - offsetY;
            }
            let iters = 0;

            for (let i = 0; i < DEPTH; i++) {
                if ((z.a**2 + z.b**2) > 8) {
                    iters = i;
                    break;
                }
                
                const tz = {
                    a: (z.a**2 - z.b**2) + c.a, 
                    b: (2*z.a*z.b) + c.b 
                };
                z.a = tz.a;
                z.b = tz.b;

                if (!onlyDiverging) iters = i;
            }

            const value = (iters / (DEPTH - 1)) * 255;
            setPixel(
                x, y,
                value, value, value
            );
        }
    }
    context.putImageData(imageData, 0, 0);
}

const plotFractal = (rpn, zoom=3, offsetX=0.65, offsetY=0, cCoordinates=true, cX=0, cY=0, onlyDiverging=false) => {
    const aspect = canvas.height / canvas.width;

    fetchCanvasVars();
    for (let x = 0; x < canvas.width; x++) {
        for (let y = 0; y < canvas.height; y++) {
            const z = {a: 0, b: 0};
            const c = {a: cX, b: cY};
            if (cCoordinates) {
                c.a = (x/canvas.width - 0.5) * zoom - offsetX;
                c.b = (y/canvas.height - 0.5) * aspect * zoom - offsetY;
            } else {
                z.a = (x/canvas.width - 0.5) * zoom - offsetX;
                z.b = (y/canvas.height - 0.5) * aspect * zoom - offsetY;
            }
            let iters = 0;

            for (let i = 0; i < DEPTH; i++) {
                if ((z.a**2 + z.b**2) > 4) {
                    iters = i;
                    break;
                }
                
                const evalZ = evaluateRPN(rpn, complexOperators, {z: z, c: c, e: Math.E, p: Math.PI, i: {a: 0, b: 1}});
                z.a = evalZ.a;
                z.b = evalZ.b;

                if (!onlyDiverging) iters = i;
            }

            const value = (iters / (DEPTH - 1)) * 255;
            setPixel(
                x, y,
                value, value, value
            );
        }
    }
    context.putImageData(imageData, 0, 0);
}