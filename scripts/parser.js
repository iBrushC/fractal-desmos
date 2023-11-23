// Code is somewhat convoluded and confusing because of bad naming convention choices:
// Operator = function
// Arithemtic = +-*/^, normally referred to as operators

// Will unfortuantely be a massive switch statement on gpu
const realOperators = {
    add: {exec: (a, b) => {return a + b},                       prec: 1, assoc: 'l', args: 2},
    sub: {exec: (a, b) => {return a - b},                       prec: 1, assoc: 'l', args: 2},
    mul: {exec: (a, b) => {return a * b},                       prec: 2, assoc: 'l', args: 2},
    div: {exec: (a, b) => {return a / b},                       prec: 2, assoc: 'l', args: 2},
    pow: {exec: (a, b) => {return a**b},                        prec: 3, assoc: 'r', args: 2},
    sin: {exec: (a, b) => {return Math.sin(a)},                 prec: 0, assoc: 'l', args: 1},
    cos: {exec: (a, b) => {return Math.cos(a)},                 prec: 0, assoc: 'l', args: 1},
    tan: {exec: (a, b) => {return Math.tan(a)},                 prec: 0, assoc: 'l', args: 1},
    min: {exec: (a, b) => {return Math.min(a, b)},              prec: 0, assoc: 'l', args: 2},
    max: {exec: (a, b) => {return Math.max(a, b)},              prec: 0, assoc: 'l', args: 2},
    log: {exec: (a, b) => {return Math.log(b) / Math.log(a)},   prec: 0, assoc: 'l', args: 1},
    exp: {exec: (a, b) => {return Math.exp(a)},                 prec: 0, assoc: 'l', args: 1},
    nrt: {exec: (a, b) => {return Math.pow(b, 1/a)},            prec: 0, assoc: 'l', args: 1},
    abs: {exec: (a, b) => {return Math.abs(a)},                 prec: 0, assoc: 'l', args: 1},
}

// Makes a complex or real argument into a complex one
const cvtComplex = (r) => {
    const rReal = (r?.a === undefined) && (r?.b === undefined);
    return {a: rReal ? r : r.a, b: rReal ? 0 : r.b};
}

const NOZERO = 0.001;

const complexOperators = {
    add: {
        exec: (u, v) => {
            return {a: u.a + v.a, b: u.b + v.b}
        }, 
        prec: 1, assoc: 'l', args: 2},
    sub: {
        exec: (u, v) => {
            return {a: u.a - v.a, b: u.b - v.b}
        }, 
        prec: 1, assoc: 'l', args: 2},
    mul: {
        exec: (u, v) => {
            return {a: u.a*v.a - u.b*v.b, b: u.a*v.b + v.a*u.b}
        },                       
        prec: 2, assoc: 'l', args: 2},
    div: {
        exec: (u, v) => {
            const denominator = v.a**2 + v.b**2;
            return {a: (u.a*v.a + u.b*v.b) / (denominator + NOZERO), b: (u.b*v.a - u.a*v.b) / (denominator + NOZERO)}
        },                       
        prec: 2, assoc: 'l', args: 2},
    pow: {
        exec: (u, v) => {
            const theta = Math.atan2(u.b, u.a + NOZERO);
            const r = Math.sqrt(u.a**2 + u.b**2);
            const f = r**v.a * Math.exp(-v.b * theta);
            const internal = v.a*theta + v.b*Math.log(r + NOZERO);
            return {a: f*Math.cos(internal), b: f*Math.sin(internal)};
        },                        
        prec: 3, assoc: 'r', args: 2},
    sin: {
        exec: (u, v) => {
            return {a: Math.sin(u.a)*Math.cosh(u.b), b: Math.cos(u.a)*Math.sinh(u.b)};
        },                 
        prec: 0, assoc: 'l', args: 1},
    cos: {
        exec: (u, v) => {
            return {a: Math.cos(u.a)*Math.cosh(u.b), b: -Math.sin(u.a)*Math.sinh(u.b)};
        },                 
        prec: 0, assoc: 'l', args: 1},
    tan: {
        exec: (u, v) => {
            const numerator = complexOperators["sin"].exec(v);
            const denominator = complexOperators["cos"].exec(u);
            return complexOperators["div"].exec(numerator, denominator);
        },                 
        prec: 0, assoc: 'l', args: 1},
    min: {
        exec: (u, v) => {
            const rU = u.a**2 + u.b**2;
            const rV = v.a**2 + v.b**2;
            return rU > rV ? rV : rU;
        },              
        prec: 0, assoc: 'l', args: 2},
    max: {
        exec: (u, v) => {
            const rU = u.a**2 + u.b**2;
            const rV = v.a**2 + v.b**2;
            return rU > rV ? rU : rV;
        },              
        prec: 0, assoc: 'l', args: 2},
    ln: {
        exec: (u, v) => {
            const theta = Math.atan2(u.b, u.a + NOZERO);
            const r = Math.sqrt(u.a**2 + u.b**2);
            return {a: Math.log(NOZERO + r), b: theta};
        },
        prec: 0, assoc: 'l', args: 1},  
    log: {
        exec: (u, v) => {
            const numerator = complexOperators["ln"].exec(v);
            const denominator = complexOperators["ln"].exec(u);
            return complexOperators["div"].exec(numerator, denominator);
        },   
        prec: 0, assoc: 'l', args: 2},
    exp: {
        exec: (u, v) => {
            return {a: Math.exp(u.a)*Math.cos(u.b), b: Math.exp(u.a)*Math.sin(u.b)}
        },                 
        prec: 0, assoc: 'l', args: 1},
    nrt: {
        exec: (u, v) => {
            const power = complexOperators["div"].exec(iFormat(1), u);
            return complexOperators["pow"].exec(v, power);
        },            
        prec: 0, assoc: 'l', args: 2},
    abs: {
        exec: (u, v) => { return Math.sqrt(u.a**2 + u.b**2); },                 
        prec: 0, assoc: 'l', args: 1},
    re: {
        exec: (u, v) => { return u.a; },
        prec: 0, assoc: 'l', args: 1},
    im: {
        exec: (u, v) => { return u.b; },
        prec: 0, assoc: 'l', args: 1},
}

