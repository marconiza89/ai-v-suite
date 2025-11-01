// src/components/ApiKeyDialog.tsx
"use client";

import React from 'react';


interface ApiKeyDialogProps {
    onContinue: () => void;
}

export function ApiKeyDialog({ onContinue }: ApiKeyDialogProps) {
    return (
        <>
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl max-w-lg w-full p-8 text-center flex flex-col items-center">
                    <div className="bg-indigo-600/20 p-4 rounded-full mb-6">
                       PAGAAAA
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-4">API Key Required for Veo</h2>
                    <button
                        onClick={onContinue}
                        className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors text-lg"
                    >                        Continue
                    </button>
                </div >
            </div >
        </>
    );
};

export default ApiKeyDialog;