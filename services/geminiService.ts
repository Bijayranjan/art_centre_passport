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

  // USE DESCRIPTIVE NAMES ONLY. 
  // DO NOT pass the raw hex string (e.g. #2296F3) into the text prompt, 
  // as the model often transcribes it onto the person's shoulder or background.
  const colorDescription = color === BackgroundColor.WHITE 
    ? "PURE UNIFORM STUDIO WHITE" 
    : "PROFESSIONAL DEEP SATURATED ROYAL BLUE";
  
  let clothingPrompt = "";
  if (clothing !== ClothingOption.NONE) {
      let outfitDesc = "";
      switch (clothing) {
          case ClothingOption.MALE_BLAZER:
              outfitDesc = "a professional black suit jacket with a crisp white dress shirt and a clean tie";
              break;
          case ClothingOption.FEMALE_BLAZER:
              outfitDesc = "a sharp professional black formal blazer over a white business top";
              break;
          case ClothingOption.MALE_SHIRT:
              outfitDesc = "a crisp, perfectly ironed white formal button-down dress shirt";
              break;
          case ClothingOption.FEMALE_SHIRT:
              outfitDesc = "a clean, professional white formal business shirt";
              break;
      }
      clothingPrompt = `3. CLOTHING: Change the current outfit to ${outfitDesc}. The clothing must look realistic and properly aligned to the body.`;
  } else {
      clothingPrompt = "3. CLOTHING: Preserve the original clothing exactly as it is.";
  }

  const prompt = `
    TASK: Convert this photo into a standard professional passport photograph.
    
    CRITICAL INSTRUCTIONS:
    1. SUBJECT: Keep the person's face and hair exactly as they are. Do not retouch features.
    2. BACKGROUND: Replace the background with a flat, SOLID ${colorDescription}. No gradients, no textures.
    ${clothingPrompt}
    
    STRICT PROHIBITIONS (MANDATORY):
    - DO NOT include any text, letters, numbers, or hex codes (like #2296F3) on the image.
    - DO NOT add any watermarks, labels, or graphical overlays.
    - DO NOT write the name of the color on the image.
    - The output must be a CLEAN, PURE PHOTOGRAPH ONLY.
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

    throw new Error("AI returned a response but no image data was found.");
  } catch (error: any) {
    console.error(`Gemini API Error (Attempt ${retryCount + 1}):`, error);
    
    if (error.message?.includes("429") && retryCount < MAX_RETRIES) {
      const delay = INITIAL_DELAY * Math.pow(2, retryCount);
      await sleep(delay);
      return processBackground(imageBase64, color, clothing, retryCount + 1);
    }

    throw new Error(error.message || "AI processing failed.");
  }
};

export { processBackground };
