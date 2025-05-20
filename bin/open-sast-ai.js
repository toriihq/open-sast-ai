#!/usr/bin/env node

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })
const SecurityScanner = require('../src')

console.log(`✅ Starting open-sast-ai version ${require('../package.json').version}`)

// Check for OpenAI API key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
if (!OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable is required')
  process.exit(1)
}
console.log('✅ OPENAI_API_KEY found')

// Get optional COMPARE_TO value
const COMPARE_TO = process.env.COMPARE_TO || 'master'
console.log(`✅ Comparing to branch: ${COMPARE_TO}`)

const TEMPERATURE = process.env.TEMPERATURE || 0
console.log(`✅ Temperature: ${TEMPERATURE}`)

async function main () {
  try {
    console.log('Scanning changed files for security vulnerabilities...')

    const scanner = new SecurityScanner({ 
      apiKey: OPENAI_API_KEY,
      compareTo: COMPARE_TO,
      temperature: TEMPERATURE
    })
    const { analysis } = await scanner.scan()

    // Log analysis results
    console.log('\nSecurity Analysis Results:')
    console.log('------------------------')
    console.log(analysis)
    console.log('\n✅ Analysis complete')
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

main()
