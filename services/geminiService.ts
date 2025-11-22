import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Bug, BattleLog } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const ANALYSIS_MODEL = "gemini-2.5-flash";
const BATTLE_MODEL = "gemini-2.5-flash";

export const analyzeBugImage = async (base64Image: string): Promise<{
  isBug: boolean;
  data?: any;
  insult?: string;
}> => {
  try {
    // Remove header if present to get pure base64
    const cleanBase64 = base64Image.split(',')[1];

    const response = await ai.models.generateContent({
      model: ANALYSIS_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64
            }
          },
          {
            text: `Analyze this image. Is this a real insect, arachnid, or bug? 
            
            If it is NOT a bug (e.g. a cat, a car, a human, a drawing), return valid JSON with:
            - isBug: false
            - insult: A creative, mean, and funny name-calling insult for the user (e.g. bozo, bimbo, walnut, cheater). Be savage.

            If it IS a bug, return valid JSON with:
            - isBug: true
            - species: The scientific or common name.
            - description: A one paragraph analysis of the bug's combat potential.
            - stats: An object containing integer values 0-100 for: strength, attack, size, willingnessToLive, stamina, agility, quantity.
            `
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isBug: { type: Type.BOOLEAN },
            species: { type: Type.STRING },
            description: { type: Type.STRING },
            insult: { type: Type.STRING },
            stats: {
              type: Type.OBJECT,
              properties: {
                strength: { type: Type.INTEGER },
                attack: { type: Type.INTEGER },
                size: { type: Type.INTEGER },
                willingnessToLive: { type: Type.INTEGER },
                stamina: { type: Type.INTEGER },
                agility: { type: Type.INTEGER },
                quantity: { type: Type.INTEGER }
              }
            }
          }
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
      isBug: result.isBug,
      data: result.isBug ? result : undefined,
      insult: result.isBug ? undefined : result.insult
    };

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Failed to analyze image. The bug might be too powerful for our sensors.");
  }
};

export const simulateBattle = async (bug1: Bug, bug2: Bug): Promise<BattleLog> => {
  try {
    const prompt = `
      Simulate a battle between two bugs.
      
      Combatant 1: ${bug1.species} named "${bug1.nickname || 'The Challenger'}" owned by ${bug1.ownerName}.
      Stats: ${JSON.stringify(bug1.stats)}.
      Description: ${bug1.description}.
      Current HP: ${bug1.currentHp}/${bug1.maxHp}.

      Combatant 2: ${bug2.species} named "${bug2.nickname || 'The Defender'}" owned by ${bug2.ownerName}.
      Stats: ${JSON.stringify(bug2.stats)}.
      Description: ${bug2.description}.
      Current HP: ${bug2.currentHp}/${bug2.maxHp}.

      Simulate a short, intense battle (3-5 rounds). 
      Decide a winner based on stats and RNG. 
      Calculated damage should be realistic (10-50 HP range per big hit).
      
      Return JSON:
      - log: Array of strings describing the action.
      - winnerId: The ID of the winning bug (${bug1.id} or ${bug2.id}).
      - damageDealtToWinner: How much damage the winner TOOK during this specific fight.
      - damageDealtToLoser: How much damage the loser TOOK during this specific fight (usually enough to reduce to 0 or low, but don't kill them if it's close).
    `;

    const response = await ai.models.generateContent({
      model: BATTLE_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            log: { type: Type.ARRAY, items: { type: Type.STRING } },
            winnerId: { type: Type.STRING },
            damageDealtToWinner: { type: Type.INTEGER },
            damageDealtToLoser: { type: Type.INTEGER }
          }
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Battle Simulation Error", error);
    // Fallback in case of API failure
    return {
      log: ["The arena collapsed! It's a draw due to technical difficulties."],
      winnerId: bug1.id, // Default
      damageDealtToWinner: 0,
      damageDealtToLoser: 0
    };
  }
};