// Preformatting inputs depending on the number system
const iFormat = (a) => {
    return cvtComplex(a);
}

const multiCharOperators = Object.keys(complexOperators);

// Tests so I don't forget
const MANDELBROT_EQ = "z^2 + c";
const MANDELSIN_EQ = "zsin(z)";
const NOVA_EQ = "z - (z^3 - 1) / (3z^2) + c"; // Or "Z - ((z - 1)^3 / (3z^2)) + c"
const MAGNET_EQ = "nrt(2, (z^2 + c - 1) / (2z + c - 2))";

// Splits a string math expression into tokens
const tokenizeExpression = (expression="", functionSet=multiCharOperators) => {
    const cleanExpression = expression
                                .trim()
                                .replaceAll(" ", "")
                                .toLowerCase();
    const tokens = [];

    let leftParenthesis = 0;
    let rightParenthesis = 0;

    let numberBuffer = "";
    let letterBuffer = "";

    const pushNumberBuffer = () => {
        tokens.push({type: "number", value: Number(numberBuffer)});
        numberBuffer = "";
    }

    const pushLetterBuffer = () => {
        const last3 = letterBuffer.slice(-3);
        const last2 = letterBuffer.slice(-2);

        // Three letter operator match
        if (functionSet.indexOf(last3) != -1) {
            for (const l of letterBuffer.slice(0, -3)) {
                tokens.push({type: "variable", value: l});
            }
            tokens.push({type: "operator", value: last3});
        }
        // Two letter operator match 
        else if (functionSet.indexOf(last2) != -1) {
            for (const l of letterBuffer.slice(0, -2)) {
                tokens.push({type: "variable", value: l});
            }
            tokens.push({type: "operator", value: last2});
        } 
        // No match was found, push all letters as variables
        else {
            for (const l of letterBuffer) {
                tokens.push({type: "variable", value: l});
            }
        }

        letterBuffer = "";
    }

    for (const letter of cleanExpression) {
        // Number Handling
        if (/\d/.test(letter) || letter == ".") {
            numberBuffer += letter;
        } else if (numberBuffer != "") {
            pushNumberBuffer();
        }
        // Letter Handling
        if (/[a-z]/i.test(letter)) {
            letterBuffer += letter;
        } else if (letterBuffer != "") {
            pushLetterBuffer();
        }
        // Comma Handling
        if (letter == ",") {
            tokens.push({type: "comma", value: null});
        }
        // Parenthesis Handling
        if (letter == "(") {
            leftParenthesis++;
            tokens.push({type: "parenthesis", value: "left"});
        }
        if (letter == ")") {
            rightParenthesis++;
            tokens.push({type: "parenthesis", value: "right"});
        }
        // Operator Handling
        // This could be generated dynamically, which would probably be better
        if (/\+|\-|\*|\/|\^/.test(letter)) {
            switch (letter) {
                case("+"): { tokens.push({type: "arithmetic", value: "add"}); } break;
                case("-"): { tokens.push({type: "arithmetic", value: "sub"}); } break;
                case("*"): { tokens.push({type: "arithmetic", value: "mul"}); } break;
                case("/"): { tokens.push({type: "arithmetic", value: "div"}); } break;
                case("^"): { tokens.push({type: "arithmetic", value: "pow"}); } break;
            }
        }
    }

    // Adding all final expression
    if (numberBuffer != "") {
        pushNumberBuffer();
    }
    if (letterBuffer != "") {
        pushLetterBuffer();
    }

    // Final checks
    if (leftParenthesis != rightParenthesis) {
        console.error("Parsing Error: Inbalanced parenthesis");
    }
    if (
        tokens[tokens.length - 1].type != "parenthesis" && 
        tokens[tokens.length - 1].type != "variable" &&
        tokens[tokens.length - 1].type != "number"
    ) {
        console.error("Parsing Error: Invalid terminal token: must be a parenthesis, variable, or number");
    }

    return tokens;
}

