# Open SAST AI

A powerful Static Application Security Testing (SAST) tool that uses OpenAI to analyze code changes for potential security vulnerabilities.

## Features

- Analyzes changed files in your git repository
- Uses OpenAI's models to identify potential security issues
- Provides detailed security analysis with severity levels and recommended fixes
- Easy to integrate into your development workflow

## Usage

You can run the tool directly without installation using npx and supplying your own OpenAPI key:

```bash
OPENAI_API_KEY=your-api-key-here npx open-sast-ai
```

## Development

Install dependencies:

```bash
yarn install
```

## Configuration

Create a `.env` file in the root directory with your OpenAI API key:

```
OPENAI_API_KEY=your-api-key-here
```

## Usage

Run the security scan on your changed files:

```bash
yarn start
```

The tool will:
1. Detect changed files in your git repository
2. Send the changes to OpenAI for security analysis
3. Display the results in your terminal

## Security Analysis

The tool checks for various security concerns including:
- Security vulnerabilities
- Potential injection points
- Authentication/Authorization issues
- Data exposure risks
- Cryptographic failures
- Security misconfigurations
- Insecure design patterns
- Software and data integrity failures
- Security logging and monitoring failures
- Server-side request forgery (SSRF)

## License

ISC
