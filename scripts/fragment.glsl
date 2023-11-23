#version 300 es
precision lowp float;

// Defines
#define NOZERO 0.00001

// Inputs
in highp vec2 uv;

// Outputs
out vec4 fragColor;

// Passed in parameters
uniform float ticks;
uniform vec2 dimensions;
uniform vec2 offset;
uniform float zoom;

uniform int depth;
uniform int escape;
uniform int display;

uniform vec2 variables[26];

// Color schemes
vec3 blueScheme(float divergence) {
    vec3 base_color = vec3(-0.8,0.1,0.8);
    return 0.5 + 0.5*cos( 3.0 + divergence*0.25 + base_color);
}

vec3 triColorLerp(vec3 c1, vec3 c2, vec3 c3, float a) {
    float f = float(a>=0.5);
    vec3 final = c1*(1.-f) + c2*(f);
    final += (c1 + ((c2-c1)/0.5)*(a*2.))*(1.-f);
    final += (c2 + ((c3-c2)/0.5)*((a-0.5)*2.))*f;
    return final;
}

vec3 heatmap(float t) { // from Mattz
    const vec3 c0 = vec3(-0.002136485053939582, -0.000749655052795221, -0.005386127855323933);
    const vec3 c1 = vec3(0.2516605407371642, 0.6775232436837668, 2.494026599312351);
    const vec3 c2 = vec3(8.353717279216625, -3.577719514958484, 0.3144679030132573);
    const vec3 c3 = vec3(-27.66873308576866, 14.26473078096533, -13.64921318813922);
    const vec3 c4 = vec3(52.17613981234068, -27.94360607168351, 12.94416944238394);
    const vec3 c5 = vec3(-50.76852536473588, 29.04658282127291, 4.23415299384598);
    const vec3 c6 = vec3(18.65570506591883, -11.48977351997711, -5.601961508734096);
    t *= 2.; if(t >= 1.) { t = 2. - t; }
    return c0+t*(c1+t*(c2+t*(c3+t*(c4+t*(c5+t*c6)))));
}

vec3 rgbScheme(float divergence) {
    float a = 0.1;
    return vec3(
    .5*sin(a+divergence)+.5,
    .5*sin(a+divergence + 2.094)+.5,
    .5*sin(a+divergence + 4.188)+.5
    );
}

// Operators
// Technically these could be stored elsewhere and selectively added in, but thats a lot of work for not a lot of benefit
vec2 cxAdd(vec2 u, vec2 v) {
    return u+v;
}
vec2 cxSub(vec2 u, vec2 v) {
    return u-v;
}
vec2 cxMul(vec2 u, vec2 v) {
    return vec2(dot(u, v*vec2(1, -1)), dot(u.yx, v));
}
vec2 cxDiv(vec2 u, vec2 v) {
    float denominator = dot(v, v) + NOZERO;
    return vec2(dot(u, v) / denominator, dot(u.yx, v*vec2(1, -1)) / denominator);
}
vec2 cxPow(vec2 u, vec2 v) {
    float theta = atan(u.y, u.x);
    float r = length(u);
    float f = pow(r, v.x) * exp(-v.y*theta);
    float internal = v.x*theta + v.y*log(r + NOZERO);
    return vec2(f*cos(internal), f*sin(internal));
}
vec2 cxSin(vec2 u) {
    return vec2(sin(u.x)*cosh(u.y), cos(u.x)*sinh(u.y));
}
vec2 cxCos(vec2 u) {
    return vec2(cos(u.x)*cosh(u.y), -sin(u.x)*sinh(u.y));
}
vec2 cxTan(vec2 u) {
    return cxSin(u) / cxCos(u);
}
vec2 cxMin(vec2 u, vec2 v) {
    float uM = length(u);
    float vM = length(v);

    return u*step(uM, vM) + v*step(vM, uM);
}
vec2 cxMax(vec2 u, vec2 v) {
    float uM = length(u);
    float vM = length(v);

    return u*step(vM, uM) + v*step(uM, vM);
}
vec2 cxLn(vec2 u) {
    float theta = atan(u.y, u.x);
    float r = length(u);
    return vec2(log(NOZERO + r), theta);
}
vec2 cxLog(vec2 u, vec2 v) {
    return cxDiv(cxLn(v), cxLn(u));
}
vec2 cxExp(vec2 u) {
    return exp(u.x)*vec2(cos(u.y), sin(u.y));
}
vec2 cxNrt(vec2 u, vec2 v) {
    return cxPow(v, cxDiv(vec2(1, 0), u));
}
vec2 cxAbs(vec2 u) {
    return vec2(length(u), 0);
}
vec2 cxRe(vec2 u) {
    return vec2(u.x, 0);
}
vec2 cxIm(vec2 u) {
    return vec2(u.y, 0);
}

