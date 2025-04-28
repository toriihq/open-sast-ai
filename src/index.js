const { simpleGit } = require('simple-git');
const OpenAI = require('openai');
const securityScanPrompt = require('./prompt');

class SecurityScanner {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('OpenAI API key is required');
        }
        
        this.openai = new OpenAI({
            apiKey: apiKey
        });
    }

    async getChangedFiles() {
        const git = simpleGit();
        
        try {
            console.log('Getting changes in current branch');
            
            // Get the current branch name
            const branchInfo = await git.branch();
            const currentBranch = branchInfo.current;
            
            // Find the commit where the branch diverged from master
            const mergeBase = await git.raw(['merge-base', 'master', currentBranch]);
            const baseCommit = mergeBase.trim();
            
            // Get all changes since the branch diverged
            const diff = await git.diffSummary([baseCommit]);
            const changedFiles = {};
            
            // Process each file change
            for (const file of diff.files) {
                // Only include TypeScript and JavaScript files
                if (!/\.(ts|tsx|js|jsx)$/.test(file.file)) continue;
                
                try {
                    // Get the full diff for this file since branch creation
                    const fileDiff = await git.diff([baseCommit, '--', file.file]);
                    changedFiles[file.file] = fileDiff;
                } catch (error) {
                    throw new Error(`Error getting diff for ${file.file}: ${error.message}`);
                }
            }
            
            // Also get any uncommitted changes
            const status = await git.status();
            const uncommittedFiles = [
                ...status.modified,
                ...status.created,
                ...status.renamed.map(f => f.to)
            ].filter(file => /\.(ts|tsx|js|jsx)$/.test(file)); // Filter for TS/JS files
            
            // Add uncommitted changes to the result
            for (const file of uncommittedFiles) {
                if (!changedFiles[file]) {  // Only if not already included
                    try {
                        const fileDiff = await git.diff(['--', file]);
                        changedFiles[file] = fileDiff;
                    } catch (error) {
                        throw new Error(`Error getting diff for ${file}: ${error.message}`);
                    }
                }
            }

            return changedFiles;
        } catch (error) {
            if (error.message.includes('merge-base')) {
                throw new Error('Could not determine branch divergence point. Make sure the master branch exists and you have access to it.');
            }
            throw new Error(`Error getting changed files: ${error.message}`);
        }
    }

    async analyzeSecurity(fileContents) {
        const messages = [
            { role: "system", content: securityScanPrompt },
            { role: "user", content: `Please analyze the following code changes:\n\n${JSON.stringify(fileContents, null, 2)}` }
        ];

        try {
            const completion = await this.openai.chat.completions.create({
                model: "gpt-4o",
                messages: messages,
                temperature: 0.3,
            });

            return completion.choices[0].message.content;
        } catch (error) {
            throw new Error(`Error calling OpenAI: ${error.message}`);
        }
    }

    async scan() {
        const changedFiles = await this.getChangedFiles();

        // Log changed files before analysis
        console.log('\nChanged Files:');
        console.log('-------------');
        for (const file of Object.keys(changedFiles)) {
            console.log(file);
        }
        
        if (Object.keys(changedFiles).length === 0) {
            return {
                changedFiles: {},
                analysis: null
            };
        }
        
        const analysis = await this.analyzeSecurity(changedFiles);
        
        return {
            changedFiles,
            analysis
        };
    }
}

module.exports = SecurityScanner;
