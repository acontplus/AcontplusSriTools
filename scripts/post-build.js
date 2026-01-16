#!/usr/bin/env node

/**
 * Post-build script para ajustar manifest.json
 */

const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '..', 'dist');
const manifestPath = path.join(distPath, 'manifest.json');

if (!fs.existsSync(manifestPath)) {
  console.error('❌ manifest.json no encontrado en dist/');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Actualizar rutas de scripts compilados
manifest.content_scripts[0].js = [
  'runtime.js',
  'shared.js',
  'services/supabase.js',
  'services/download-counter.js',
  'content/index.js'
];

manifest.background.service_worker = 'background.js';

// Guardar manifest actualizado
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log('✅ manifest.json actualizado correctamente');