void main() {
    // Stands for "modifiable variables". Tried to make it more verbose but was too much of a pain
    vec2 mv[26] = variables;

    // gl_FragColor is a special variable a fragment shader
    // is responsible for setting
    float aspect = dimensions.y / dimensions.x;
    vec2 coords = uv * vec2(1, -1);
    coords.x /= aspect;

    coords -= vec2(0.5 / aspect, -0.5);
    coords *= zoom;
    coords += vec2(offset.x, offset.y);

    // NEED TO SET UP THE ABILITY TO SET INITIAL VALUES
    // AND CHANGE THE ESCAPE TYPE
    mv[2] = coords;

    /*VARIABLES*/

    float divergence = 0.0;
    vec2 zprev = mv[25];

    int iterations = 0;

    // To avoid a massive headache and loops, there will be a uniform option to determine whether
    // Z starts at the complex coordinates. 

    // !!!
    // SET THE ITERATION NUMBER AS A USABLE VARIABLE BECAUSE IT MAKES SOME COOL SHIT
    for (int i = 0; i < depth; i++) {
        zprev = mv[25];
        
        /*SHADERCODE*/

        // Iterations and coloring
        iterations = i;

        // Escape
        switch (escape) {
            // Radius
            case (0): {
                divergence += exp(-length(mv[25]));
                if (dot(mv[25], mv[25]) > 4.0) {
                    i += depth;
                }
            } break;

            // Derivative
            case (1): {
                // https://www.fractalforums.com/programming/smooth-colouring-of-convergent-fractals/
                divergence += exp(-cxAbs(mv[25]).x - 0.5 / cxAbs(zprev - mv[25]).x);
                if(abs(dot(mv[25]-zprev, mv[25]-zprev)) < 0.00001) {
                    i += depth;
                }
            } break;
        }
    }

    switch (display) {
        case (0): fragColor = vec4(vec3(clamp(divergence / 4., 0., 1.)), 1); break;
        case (1): fragColor = vec4(vec3(float(iterations) / float(depth)), 1); break;
        case (2): fragColor = vec4(mv[25], 0, 1); break;
        case (3): fragColor = vec4(zprev / 2.0, 0, 1); break;
        case (4): fragColor = vec4(mv[25]-zprev, 0, 1); break;
        case (5): fragColor = vec4(rgbScheme(divergence), 1); break;
        case (6): fragColor = vec4(blueScheme(divergence), 1); break;
        case (7): fragColor = vec4(heatmap(clamp(pow(divergence / (0.5*float(depth)), 0.5), 0.0, 1.0)), 1); break;
        case (8): fragColor = vec4(vec3(sin(4.*divergence)), 1); break;
    }

    // Possible coordinate axis
    // float xStep = step(abs(coords.x), 0.005*zoom);
    // xStep += step(abs(mod(coords.x, 1.0)), 0.003*zoom) * step(abs(coords.y), 0.02*zoom);
    // float yStep = step(abs(coords.y), 0.005*zoom);
    // yStep += step(abs(mod(coords.y, 1.0)), 0.003*zoom) * step(abs(coords.x), 0.02*zoom);

    // fragColor += vec4(0.5*vec3(xStep), 1.0);
    // fragColor += vec4(0.5*vec3(yStep), 1.0);
    // fragColor += vec4(0.2*vec3(step(abs(mod(coords.x, 1.0)), 0.003*zoom)), 1.0);
    // fragColor += vec4(0.2*vec3(step(abs(mod(coords.y, 1.0)), 0.003*zoom)), 1.0);
    // fragColor += vec4(vec3(step(0.002*zoom, abs(coords.x) + abs(coords.y));
}