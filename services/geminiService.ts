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
  // Try multiple ways to access the key, as different build systems/platforms handle this differently.
  const apiKey = (process.env as any)?.GEMINI_API_KEY || 
                 (import.meta as any).env?.VITE_GEMINI_API_KEY || 
                 (window as any).GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please ensure GEMINI_API_KEY or VITE_GEMINI_API_KEY is set in your environment variables and that you have redeployed the app.");
  }
  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-2.5-flash-image";

  // Clean base64 string
  const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

  // The prompt must be extremely strict about the background color and subject preservation.
  const colorDescription = color === BackgroundColor.ORIGINAL 
    ? "PRESERVE THE ORIGINAL BACKGROUND EXACTLY AS IT IS. Do not change the background." 
    : color === BackgroundColor.WHITE
    ? "PURE, PERFECT, UNIFORM STUDIO WHITE (#FFFFFF). It must be 100% white with no grey or off-white tints."
    : `SOLID, UNIFORM, FLAT BACKGROUND COLOR ${color}. This is a professional document background. It must be a single, solid, uniform shade with NO gradients, NO shadows, and NO textures.`;
  
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
    1. SUBJECT: Preserve the person's face, hair, and skin tone EXACTLY as they appear in the provided image. The lighting and color balance on the person must remain identical to the input.
    2. BACKGROUND: Replace the entire background with a flat, SOLID ${colorDescription}. The background must be perfectly uniform with NO gradients, NO shadows, and NO textures.
    ${clothingPrompt}
    
    STRICT PROHIBITIONS (MANDATORY):
    - DO NOT include any text, letters, numbers, or hex codes on the image.
    - DO NOT write the color code or the name of the color anywhere on the output.
    - DO NOT add any watermarks, labels, or graphical overlays.
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
      config: {
        imageConfig: {
          aspectRatio: "3:4",
        },
      },
    });

    const candidates = response.candidates;
    if (candidates && candidates.length > 0 && candidates[0].content && candidates[0].content.parts) {
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
