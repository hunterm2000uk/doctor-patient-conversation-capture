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
      const [statusMessage, setStatusMessage] = useState('');
      const mediaRecorder = useRef(null);
      const audioChunks = useRef([]);
      const streamRef = useRef(null);
      const audioUrl = useRef(null);
      const ws = useRef(null);
      const apiKey = 'jiM6y2edA7pPjtZ2l6E98anSoy8jH0zH'; // Updated API key
      const timeoutRef = useRef(null);
      const statusBoxRef = useRef(null);
      const wsTimeoutRef = useRef(null);

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
          setStatusMessage(prev => prev + '\nRequesting microphone access...');
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
              setStatusMessage(prev => prev + '\nMicrophone access granted. Initializing audio recorder...');
              streamRef.current = stream;
              mediaRecorder.current = new MediaRecorder(stream, {
                 mimeType: 'audio/webm;codecs=pcm',
                 bitsPerSecond: 48000
              });
              mediaRecorder.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                  audioChunks.current.push(event.data);
                  if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                    setStatusMessage(prev => prev + `\nSending audio data to Speechmatics API... Chunk size: ${event.data.size}`);
                    ws.current.send(event.data);
                  } else {
                    setStatusMessage(prev => prev + `\nWebSocket not open, audio chunk not sent. ReadyState: ${ws.current?.readyState}`);
                  }
                }
              };
              mediaRecorder.current.onstop = () => {
                setStatusMessage(prev => prev + '\nAudio recording stopped. Processing audio...');
                const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
                audioChunks.current = [];
                const url = URL.createObjectURL(audioBlob);
                audioUrl.current = url;
                if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                  setStatusMessage(prev => prev + '\nSending EndOfStream message to Speechmatics API...');
                  ws.current.send(JSON.stringify({ message: 'EndOfStream' }));
                  ws.current.close();
                  setStatusMessage(prev => prev + '\nEndOfStream message sent and WebSocket closed.');
                } else {
                  setStatusMessage(prev => prev + '\nWebSocket not open, EndOfStream message not sent.');
                }
              };

              // Initialize WebSocket
              setStatusMessage(prev => prev + '\nConnecting to Speechmatics API...');
              ws.current = new WebSocket('wss://api.speechmatics.com/v2/ws/transcribe', 'pcm');

              ws.current.onopen = () => {
                setStatusMessage(prev => prev + `\nWebSocket connection opened. ReadyState: ${ws.current.readyState}. Sending StartRecognition message...`);
                ws.current.send(JSON.stringify({
                  message: 'StartRecognition',
                  transcription_config: {
                    language: 'en',
                     audio_format: 'pcm',
                     sample_rate: 48000,
                    operating_point: 'enhanced',
                  },
                  auth_token: apiKey
                }));
                timeoutRef.current = setTimeout(() => {
                  if (transcription === '') {
                    setStatusMessage(prev => prev + '\nNo transcription received from Speechmatics API after 10 seconds.');
                  }
                }, 10000);
                mediaRecorder.current.start(200); // Start recording after WebSocket is open
              };

              ws.current.onmessage = (event) => {
                try {
                  const data = JSON.parse(event.data);
                  setStatusMessage(prev => prev + `\nWebSocket message received: ${JSON.stringify(data)}`);
                  if (data.message === 'StartRecognition') {
                    if (data.error) {
                      setStatusMessage(prev => prev + `\nStartRecognition error: ${data.error}`);
                    } else {
                      setStatusMessage(prev => prev + '\nStartRecognition successful.');
                    }
                  }
                  if (data.message === 'AddTranscript') {
                    const timestamp = new Date().toLocaleTimeString();
                    const transcript = data.results.reduce((acc, result) => acc + result.alternatives[0].transcript, '');
                    setTranscription(prev => prev + `[${timestamp}] ${transcript} `);
                    setStatusMessage(prev => prev + '\nTranscription received from Speechmatics API.');
                    clearTimeout(timeoutRef.current);
                  }
                } catch (error) {
                  console.error('Error parsing WebSocket message:', error);
                  setStatusMessage(prev => prev + `\nError parsing WebSocket message: ${error.message}`);
                }
              };

              ws.current.onerror = (event) => {
                console.error('WebSocket error:', event);
                setStatusMessage(prev => prev + `\nWebSocket error: ${event.message || event.type}`);
                clearTimeout(wsTimeoutRef.current);
              };

              ws.current.onclose = (event) => {
                setStatusMessage(prev => prev + `\nWebSocket connection closed. Close code: ${event.code}, Reason: ${event.reason}`);
                clearTimeout(wsTimeoutRef.current);
              };

              wsTimeoutRef.current = setTimeout(() => {
                if (ws.current && ws.current.readyState !== WebSocket.OPEN) {
                  setStatusMessage(prev => prev + '\nWebSocket connection timed out.');
                  if (ws.current && ws.current.readyState !== WebSocket.CLOSED) {
                    ws.current.close();
                  }
                }
              }, 5000);
            })
            .catch(error => {
              console.error('Error accessing microphone:', error);
              setStatusMessage(prev => prev + `\nError accessing microphone: ${error.message}`);
            })
            .finally(() => {
              if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
                mediaRecorder.current.stop();
              }
              if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
              }
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
          <div className="status-box" ref={statusBoxRef}>
            <pre>{statusMessage}</pre>
          </div>
        </div>
      );
    }

    export default App;
