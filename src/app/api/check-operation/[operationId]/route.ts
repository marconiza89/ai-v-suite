// src/app/api/check-operation/[operationId]/route.ts
import { NextRequest, NextResponse } from 'next/server';

const operations = new Map<string, any>();

export async function GET(
  request: NextRequest,
  { params }: { params: { operationId: string } }
) {
  try {
    const { operationId } = params;
    const operationData = operations.get(operationId);

    if (!operationData) {
      return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
    }

    const { operation: currentOp, ai, apiKey } = operationData;
    const updatedOperation = await ai.operations.getVideosOperation({ operation: currentOp });

    operations.set(operationId, {
      operation: updatedOperation,
      ai,
      apiKey,
    });

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
        const url = decodeURIComponent(videoObject.uri);
        const videoUrl = `${url}&key=${apiKey}`;

        operations.delete(operationId);

        return NextResponse.json({
          done: true,
          videoUrl,
          videoObject,
        });
      } else {
        operations.delete(operationId);
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