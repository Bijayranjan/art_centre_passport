import { GoogleGenAI } from "@google/genai";
import { BackgroundColor, ClothingOption } from "../types";

const MAX_RETRIES = 3;
const INITIAL_DELAY = 2000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const processBackground = async (
  imageBase64: string,
  color: BackgroundColor,
  clothing: ClothingOption,
  retryCount = 0
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = "gemini-2.5-flash-image";

  // Clean base64 string
  const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

  const colorName = color === BackgroundColor.WHITE ? "pure white" : "saturated blue";
  
  let clothingPrompt = "";
  if (clothing !== ClothingOption.NONE) {
      let outfitDesc = "";
      switch (clothing) {
          case ClothingOption.MALE_BLAZER:
              outfitDesc = "a professional black suit jacket with a white dress shirt and tie";
              break;
          case ClothingOption.FEMALE_BLAZER:
              outfitDesc = "a professional black formal blazer over a simple top";
              break;
          case ClothingOption.MALE_SHIRT:
              outfitDesc = "a crisp white formal button-down dress shirt";
              break;
          case ClothingOption.FEMALE_SHIRT:
              outfitDesc = "a professional white formal business shirt";
              break;
      }
      clothingPrompt = `3. CLOTHING: Replace current clothes with ${outfitDesc}. Ensure a realistic fit and natural neck transition.`;
  } else {
      clothingPrompt = "3. CLOTHING: Keep original clothes exactly as they are.";
  }

  const prompt = `
    Task: Create a professional passport photo.
    
    INSTRUCTIONS:
    1. KEEP THE PERSON'S FACE, HAIR, AND IDENTITY EXACTLY AS IS.
    2. BACKGROUND: Replace the background with a SOLID, UNIFORM ${colorName} background. Use the color ${color}.
    ${clothingPrompt}
    4. Ensure clean, sharp edges between the person and the background.
    
    STRICT PROHIBITION:
    - DO NOT include any text, labels, hex codes, or watermarks on the image.
    - DO NOT write "${color}" or any numbers on the result.
    - THE OUTPUT MUST BE A CLEAN PHOTOGRAPH ONLY.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: cleanBase64,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
           return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }

    throw new Error("The AI returned a response but no image was found.");
  } catch (error: any) {
    console.error(`Gemini API Error (Attempt ${retryCount + 1}):`, error);
    
    if (error.message?.includes("429") && retryCount < MAX_RETRIES) {
      const delay = INITIAL_DELAY * Math.pow(2, retryCount);
      await sleep(delay);
      return processBackground(imageBase64, color, clothing, retryCount + 1);
    }

    throw new Error(error.message || "An unexpected error occurred during AI processing.");
  }
};

export { processBackground };
