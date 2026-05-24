// One-off script: clean stray pixels from the logo PNG.
// Pixels close to #646369 (gray) or #a8a9d5 (lavender) are snapped to that
// color with the appropriate alpha (preserving antialiasing). All other
// pixels become fully transparent.
//
// Run: node scripts/clean-logo.mjs

import { PNG } from "pngjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputPath = path.join(__dirname, "..", "public", "logo.original.png");
const outputPath = path.join(__dirname, "..", "public", "logo.png");

const GRAY = [0x64, 0x63, 0x69];
const PURPLE = [0xa8, 0xa9, 0xd5];
const ALPHA_THRESHOLD = 0.05;

function alphaForTarget(r, g, b, target) {
	// Solve `observed = alpha*target + (1-alpha)*255` per channel, take max.
	let alpha = 0;
	const channels = [r, g, b];
	for (let i = 0; i < 3; i++) {
		const o = channels[i];
		const t = target[i];
		if (t < 255) {
			const a = (255 - o) / (255 - t);
			if (a > alpha) alpha = a;
		}
	}
	return Math.max(0, Math.min(1, alpha));
}

function residual(r, g, b, target, alpha) {
	let err = 0;
	const channels = [r, g, b];
	for (let i = 0; i < 3; i++) {
		const predicted = alpha * target[i] + (1 - alpha) * 255;
		err += (channels[i] - predicted) ** 2;
	}
	return err;
}

const png = PNG.sync.read(fs.readFileSync(inputPath));
const { width, height, data } = png;

let snapped = 0;
let transparent = 0;
let preserved = 0;
const total = width * height;

for (let i = 0; i < data.length; i += 4) {
	const r = data[i];
	const g = data[i + 1];
	const b = data[i + 2];
	const a = data[i + 3];

	if (a < 16) {
		data[i + 3] = 0;
		transparent++;
		continue;
	}

	const alphaGray = alphaForTarget(r, g, b, GRAY);
	const alphaPurple = alphaForTarget(r, g, b, PURPLE);
	const resGray = residual(r, g, b, GRAY, alphaGray);
	const resPurple = residual(r, g, b, PURPLE, alphaPurple);

	const useGray = resGray <= resPurple;
	const target = useGray ? GRAY : PURPLE;
	const alpha = useGray ? alphaGray : alphaPurple;

	if (alpha < ALPHA_THRESHOLD) {
		data[i] = 0;
		data[i + 1] = 0;
		data[i + 2] = 0;
		data[i + 3] = 0;
		transparent++;
		continue;
	}

	const wasExact =
		(r === target[0] && g === target[1] && b === target[2]) && a === 255;
	data[i] = target[0];
	data[i + 1] = target[1];
	data[i + 2] = target[2];
	data[i + 3] = Math.round(alpha * 255);
	if (wasExact) preserved++;
	else snapped++;
}

fs.writeFileSync(outputPath, PNG.sync.write(png));

console.log(
	`Cleaned ${width}×${height} (${total.toLocaleString()} pixels):`,
	`\n  ${preserved.toLocaleString()} preserved exactly`,
	`\n  ${snapped.toLocaleString()} snapped to nearest target`,
	`\n  ${transparent.toLocaleString()} made transparent`,
);
console.log(`Wrote ${outputPath}`);
