const { simpleGit } = require('simple-git')
const OpenAI = require('openai')
const securityScanPrompt = require('./prompt')

class SecurityScanner {
  model = 'gpt-4.1-nano'
  // Cost per 1M tokens (in USD)
  tokenCosts = {
    'gpt-4.1-nano': { input: 0.10, output: 0.40 },
    'o4-mini': { input: 0.15, output: 0.60 },
    'gpt-4': { input: 30, output: 60 },
    'gpt-4-turbo-preview': { input: 10, output: 30 },
    'gpt-3.5-turbo': { input: 0.50, output: 1.50 }
  }
  compareTo = null

  constructor (options = {}) {
    if (!options.apiKey) {
      throw new Error('OpenAI API key is required')
    }

    if (!options.compareTo) {
        throw new Error('compareTo is required')
      }
  
    this.openai = new OpenAI({ apiKey: options.apiKey })
    this.compareTo = options.compareTo
  }

  async getPatch () {
    const git = simpleGit()

    try {
      console.log(`Getting patch compared to branch ${this.compareTo}...`)

      const patch = await git.diff(['--patch', this.compareTo]);
      return patch
    } catch (error) {
      throw new Error(`Error getting patch: ${error.message}`)
    }
  }

  async analyzeSecurity (patch) {
    const startTime = process.hrtime()

    const messages = [
      { role: 'system', content: securityScanPrompt },
      { role: 'user', content: `Please analyze the following code changes:\n\n${patch}` }
    ]

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages,
        temperature: 1
      })

      const [seconds, nanoseconds] = process.hrtime(startTime)
      const timeInMs = (seconds * 1000 + nanoseconds / 1000000).toFixed(2)

      // Calculate costs based on token usage
      const tokenUsage = completion.usage
      const modelCosts = this.tokenCosts[this.model] || { input: 0, output: 0 }
      const inputCost = (tokenUsage.prompt_tokens / 1000000) * modelCosts.input
      const outputCost = (tokenUsage.completion_tokens / 1000000) * modelCosts.output
      const totalCost = inputCost + outputCost

      console.log('\nAssessment Metrics:')
      console.log('------------------')
      console.log(`Time taken: ${timeInMs}ms`)
      console.log(`Input tokens: ${tokenUsage.prompt_tokens}`)
      console.log(`Output tokens: ${tokenUsage.completion_tokens}`)
      console.log(`Total tokens: ${tokenUsage.total_tokens}`)
      console.log(`Estimated cost: $${totalCost.toFixed(4)}`)

      return completion.choices[0].message.content
    } catch (error) {
      throw new Error(`Error calling OpenAI: ${error.message}`)
    }
  }

  async scan () {
    const startTime = process.hrtime()

    const patch = await this.getPatch()

    const analysis = await this.analyzeSecurity(patch)

    const [seconds, nanoseconds] = process.hrtime(startTime)
    const totalTimeInMs = (seconds * 1000 + nanoseconds / 1000000).toFixed(2)

    console.log(`\nTotal scan time: ${totalTimeInMs}ms`)

    return {
      analysis
    }
  }
}

module.exports = SecurityScanner
