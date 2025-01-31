import React, { useState, useEffect, useRef } from 'react';
    import './App.css';

    function App() {
      const [transcription, setTranscription] = useState('');
      const [isRecording, setIsRecording] = useState(false);
      const [clinicLetter, setClinicLetter] = useState({
        chiefComplaint: 'Patient presents with...',
        historyOfPresentIllness: 'The patient reports...',
        assessmentAndPlan: 'Based on the above, the plan is...'
      });
      const [statusMessage, setStatusMessage] = useState('Ready');
      const mediaRecorder = useRef(null);
      const audioChunks = useRef([]);
      const streamRef = useRef(null);
      const audioUrl = useRef(null);
      const ws = useRef(null);
      const apiKey = 'fQxsqtjOjLsXOrzCgyRAJGjXcYvLpjW1'; // Updated API key

      const handleEditLetter = (field, value) => {
        setClinicLetter(prev => ({ ...prev, [field]: value }));
      };

      const extractMedicalDetails = (text) => {
        // This is a placeholder for actual NLP processing
        const chiefComplaint = text.includes('headache') ? 'Patient complains of headache.' : 'Patient presents with general symptoms.';
        const historyOfPresentIllness = text.includes('fever') ? 'Patient reports fever for 2 days.' : 'Patient reports no fever.';
        const assessmentAndPlan = text.includes('rest') ? 'Advise rest and hydration.' : 'Further evaluation needed.';

        setClinicLetter({
          chiefComplaint,
          historyOfPresentIllness,
          assessmentAndPlan
        });
      };

      useEffect(() => {
        extractMedicalDetails(transcription);
      }, [transcription]);

      useEffect(() => {
        if (isRecording) {
          setStatusMessage('Requesting microphone access...');
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
              setStatusMessage('Microphone access granted. Initializing audio recorder...');
              streamRef.current = stream;
              mediaRecorder.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
              mediaRecorder.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                  audioChunks.current.push(event.data);
                  if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                    setStatusMessage(`Sending audio data to Speechmatics API... Chunk size: ${event.data.size}`);
                    ws.current.send(event.data);
                  } else {
                    setStatusMessage(`WebSocket not open, audio chunk not sent. ReadyState: ${ws.current?.readyState}`);
                  }
                }
              };
              mediaRecorder.current.onstop = () => {
                setStatusMessage('Audio recording stopped. Processing audio...');
                const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
                audioChunks.current = [];
                const url = URL.createObjectURL(audioBlob);
                audioUrl.current = url;
              };
              mediaRecorder.current.start(200); // Send data every 200ms

              // Initialize WebSocket
              setStatusMessage('Connecting to Speechmatics API...');
              ws.current = new WebSocket('wss://api.speechmatics.com/v2/ws/transcribe?format=pcm&sample_rate=48000');

              ws.current.onopen = () => {
                setStatusMessage('WebSocket connection opened. Sending StartRecognition message...');
                ws.current.send(JSON.stringify({
                  message: 'StartRecognition',
                  transcription_config: {
                    language: 'en',
                    operating_point: 'enhanced',
                  },
                  auth_token: apiKey
                }));
              };

              ws.current.onmessage = (event) => {
                try {
                  const data = JSON.parse(event.data);
                  setStatusMessage(`WebSocket message received: ${JSON.stringify(data)}`);
                  if (data.message === 'AddTranscript') {
                    const timestamp = new Date().toLocaleTimeString();
                    const transcript = data.results.reduce((acc, result) => acc + result.alternatives[0].transcript, '');
                    setTranscription(prev => prev + `[${timestamp}] ${transcript} `);
                    setStatusMessage('Transcription received.');
                  }
                } catch (error) {
                  console.error('Error parsing WebSocket message:', error);
                  setStatusMessage(`Error parsing WebSocket message: ${error.message}`);
                }
              };

              ws.current.onerror = (error) => {
                console.error('WebSocket error:', error);
                setStatusMessage(`WebSocket error: ${error.message}`);
              };

              ws.current.onclose = () => {
                setStatusMessage('WebSocket connection closed. Sending EndOfStream message...');
                if (ws.current && ws.current.readyState !== WebSocket.CLOSED) {
                  ws.current.send(JSON.stringify({ message: 'EndOfStream' }));
                  ws.current.close();
                } else {
                  setStatusMessage('WebSocket connection already closed.');
                }
              };
            })
            .catch(error => {
              console.error('Error accessing microphone:', error);
              setStatusMessage(`Error accessing microphone: ${error.message}`);
            });
        } else if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
            mediaRecorder.current.stop();
            if (streamRef.current) {
              streamRef.current.getTracks().forEach(track => track.stop());
            }
        }
      }, [isRecording]);

      const toggleRecording = () => {
        setIsRecording(!isRecording);
      };

      const handleSave = () => {
        console.log('Saving clinic letter:', clinicLetter);
        // Here you would typically save the data to a database or send it to an API
      };

      return (
        <div className="app-container">
          <h1>Doctor-Patient Conversation Capture</h1>
          <div className="panels">
            <div className="transcription-panel">
              <h2>Live Transcription</h2>
              <button onClick={toggleRecording}>{isRecording ? 'Stop Recording' : 'Start Recording'}</button>
              <p>{transcription}</p>
              {audioUrl.current && <audio src={audioUrl.current} controls />}
            </div>
            <div className="letter-panel">
              <h2>Clinic Letter</h2>
              <div className="letter-section">
                <h3>Chief Complaint</h3>
                <textarea value={clinicLetter.chiefComplaint} onChange={e => handleEditLetter('chiefComplaint', e.target.value)} />
              </div>
              <div className="letter-section">
                <h3>History of Present Illness</h3>
                <textarea value={clinicLetter.historyOfPresentIllness} onChange={e => handleEditLetter('historyOfPresentIllness', e.target.value)} />
              </div>
              <div className="letter-section">
                <h3>Assessment and Plan</h3>
                <textarea value={clinicLetter.assessmentAndPlan} onChange={e => handleEditLetter('assessmentAndPlan', e.target.value)} />
              </div>
              <button onClick={handleSave}>Save</button>
            </div>
          </div>
          <div className="status-box">
            <p>Status: {statusMessage}</p>
          </div>
        </div>
      );
    }

    export default App;
