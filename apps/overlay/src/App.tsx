import { useState, useEffect } from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { HeaderBar } from '@/components/HeaderBar';
import { TranscriptPanel } from '@/components/TranscriptPanel';
import { AISidebar } from '@/components/AISidebar';
import { useTranscription } from '@/hooks/useTranscription';
import { useRecording } from '@/hooks/useRecording';
import { useAIAnalysis } from '@/hooks/useAIAnalysis';

const SIDEBAR_STORAGE_KEY = 'overlay-sidebar-visible';

function App() {
  const [isSidebarVisible, setIsSidebarVisible] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return stored === 'true';
  });

  const {
    interimText,
    finalSegments,
    connectionStatus,
    connectionQuality,
    error: transcriptionError,
    clearTranscript,
  } = useTranscription();

  const {
    isRecording,
    micGain,
    startRecording,
    stopRecording,
    updateMicGain,
  } = useRecording();

  const {
    summary,
    isProcessing,
    queryAI,
  } = useAIAnalysis();

  // Save sidebar visibility to localStorage
  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isSidebarVisible));
  }, [isSidebarVisible]);

  const handleRecordToggle = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      clearTranscript();
      await startRecording();
    }
  };

  const handleToggleSidebar = () => {
    setIsSidebarVisible(prev => !prev);
  };

  return (
    <div className="w-screen h-screen flex flex-col glass-panel overflow-hidden">
      {/* Header */}
      <HeaderBar
        isRecording={isRecording}
        connectionStatus={connectionStatus}
        connectionQuality={connectionQuality}
        micGain={micGain}
        onRecordToggle={handleRecordToggle}
        onMicGainChange={updateMicGain}
      />

      {/* Main Content */}
      <div className="flex-1 flex relative overflow-hidden">
        {isSidebarVisible ? (
          <ResizablePanelGroup direction="horizontal" className="flex-1">
            {/* Transcript Panel */}
            <ResizablePanel defaultSize={65} minSize={40}>
              <TranscriptPanel
                interimText={interimText}
                finalSegments={finalSegments}
                isRecording={isRecording}
              />
            </ResizablePanel>

            {/* Resizable Handle */}
            <ResizableHandle withHandle className="w-1 bg-white/10 hover:bg-white/20" />

            {/* AI Sidebar */}
            <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
              <AISidebar
                summary={summary}
                isProcessing={isProcessing}
                onQueryAI={queryAI}
                isVisible={isSidebarVisible}
                onToggle={handleToggleSidebar}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <>
            {/* Full-width transcript */}
            <TranscriptPanel
              interimText={interimText}
              finalSegments={finalSegments}
              isRecording={isRecording}
            />

            {/* Collapsed sidebar toggle */}
            <AISidebar
              summary={summary}
              isProcessing={isProcessing}
              onQueryAI={queryAI}
              isVisible={isSidebarVisible}
              onToggle={handleToggleSidebar}
            />
          </>
        )}
      </div>

      {/* Error Toast (if needed) */}
      {transcriptionError && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-500/90 text-white text-[11px] px-4 py-2 rounded-md shadow-lg animate-fade-in">
          {transcriptionError}
        </div>
      )}
    </div>
  );
}

export default App;
