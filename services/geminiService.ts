
import { GoogleGenAI, Type } from "@google/genai";
import { Language } from "../types";

// Fix: Initialized with process.env.API_KEY directly as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeCode = async (code: string, language: Language) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Analyze the following ${language} code for bugs, efficiency, and explain what it does. Provide the response in a structured JSON format.

Code:
\`\`\`${language}
${code}
\`\`\``,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            explanation: { type: Type.STRING, description: "A concise explanation of what the code does." },
            improvements: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "List of suggested improvements."
            },
            bugFixes: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "List of potential bugs found."
            },
            complexity: { type: Type.STRING, description: "Big O time and space complexity analysis." }
          },
          required: ["explanation", "improvements", "bugFixes", "complexity"]
        },
        thinkingConfig: { thinkingBudget: 4000 }
      }
    });

    // Fix: Using .text property directly (not a method)
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

export const chatWithCode = async (code: string, language: Language, userMessage: string, history: any[]) => {
  const chat = ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction: `You are an expert senior software engineer assisting a developer. 
      The current context is a ${language} code snippet: 
      \`\`\`${language}
      ${code}
      \`\`\`
      Answer questions concisely and provide code examples where helpful.`,
    },
  });

  const response = await chat.sendMessage({ message: userMessage });
  // Fix: Using .text property directly (not a method)
  return response.text;
};
