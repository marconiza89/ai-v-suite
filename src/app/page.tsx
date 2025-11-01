// src/app/page.tsx Una cocinella vola verso un fiore, la telecamera la segue da dietro con una ripresa MACRO dinamica
"use client";

import { Video } from '@google/genai';
import React, { useCallback, useEffect, useState } from 'react';
import ApiKeyDialog from '@/components/ApiKeyDialog';
import { CurvedArrowDownIcon } from '@/components/icons';
import LoadingIndicator from '@/components/LoadingIndicator';
import PromptForm from '@/components/PromptForm';
import VideoResult from '@/components/VideoResult';
import {
  AppState,
  GenerateVideoParams,
  GenerationMode,
  Resolution,
  VideoFile,
} from '@/app/types';

export default function Home() {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastConfig, setLastConfig] = useState<GenerateVideoParams | null>(null);
  const [lastVideoObject, setLastVideoObject] = useState<Video | null>(null);
  const [lastVideoBlob, setLastVideoBlob] = useState<Blob | null>(null);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [initialFormValues, setInitialFormValues] = useState<GenerateVideoParams | null>(null);

  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const response = await fetch('/api/check-api-key');
        const data = await response.json();
        if (!data.hasKey) {
          setShowApiKeyDialog(true);
        }
      } catch (error) {
        console.warn('Failed to check API key', error);
        setShowApiKeyDialog(true);
      }
    };
    checkApiKey();
  }, []);

  const showStatusError = (message: string) => {
    setErrorMessage(message);
    setAppState(AppState.ERROR);
  };

  const handleGenerate = useCallback(async (params: GenerateVideoParams) => {
    setAppState(AppState.LOADING);
    setErrorMessage(null);
    setLastConfig(params);
    setInitialFormValues(null);

    try {
      const formData = new FormData();
      formData.append('prompt', params.prompt);
      formData.append('model', params.model);
      formData.append('aspectRatio', params.aspectRatio);
      formData.append('resolution', params.resolution);
      formData.append('mode', params.mode);
      formData.append('isLooping', String(params.isLooping || false));

      if (params.startFrame) {
        formData.append('startFrame', params.startFrame.file);
      }
      if (params.endFrame) {
        formData.append('endFrame', params.endFrame.file);
      }
      if (params.referenceImages) {
        params.referenceImages.forEach((img, index) => {
          formData.append(`referenceImage${index}`, img.file);
        });
      }
      if (params.styleImage) {
        formData.append('styleImage', params.styleImage.file);
      }
      if (params.inputVideoObject && params.inputVideoObject.uri) {
        formData.append('inputVideoUri', params.inputVideoObject.uri);
      }

      const response = await fetch('/api/generate-video', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Video generation failed');
      }

      const data = await response.json();
      const { operationId } = data;

      // Poll for completion
      let isComplete = false;
      while (!isComplete) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        const statusResponse = await fetch(`/api/check-operation/${operationId}`);
        const statusData = await statusResponse.json();

        if (statusData.done) {
          isComplete = true;
          if (statusData.error) {
            throw new Error(statusData.error);
          }
          
          const videoBlob = await fetch(statusData.videoUrl).then(r => r.blob());
          const objectUrl = URL.createObjectURL(videoBlob);
          
          setVideoUrl(objectUrl);
          setLastVideoBlob(videoBlob);
          setLastVideoObject(statusData.videoObject);
          setAppState(AppState.SUCCESS);
        }
      }
    } catch (error) {
      console.error('Video generation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      
      let userFriendlyMessage = `Video generation failed: ${errorMessage}`;
      let shouldOpenDialog = false;

      if (typeof errorMessage === 'string') {
        if (errorMessage.includes('Requested entity was not found.')) {
          userFriendlyMessage = 'Model not found. Please check your API key configuration.';
          shouldOpenDialog = true;
        } else if (
          errorMessage.includes('API_KEY_INVALID') ||
          errorMessage.includes('API key not valid') ||
          errorMessage.toLowerCase().includes('permission denied')
        ) {
          userFriendlyMessage = 'Your API key is invalid or lacks permissions.';
          shouldOpenDialog = true;
        }
      }

      setErrorMessage(userFriendlyMessage);
      setAppState(AppState.ERROR);

      if (shouldOpenDialog) {
        setShowApiKeyDialog(true);
      }
    }
  }, []);

  const handleRetry = useCallback(() => {
    if (lastConfig) {
      handleGenerate(lastConfig);
    }
  }, [lastConfig, handleGenerate]);

  const handleApiKeyDialogContinue = () => {
    setShowApiKeyDialog(false);
  };

  const handleNewVideo = useCallback(() => {
    setAppState(AppState.IDLE);
    setVideoUrl(null);
    setErrorMessage(null);
    setLastConfig(null);
    setLastVideoObject(null);
    setLastVideoBlob(null);
    setInitialFormValues(null);
  }, []);

  const handleTryAgainFromError = useCallback(() => {
    if (lastConfig) {
      setInitialFormValues(lastConfig);
      setAppState(AppState.IDLE);
      setErrorMessage(null);
    } else {
      handleNewVideo();
    }
  }, [lastConfig, handleNewVideo]);

  const handleExtend = useCallback(async () => {
    if (lastConfig && lastVideoBlob && lastVideoObject) {
      try {
        const file = new File([lastVideoBlob], 'last_video.mp4', {
          type: lastVideoBlob.type,
        });
        const videoFile: VideoFile = { file, base64: '' };

        setInitialFormValues({
          ...lastConfig,
          mode: GenerationMode.EXTEND_VIDEO,
          prompt: '',
          inputVideo: videoFile,
          inputVideoObject: lastVideoObject,
          resolution: Resolution.P720,
          startFrame: null,
          endFrame: null,
          referenceImages: [],
          styleImage: null,
          isLooping: false,
        });

        setAppState(AppState.IDLE);
        setVideoUrl(null);
        setErrorMessage(null);
      } catch (error) {
        console.error('Failed to process video for extension:', error);
        const message = error instanceof Error ? error.message : 'An unknown error occurred.';
        showStatusError(`Failed to prepare video for extension: ${message}`);
      }
    }
  }, [lastConfig, lastVideoBlob, lastVideoObject]);

  const renderError = (message: string) => (
    <div className="text-center bg-red-900/20 border border-red-500 p-8 rounded-lg">
      <h2 className="text-2xl font-bold text-red-400 mb-4">Error</h2>
      <p className="text-red-300">{message}</p>
      <button
        onClick={handleTryAgainFromError}
        className="mt-6 px-6 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
        Try Again
      </button>
    </div>
  );

  return (
    <div className="h-screen bg-black text-gray-200 flex flex-col font-sans overflow-hidden">
      {showApiKeyDialog && (
        <ApiKeyDialog onContinue={handleApiKeyDialogContinue} />
      )}
      <header className="py-6 flex justify-center items-center px-8 relative z-10">
        <h1 className="text-5xl font-semibold tracking-wide text-center bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
          Veo Studio
        </h1>
      </header>
      <main className="w-full max-w-4xl mx-auto flex-grow flex flex-col p-4">
        {appState === AppState.IDLE ? (
          <>
            <div className="flex-grow flex items-center justify-center">
              <div className="relative text-center">
                <h2 className="text-3xl text-gray-600">
                  Type in the prompt box to start
                </h2>
                <CurvedArrowDownIcon className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-24 h-24 text-gray-700 opacity-60" />
              </div>
            </div>
            <div className="pb-4">
              <PromptForm
                onGenerate={handleGenerate}
                initialValues={initialFormValues}
              />
            </div>
          </>
        ) : (
          <div className="flex-grow flex items-center justify-center">
            {appState === AppState.LOADING && <LoadingIndicator />}
            {appState === AppState.SUCCESS && videoUrl && (
              <VideoResult
                videoUrl={videoUrl}
                onRetry={handleRetry}
                onNewVideo={handleNewVideo}
                onExtend={handleExtend}
                canExtend={lastConfig?.resolution === Resolution.P720}
              />
            )}
            {appState === AppState.SUCCESS &&
              !videoUrl &&
              renderError('Video generated, but URL is missing. Please try again.')}
            {appState === AppState.ERROR &&
              errorMessage &&
              renderError(errorMessage)}
          </div>
        )}
      </main>
    </div>
  );
}