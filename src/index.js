const { simpleGit } = require('simple-git');
const OpenAI = require('openai');
const securityScanPrompt = require('./prompt');

class SecurityScanner {
    model = 'gpt-4.1-nano'
    // Cost per 1K tokens (in USD)
    tokenCosts = {
        'gpt-4.1-nano': { input: 0.00010, output: 0.00040 },
        'o4-mini': { input: 0.00015, output: 0.0006 },
        'gpt-4': { input: 0.03, output: 0.06 },
        'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
        'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 }
    }

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
        const startTime = process.hrtime();
        
        const messages = [
            { role: "system", content: securityScanPrompt },
            { role: "user", content: `Please analyze the following code changes:\n\n${JSON.stringify(fileContents, null, 2)}` }
        ];

        try {
            const completion = await this.openai.chat.completions.create({
                model: this.model,
                messages: messages,
                temperature: 1
            });

            const [seconds, nanoseconds] = process.hrtime(startTime);
            const timeInMs = (seconds * 1000 + nanoseconds / 1000000).toFixed(2);

            // Calculate costs based on token usage
            const tokenUsage = completion.usage;
            const modelCosts = this.tokenCosts[this.model] || { input: 0, output: 0 };
            const inputCost = (tokenUsage.prompt_tokens / 1000) * modelCosts.input;
            const outputCost = (tokenUsage.completion_tokens / 1000) * modelCosts.output;
            const totalCost = inputCost + outputCost;

            console.log('\nAssessment Metrics:');
            console.log('------------------');
            console.log(`Time taken: ${timeInMs}ms`);
            console.log(`Input tokens: ${tokenUsage.prompt_tokens}`);
            console.log(`Output tokens: ${tokenUsage.completion_tokens}`);
            console.log(`Total tokens: ${tokenUsage.total_tokens}`);
            console.log(`Estimated cost: $${totalCost.toFixed(4)}`);

            return completion.choices[0].message.content;
        } catch (error) {
            throw new Error(`Error calling OpenAI: ${error.message}`);
        }
    }

    async scan() {
        const startTime = process.hrtime();
        
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
                analysis: null,
                metrics: {
                    timeTaken: 0,
                    tokenUsage: null,
                    estimatedCost: 0
                }
            };
        }
        
        const analysis = await this.analyzeSecurity(changedFiles);
        
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const totalTimeInMs = (seconds * 1000 + nanoseconds / 1000000).toFixed(2);
        
        console.log(`\nTotal scan time: ${totalTimeInMs}ms`);
        
        return {
            changedFiles,
            analysis
        };
    }
}

module.exports = SecurityScanner;
