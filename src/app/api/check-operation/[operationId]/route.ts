import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, type GenerateVideosOperation } from '@google/genai';

export async function GET(
  _request: NextRequest,
  { params }: { params: { operationId: string } }
) {
  try {
    const { operationId } = params;

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const opRef = { name: operationId } as unknown as GenerateVideosOperation;
    const updatedOperation = await ai.operations.getVideosOperation({ operation: opRef });

    if (updatedOperation.done) {
      if (updatedOperation.response) {
        const videos = updatedOperation.response.generatedVideos;

        if (!videos || videos.length === 0) {
          return NextResponse.json({ error: 'No videos generated' }, { status: 500 });
        }

        const firstVideo = videos[0];
        if (!firstVideo?.video?.uri) {
          return NextResponse.json({ error: 'Video missing URI' }, { status: 500 });
        }

        const videoObject = firstVideo.video;
        const url = decodeURIComponent(videoObject.uri!);
        const videoUrl = url.includes('?') ? `${url}&key=${apiKey}` : `${url}?key=${apiKey}`;

        return NextResponse.json({
          done: true,
          videoUrl,
          videoObject,
        });
      } else {
        return NextResponse.json({ done: true, error: 'No videos generated' });
      }
    }

    return NextResponse.json({ done: false });
  } catch (error) {
    console.error('Error checking operation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}