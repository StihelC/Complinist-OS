#!/usr/bin/env tsx
/**
 * Calculate optimal boundary sizes for templates
 * Based on child node count and new spacing requirements
 */

const DEVICE_WIDTH = 140;
const DEVICE_HEIGHT = 150;
const LABEL_BUFFER = 30;
const NODESEP = 180;
const RANKSEP = 240;
const MARGIN = 120;

// Account for 100% image scaling
const MAX_SCALE_FACTOR = 100 / 55;
const SCALED_DEVICE_WIDTH = Math.round(DEVICE_WIDTH * MAX_SCALE_FACTOR);
const SCALED_DEVICE_HEIGHT = Math.round((DEVICE_HEIGHT + LABEL_BUFFER) * MAX_SCALE_FACTOR);

function calculateBoundarySize(
  childCount: number,
  columns: number
): { width: number; height: number } {
  const rows = Math.ceil(childCount / columns);

  // Width = columns * nodeWidth + (columns - 1) * spacing + 2 * margin
  const width = columns * SCALED_DEVICE_WIDTH + (columns - 1) * NODESEP + 2 * MARGIN;

  // Height = rows * nodeHeight + (rows - 1) * spacing + 2 * margin
  const height = rows * SCALED_DEVICE_HEIGHT + (rows - 1) * RANKSEP + 2 * MARGIN;

  return {
    width: Math.ceil(width / 50) * 50, // Round up to nearest 50
    height: Math.ceil(height / 50) * 50,
  };
}

console.log('🧮 Boundary Size Calculator\n');
console.log('Configuration:');
console.log(`  - Device base: ${DEVICE_WIDTH}×${DEVICE_HEIGHT}px`);
console.log(`  - Max scaled: ${SCALED_DEVICE_WIDTH}×${SCALED_DEVICE_HEIGHT}px (100% image size)`);
console.log(`  - Horizontal spacing: ${NODESEP}px`);
console.log(`  - Vertical spacing: ${RANKSEP}px`);
console.log(`  - Margins: ${MARGIN}px\n`);

console.log('═'.repeat(80));
console.log('\n📁 Simple Web Application\n');

console.log('Authorization Boundary (2 child boundaries):');
const auth = calculateBoundarySize(2, 2);
console.log(`  Recommended: ${auth.width}×${auth.height}px`);
console.log(`  Current: 900×600px → ${auth.width > 900 || auth.height > 600 ? '❌ TOO SMALL' : '✅ OK'}`);

console.log('\nDMZ (2 devices):');
const dmz1 = calculateBoundarySize(2, 1);
console.log(`  Recommended: ${dmz1.width}×${dmz1.height}px`);
console.log(`  Current: 300×520px → ${dmz1.width > 300 || dmz1.height > 520 ? '❌ TOO SMALL' : '✅ OK'}`);

console.log('\nInternal Network (3 devices):');
const internal = calculateBoundarySize(3, 1);
console.log(`  Recommended: ${internal.width}×${internal.height}px`);
console.log(`  Current: 520×520px → ${internal.width > 520 || internal.height > 520 ? '❌ TOO SMALL' : '✅ OK'}`);

console.log('\n═'.repeat(80));
console.log('\n📁 Multi-Tier Enterprise Application\n');

console.log('Enterprise Authorization Boundary (4 child boundaries):');
const ent = calculateBoundarySize(4, 2);
console.log(`  Recommended: ${ent.width}×${ent.height}px`);
console.log(`  Current: 1400×850px → ${ent.width > 1400 || ent.height > 850 ? '❌ TOO SMALL' : '✅ OK'}`);

console.log('\nZones (4 devices each):');
const zone = calculateBoundarySize(4, 1);
console.log(`  Recommended: ${zone.width}×${zone.height}px`);
console.log(`  Current: 320×750px → ${zone.width > 320 || zone.height > 750 ? '❌ TOO SMALL' : '✅ OK'}`);

console.log('\n═'.repeat(80));
console.log('\n📁 Cloud-Native Microservices\n');

console.log('Cloud Environment Authorization Boundary (4 child boundaries):');
const cloud = calculateBoundarySize(4, 2);
console.log(`  Recommended: ${cloud.width}×${cloud.height}px`);
console.log(`  Current: 1600×950px → ${cloud.width > 1600 || cloud.height > 950 ? '❌ TOO SMALL' : '✅ OK'}`);

console.log('\nEdge Services (4 devices):');
const edge = calculateBoundarySize(4, 1);
console.log(`  Recommended: ${edge.width}×${edge.height}px`);
console.log(`  Current: 320×750px → ${edge.width > 320 || edge.height > 750 ? '❌ TOO SMALL' : '✅ OK'}`);

console.log('\nKubernetes Cluster (8 devices):');
const k8s2col = calculateBoundarySize(8, 2);
console.log(`  Recommended (2 cols): ${k8s2col.width}×${k8s2col.height}px`);
console.log(`  Current: 520×850px → ${k8s2col.width > 520 || k8s2col.height > 850 ? '❌ TOO SMALL' : '✅ OK'}`);

console.log('\nManaged Data Services (5 devices):');
const data = calculateBoundarySize(5, 1);
console.log(`  Recommended: ${data.width}×${data.height}px`);
console.log(`  Current: 320×850px → ${data.width > 320 || data.height > 850 ? '❌ TOO SMALL' : '✅ OK'}`);

console.log('\nSecurity & Monitoring (5 devices):');
const sec = calculateBoundarySize(5, 1);
console.log(`  Recommended: ${sec.width}×${sec.height}px`);
console.log(`  Current: 320×850px → ${sec.width > 320 || sec.height > 850 ? '❌ TOO SMALL' : '✅ OK'}`);

console.log('\n═'.repeat(80));
console.log('\n📝 Summary of Required Changes:\n');

const changes = [
  { name: 'Simple Web - Authorization Boundary', current: '900×600', new: `${auth.width}×${auth.height}` },
  { name: 'Simple Web - DMZ', current: '300×520', new: `${dmz1.width}×${dmz1.height}` },
  { name: 'Simple Web - Internal Network', current: '520×520', new: `${internal.width}×${internal.height}` },
  { name: 'Multi-Tier - Enterprise Auth Boundary', current: '1400×850', new: `${ent.width}×${ent.height}` },
  { name: 'Multi-Tier - All Zones (×4)', current: '320×750', new: `${zone.width}×${zone.height}` },
  { name: 'Cloud - Cloud Environment Auth Boundary', current: '1600×950', new: `${cloud.width}×${cloud.height}` },
  { name: 'Cloud - Edge Services', current: '320×750', new: `${edge.width}×${edge.height}` },
  { name: 'Cloud - Kubernetes Cluster', current: '520×850', new: `${k8s2col.width}×${k8s2col.height}` },
  { name: 'Cloud - Managed Data Services', current: '320×850', new: `${data.width}×${data.height}` },
  { name: 'Cloud - Security & Monitoring', current: '320×850', new: `${sec.width}×${sec.height}` },
];

changes.forEach((change) => {
  console.log(`  ${change.name}`);
  console.log(`    ${change.current} → ${change.new}`);
});

console.log('\n✨ These sizes ensure no overlaps at 100% device image size!');
