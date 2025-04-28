#!/usr/bin/env node

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })
const SecurityScanner = require('../src')

// Check for OpenAI API key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
if (!OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable is required')
  process.exit(1)
}

async function main () {
  try {
    console.log('Scanning changed files for security vulnerabilities...')

    const scanner = new SecurityScanner(OPENAI_API_KEY)
    const { changedFiles, analysis } = await scanner.scan()

    if (Object.keys(changedFiles).length === 0) {
      console.log('\nNo files have been changed.')
      return
    }

    // Log analysis results
    console.log('\nSecurity Analysis Results:')
    console.log('------------------------')
    console.log(analysis)
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

main()
