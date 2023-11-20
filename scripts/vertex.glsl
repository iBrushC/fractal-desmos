#version 300 es

in vec4 a_position;
in vec2 a_uv;

out highp vec2 uv;

void main() {
	gl_Position = a_position;
	uv = a_uv;
}