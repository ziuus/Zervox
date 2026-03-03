import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import pc from 'picocolors';

dotenv.config();

export interface Solution {
  id: number;
  description: string;
  command?: string;
  action?: 'EDIT_ENV' | 'RUN_COMMAND';
  key?: string;
  value?: string;
}

export class AIAnalyzer {
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error(pc.red('Error: GEMINI_API_KEY environment variable is not set.'));
      console.log(pc.yellow('Please set it in a .env file or export it to your terminal.'));
      process.exit(1);
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async analyzeError(logs: string[]): Promise<Solution[]> {
    console.log(pc.cyan('🧠 Sending logs to Zervox AI for analysis...'));

    const prompt = `
You are an expert server administrator and Site Reliability Engineer.
A Node.js process just crashed. Here are the last 50 lines of logs:

\`\`\`
${logs.join('\n')}
\`\`\`

Analyze this error and provide up to 3 actionable solutions to fix it.
Format your response as a tight JSON array of objects. Do not include markdown formatting or explanations outside the JSON.

Expected JSON schema:
[
  {
    "id": 1,
    "description": "Short explanation of the fix",
    "action": "RUN_COMMAND",
    "command": "The exact bash command to fix it, if applicable"
  },
  {
    "id": 2,
    "description": "Change an environment variable",
    "action": "EDIT_ENV",
    "key": "PORT",
    "value": "3001"
  }
]
`;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0.2, // Low temperature for factual, consistent JSON
        }
      });

      let text = response.text || '[]';
      
      // Attempt to clean markdown if the model wrapped it
      if (text.startsWith('\`\`\`json')) {
        text = text.replace(/^\`\`\`json/m, '').replace(/\`\`\`$/m, '').trim();
      }

      const solutions: Solution[] = JSON.parse(text);
      return solutions;
    } catch (error) {
      console.error(pc.red('Failed to analyze error with Gemini:'), error);
      return [];
    }
  }
}
