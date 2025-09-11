const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// A simple interactive prompt function
function prompt(question) {
    return new Promise((resolve) => {
        const stdin = process.stdin;
        const stdout = process.stdout;

        stdin.resume();
        stdout.write(question);

        stdin.once('data', (data) => {
            resolve(data.toString().trim());
        });
    });
}

function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function updateFile(filePath) {
    // Normalize path separators and check if it's in en-us directory
    const normalizedPath = filePath.replace(/\\/g, '/');
    const isEnglish = normalizedPath.startsWith('en-us/');
    
    console.log(`Processing file: ${filePath}, isEnglish: ${isEnglish}`); // Debug log
    
    const date = getTodayDate();
    const updateText = isEnglish ? `Last updated: ${date}\n\n` : `最后更新于：${date}\n\n`;
    const updateRegex = isEnglish ? /(Last updated: )\d{4}-\d{2}-\d{2}(\n\n)/ : /(最后更新于：)\d{4}-\d{2}-\d{2}(\n\n)/;

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error(`❌ Error reading file ${filePath}:`, err);
            return;
        }

        let newData;
        
        // Check if update date already exists and update it
        if (updateRegex.test(data)) {
            newData = data.replace(updateRegex, `$1${date}$2`);
        } else {
            // Check if the other language's update date exists and replace it
            const otherRegex = isEnglish ? /(最后更新于：)\d{4}-\d{2}-\d{2}(\n\n)/ : /(Last updated: )\d{4}-\d{2}-\d{2}(\n\n)/;
            if (otherRegex.test(data)) {
                newData = data.replace(otherRegex, updateText);
            } else {
                // Find the first main heading (# title)
                const headingMatch = data.match(/^(#\s+.+$)/m);
                
                if (headingMatch) {
                    // Insert update date before the first heading
                    const headingIndex = data.indexOf(headingMatch[0]);
                    newData = data.slice(0, headingIndex) + updateText + data.slice(headingIndex);
                } else {
                    // If no heading found, add at the beginning of file
                    newData = updateText + data;
                }
            }
        }

        fs.writeFile(filePath, newData, 'utf8', (err) => {
            if (err) {
                console.error(`❌ Error writing file ${filePath}:`, err);
                return;
            }
            console.log(`✅ Successfully updated ${filePath}`);
        });
    });
}

function main() {
    exec("git diff --name-only", (err, stdout, stderr) => {
        if (err) {
            console.error("❌ Error executing git command. Make sure you are in a git repository.", stderr);
            return;
        }

        const changedFiles = stdout
            .split('\n')
            .filter(file => {
                const normalizedPath = file.replace(/\\/g, '/');
                return file.endsWith('.md') && (normalizedPath.startsWith('en-us/') || !normalizedPath.includes('/'));
            });

        if (changedFiles.length === 0) {
            console.log("No changed markdown files found in root or en-us/ directory.");
            return;
        }

        console.log("Found changed markdown files:");
        changedFiles.forEach((file, index) => {
            console.log(`${index + 1}: ${file}`);
        });

        prompt('\nEnter the numbers of the files to update (e.g., 1,3,4), or "all" to update all: ')
            .then(selection => {
                if (selection.toLowerCase() === 'all') {
                    changedFiles.forEach(updateFile);
                } else {
                    const indices = selection.split(',').map(num => parseInt(num.trim(), 10) - 1);
                    indices.forEach(index => {
                        if (index >= 0 && index < changedFiles.length) {
                            updateFile(changedFiles[index]);
                        } else {
                            console.warn(`⚠️ Invalid selection: ${index + 1}. Skipping.`);
                        }
                    });
                }
            })
            .finally(() => {
                process.stdin.end();
            });
    });
}

main();
