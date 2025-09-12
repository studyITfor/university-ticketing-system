#!/usr/bin/env node

/**
 * Script to resolve Git merge conflicts in server.js
 * Keeps local changes (HEAD) and removes conflict markers
 */

const fs = require('fs');
const path = require('path');

function resolveConflicts(filePath) {
    console.log(`🔧 Resolving conflicts in ${filePath}...`);
    
    let content = fs.readFileSync(filePath, 'utf8');
    let resolved = false;
    
    // Pattern to match Git conflict markers
    const conflictPattern = /<<<<<<< HEAD\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> [a-f0-9]+/g;
    
    // Replace conflicts with HEAD content (local changes)
    content = content.replace(conflictPattern, (match, headContent, remoteContent) => {
        resolved = true;
        console.log('  ✅ Resolved conflict - keeping local changes');
        return headContent;
    });
    
    // Check for any remaining conflict markers
    const remainingConflicts = content.match(/<<<<<<< HEAD|=======|>>>>>>> /g);
    if (remainingConflicts) {
        console.log('  ⚠️  Warning: Some conflict markers remain:', remainingConflicts);
    }
    
    if (resolved) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Conflicts resolved in ${filePath}`);
    } else {
        console.log(`ℹ️  No conflicts found in ${filePath}`);
    }
    
    return resolved;
}

// Resolve conflicts in server.js
const serverPath = path.join(__dirname, 'server.js');
const conflictsResolved = resolveConflicts(serverPath);

if (conflictsResolved) {
    console.log('\n🎉 All conflicts resolved! Server.js is ready for deployment.');
} else {
    console.log('\n✅ No conflicts found. Server.js is already clean.');
}