// Accounts for implicit multiplication and negative signs
const reformatTokenization = (tokens) => {

    let operatorShielding = 0;

    const leftImplicitMultiplicative = (token) => {
        return (
            token.type != "arithmetic" && 
            token.type != "comma" &&
            token.type != "operator" &&
            token.value != "left"
        );
    }

    const rightImplicitMultiplicative = (token) => {
        return (
            token.type != "arithmetic" && 
            token.type != "comma" &&                                      
            token.value != "right"
        );
    }

    const newTokens = [];
    for (let i = 0; i < tokens.length - 1; i++) {
        const token = tokens[i];
        newTokens.push(token);

        // Parenthesize operators (weird stuff happens otherwise idk man)
        if (token.type == "operator") {
            newTokens.pop()
            newTokens.push({type: "parenthesis", value: "left"});
            newTokens.push(token);
            operatorShielding++;
        }
        if (token.type == "parenthesis" && token.value == "right" && operatorShielding) {
            newTokens.push({type: "parenthesis", value: "right"});
            operatorShielding--;
        }

        // Adding multiplication symbols for implicit multiplication
        if (
            leftImplicitMultiplicative(token) && 
            rightImplicitMultiplicative(tokens[i + 1])
        ) {
            newTokens.push({type: "arithmetic", value: "mul"});
        }

        // Support for negative signs
        if (token.type == "arithmetic" && token.value == "sub") {
            // If it's the first token
            if (i == 0) {
                newTokens.pop();
                newTokens.push({type: "number", value: -1});
                newTokens.push({type: "arithmetic", value: "mul"});
            } else if (
                tokens[i - 1].type == "arithmetic" || 
                tokens[i - 1].type == "comma" ||
                tokens[i - 1].value == "left" ) {
                newTokens.pop();
                newTokens.push({type: "number", value: -1});
                newTokens.push({type: "arithmetic", value: "mul"});
            }
        }
    }

    const lastToken = tokens[tokens.length - 1];

    // Final operator shielding check
    if (lastToken.type == "parenthesis" && lastToken.value == "right" && operatorShielding) {
        newTokens.push({type: "parenthesis", value: "right"});
        operatorShielding--;
    }

    newTokens.push(lastToken);

    return newTokens;
}

// probably should have a syntax checking function

// Shunting Yard
const parseExpression = (expression="", operatorSet) => {
    const baseTokens = tokenizeExpression(expression);
    const cleanTokens = reformatTokenization(baseTokens);
    const operatorStack = [];
    const RPN = [];

    const arithmeticPoppable = (token) => {
        const stackTop = operatorStack[operatorStack.length - 1];

        return (
            operatorStack.length != 0 && 
            stackTop != "left" &&
            (
                operatorSet[stackTop].prec > operatorSet[token].prec ||
                (operatorSet[stackTop].prec == operatorSet[token].prec && operatorSet[token].assoc == "l")
            )
        )
    }

    for (const token of cleanTokens) {
        // const dummy = []
        // for (const dummyToken of RPN) {
        //     dummy.push(dummyToken.value)
        // }
        // console.log(`Queue: ${dummy} \t\t\t\t Stack: ${operatorStack}\n`);

        switch (token.type) {
            // Valued (terminal) tokens
            case ("number"): {
                RPN.push({type: "number", value: token.value});
            } break;
            case ("variable"): {
                RPN.push({type: "variable", value: token.value});
            } break;

            // Nonvalued (nonterminal) tokens
            case ("arithmetic"): {
                while (arithmeticPoppable(token.value)) {
                    RPN.push({type: "operator", value: operatorStack.pop()});
                }
                operatorStack.push(token.value)
            } break;
            case ("operator"): {
                operatorStack.push(token.value);
            } break;

            // Syntax tokens
            case ("comma"): {
                while (operatorStack[operatorStack.length - 1] != "left") {
                    RPN.push({type: "operator", value: operatorStack.pop()});
                }
            } break;
            case ("parenthesis"): {
                if (token.value == "left") {
                    operatorStack.push(token.value);
                } else {
                    while (operatorStack[operatorStack.length - 1] != "left") {
                        RPN.push({type: "operator", value: operatorStack.pop()});
                    }
                    operatorStack.pop();
                    if (operatorSet[operatorStack[operatorStack.length - 1]] == 0) {
                        RPN.push({type: "operator", value: operatorStack.pop()});
                    }
                }
            } break;
        }
    }

    for (const operator of operatorStack.reverse()) {
        RPN.push({type: "operator", value: operator});
    }

    return RPN;
}

