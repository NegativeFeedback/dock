#!/usr/bin/env bun
/**
 * Generates a self-owned RSA keypair and a signed license key for this fork.
 *
 * The public half must replace LICENSE_PUBLIC_KEY in src/lib/server/license.ts
 * so that only licenses signed by the matching private key (generated here,
 * kept out of git under scripts/keys/) validate.
 *
 * Usage:
 *   bun scripts/generate-license.ts [--name "Your Name"] [--host "*"] [--type enterprise] [--days N]
 */

import crypto from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEYS_DIR = join(ROOT_DIR, 'scripts', 'keys');
const PRIVATE_KEY_PATH = join(KEYS_DIR, 'license-private.pem');
const PUBLIC_KEY_PATH = join(KEYS_DIR, 'license-public.pem');

function arg(flag: string, fallback: string): string {
	const i = process.argv.indexOf(flag);
	return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const name = arg('--name', 'Self-Hosted');
const host = arg('--host', '*');
const type = arg('--type', 'enterprise') as 'enterprise' | 'smb';
const days = parseInt(arg('--days', '0'), 10);

mkdirSync(KEYS_DIR, { recursive: true });

let privateKey: string;
let publicKey: string;

if (existsSync(PRIVATE_KEY_PATH) && existsSync(PUBLIC_KEY_PATH)) {
	privateKey = readFileSync(PRIVATE_KEY_PATH, 'utf8');
	publicKey = readFileSync(PUBLIC_KEY_PATH, 'utf8');
	console.log('Reusing existing keypair at scripts/keys/ (delete it to generate a new one).\n');
} else {
	const keys = crypto.generateKeyPairSync('rsa', {
		modulusLength: 2048,
		publicKeyEncoding: { type: 'spki', format: 'pem' },
		privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
	});
	privateKey = keys.privateKey;
	publicKey = keys.publicKey;
	writeFileSync(PRIVATE_KEY_PATH, privateKey, { mode: 0o600 });
	writeFileSync(PUBLIC_KEY_PATH, publicKey);
	console.log('Generated new RSA keypair at scripts/keys/\n');
}

const payload = {
	name,
	host,
	issued: new Date().toISOString(),
	expires: days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null,
	type,
	v: 2
};

const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
const sign = crypto.createSign('RSA-SHA256');
sign.update(payloadBase64);
const signature = sign.sign(privateKey, 'base64url');
const licenseKey = `${payloadBase64}.${signature}`;

console.log('--- Public key (paste into LICENSE_PUBLIC_KEY in src/lib/server/license.ts) ---\n');
console.log(publicKey);

console.log('--- License to activate (Settings > License in the app) ---\n');
console.log(`Name: ${name}`);
console.log(`Key:  ${licenseKey}\n`);
