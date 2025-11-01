// src/app/api/generate-video/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, VideoGenerationReferenceImage, VideoGenerationReferenceType } from '@google/genai';
import { GenerationMode } from '@/app/types';

const operations = new Map<string, any>(); // può restare, ma non verrà usata

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const prompt = formData.get('prompt') as string;
    const model = formData.get('model') as string;
    const aspectRatio = formData.get('aspectRatio') as string;
    const resolution = formData.get('resolution') as string;
    const mode = formData.get('mode') as string;
    const isLooping = formData.get('isLooping') === 'true';
    const inputVideoUri = formData.get('inputVideoUri') as string | null;

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    const config: any = {
      numberOfVideos: 1,
      resolution: resolution,
    };

    if (mode !== GenerationMode.EXTEND_VIDEO) {
      config.aspectRatio = aspectRatio;
    }

    const generateVideoPayload: any = {
      model: model,
      config: config,
    };

    if (prompt) {
      generateVideoPayload.prompt = prompt;
    }

    if (mode === GenerationMode.FRAMES_TO_VIDEO) {
      const startFrameFile = formData.get('startFrame') as File | null;
      if (startFrameFile) {
        const startFrameBytes = Buffer.from(await startFrameFile.arrayBuffer()).toString('base64');
        generateVideoPayload.image = {
          imageBytes: startFrameBytes,
          mimeType: startFrameFile.type,
        };
      }

      const endFrameFile = formData.get('endFrame') as File | null;
      const finalEndFrame = isLooping ? startFrameFile : endFrameFile;

      if (finalEndFrame) {
        const endFrameBytes = Buffer.from(await finalEndFrame.arrayBuffer()).toString('base64');
        generateVideoPayload.config.lastFrame = {
          imageBytes: endFrameBytes,
          mimeType: finalEndFrame.type,
        };
      }
    } else if (mode === GenerationMode.REFERENCES_TO_VIDEO) {
      const referenceImagesPayload: VideoGenerationReferenceImage[] = [];

      let index = 0;
      while (formData.has(`referenceImage${index}`)) {
        const refFile = formData.get(`referenceImage${index}`) as File;
        const refBytes = Buffer.from(await refFile.arrayBuffer()).toString('base64');
        referenceImagesPayload.push({
          image: {
            imageBytes: refBytes,
            mimeType: refFile.type,
          },
          referenceType: VideoGenerationReferenceType.ASSET,
        });
        index++;
      }

      const styleImageFile = formData.get('styleImage') as File | null;
      if (styleImageFile) {
        const styleBytes = Buffer.from(await styleImageFile.arrayBuffer()).toString('base64');
        referenceImagesPayload.push({
          image: {
            imageBytes: styleBytes,
            mimeType: styleImageFile.type,
          },
          referenceType: VideoGenerationReferenceType.STYLE,
        });
      }

      if (referenceImagesPayload.length > 0) {
        generateVideoPayload.config.referenceImages = referenceImagesPayload;
      }
    } else if (mode === GenerationMode.EXTEND_VIDEO) {
      if (inputVideoUri) {
        generateVideoPayload.video = { uri: inputVideoUri };
      } else {
        return NextResponse.json({ error: 'Input video required for extension' }, { status: 400 });
      }
    }

    const operation = await ai.models.generateVideos(generateVideoPayload);

    // Invia al client l'ID reale dell'operazione (name) invece di un UUID locale
    return NextResponse.json({ operationId: operation.name });
  } catch (error) {
    console.error('Error generating video:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}