// Reverse Polish Notation will be infinitely easier to send to a shader and is much easier to evaluate
const evaluateRPN = (rpn, operatorSet, variables) => {
    const stack = [];

    for (const token of rpn) {
        switch (token.type) {
            case ("number"): {
                stack.push(token.value);
            } break;
            case ("variable"): {
                stack.push(variables[token.value]);
            } break;
            case ("operator"): {
                if (operatorSet[token.value].args == 1) {
                    const a = stack.pop();
                    stack.push(operatorSet[token.value].exec(iFormat(a)));
                } else if (operatorSet[token.value].args == 2) {
                    const b = stack.pop();
                    const a = stack.pop();
                    stack.push(operatorSet[token.value].exec(iFormat(a), iFormat(b)));
                }
            }
        }
    }

    return iFormat(stack[0]);
}

// Redudant
const evaluateAst = (ast, variables) => {
    // Trying to combat ugly switch nesting
    const evalVariable = () => {
        if (Object.keys(variables).indexOf(ast.value) != -1) {
            return variables[ast.value];
        } else {
            console.error(`AST Error: could not find "${ast.value}" in variables`);
            return NaN;
        }
    }

    // Redundancy for error checking
    const evalArithmetic = () => {
        if (ast.left && ast.right) {
            // Operations like sin and cos might be hard
            if (Object.keys(operators).indexOf(ast.value) != -1) {
                return operatorSet[ast.value].exec(
                    iFormat(evaluateAst(ast.left, variables)), 
                    iFormat(evaluateAst(ast.right, variables))
                )
            } else {
                console.error(`AST Error: "${ast.value}" arithmetic does not exist`);
            }
        } else {
            console.error(`AST Error: "${ast.value}" arithmetic does not have enough arguments`);
        }
    }

    const evalOperator = () => {
        if (ast.left || ast.right) {
            // Operations like sin and cos might be hard
            if (Object.keys(operators).indexOf(ast.value) != -1) {
                return operatorSet[ast.value].exec(
                    iFormat(evaluateAst(ast.left, variables)), 
                    iFormat(evaluateAst(ast.right, variables))
                )
            } else {
                console.error(`AST Error: "${ast.value}" operation does not exist`);
            }
        } else {
            console.error(`AST Error: "${ast.value}" operation does not have enough arguments`);
        }
    }

    switch (ast.type) {
        case("number"): return ast.value;
        case("variable"): return evalVariable();
        case("operator"): return evalOperator();
        case("arithmetic"): return evalArithmetic();
    }
}

const sampleAST = {
    type: "operator",
    value: "add",
    left: {
        type: "number", 
        value: 9
    },
    right: {
        type: "operator", 
        value: "mul",
        left: {
            type: "variable",
            value: "a"
        },
        right: {
            type: "variable",
            value: "e"
        }
    }
}

const sampleRPN1 = [
    {type: "number",  value: "3"},
    {type: "number",  value: "4"},
    {type: "number",  value: "2"},
    {type: "operator",  value: "mul"},
    {type: "number",  value: "1"},
    {type: "number",  value: "5"},
    {type: "operator",  value: "sub"},
    {type: "number",  value: "2"},
    {type: "number",  value: "3"},
    {type: "operator",  value: "pow"},
    {type: "operator",  value: "pow"},
    {type: "operator",  value: "div"},
    {type: "operator",  value: "add"}
];

const sampleRPN2 = [
    {type: "number",  value: 3},
    {type: "number",  value: 4},
    {type: "number",  value: 2},
    {type: "number",  value: 2},
    {type: "number",  value: 3},
    {type: "operator",  value: "pow"},
    {type: "operator",  value: "pow"},
    {type: "operator",  value: "mul"},
    {type: "operator",  value: "add"},
];

const zeroRPN = [
    {
        "type": "number",
        "value": 0
    }
];