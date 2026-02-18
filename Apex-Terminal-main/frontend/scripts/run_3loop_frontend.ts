import { execSync } from 'child_process';
import db from 'fs';

const loops = [
    { name: 'Unit Tests', command: 'npm run test:unit' },
    { name: 'Integration Tests', command: 'npm run test:int' },
    { name: 'E2E Tests', command: 'npm run test:e2e' }
];

async function runLoop() {
    let pass = true;
    for (const loop of loops) {
        console.log(`\nStarting ${loop.name}...`);
        try {
            execSync(loop.command, { stdio: 'inherit' });
            console.log(`✅ ${loop.name} passed.`);
        } catch (e) {
            console.error(`❌ ${loop.name} failed.`);
            pass = false;
            break;
        }
    }

    if (pass) {
        console.log('\n🎉 All loops passed!');
        process.exit(0);
    } else {
        console.error('\n💥 Loop failed. Fix errors and retry.');
        process.exit(1);
    }
}

runLoop();
