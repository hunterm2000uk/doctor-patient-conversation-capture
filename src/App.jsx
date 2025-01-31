import React, { useState, useEffect, useRef } from 'react';
    import './App.css';
    import { WebSocket } from 'ws';

    function App() {
      const [transcription, setTranscription] = useState('');
      const [isRecording, setIsRecording] = useState(false);
      const [clinicLetter, setClinicLetter] = useState({
        chiefComplaint: 'Patient presents with...',
        historyOfPresentIllness: 'The patient reports...',
        assessmentAndPlan: 'Based on the above, the plan is...'
      });
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
          navigator.mediaDevices.getUserMedia({ audio: {sampleRate: 16000} })
            .then(stream => {
              streamRef.current = stream;
              mediaRecorder.current = new MediaRecorder(stream);
              mediaRecorder.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                  audioChunks.current.push(event.data);
                   if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                      const float32Array = new Float32Array(event.data);
                      const int16Array = new Int16Array(float32Array.length);
                      for (let i = 0; i < float32Array.length; i++) {
                        int16Array[i] = Math.min(Math.max(float32Array[i] * 0x7FFF, -0x8000), 0x7FFF);
                      }
                      ws.current.send(int16Array.buffer);
                    }
                }
              };
              mediaRecorder.current.onstop = () => {
                const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
                audioChunks.current = [];
                const url = URL.createObjectURL(audioBlob);
                audioUrl.current = url;
                if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                  ws.current.send(JSON.stringify({ message: 'EndOfStream' }));
                  ws.current.close();
                }
              };
              mediaRecorder.current.start(200); // Send data every 200ms

              // Initialize WebSocket
              ws.current = new WebSocket('wss://api.speechmatics.com/v2/ws/transcribe');

              ws.current.onopen = () => {
                console.log('WebSocket connection opened');
                ws.current.send(JSON.stringify({
                  message: 'StartRecognition',
                  transcription_config: {
                    language: 'en',
                    diarization: 'none',
                    operating_point: 'enhanced',
                    max_delay_mode: 'flexible',
                    max_delay: 1,
                    enable_partials: true,
                    enable_entities: true
                  },
                  audio_format: {
                    type: 'raw',
                    sample_rate: 16000,
                    encoding: 'pcm_f32le'
                  },
                  auth_token: apiKey
                }));
              };

              ws.current.onmessage = (event) => {
                try {
                  const data = JSON.parse(event.data);
                   if (data.message === 'AddTranscript') {
                    const timestamp = new Date().toLocaleTimeString();
                    const transcript = data.results.reduce((acc, result) => acc + result.alternatives[0].transcript, '');
                    setTranscription(prev => prev + `[${timestamp}] ${transcript} `);
                  }
                } catch (error) {
                  console.error('Error parsing WebSocket message:', error);
                }
              };

              ws.current.onerror = (error) => {
                console.error('WebSocket error:', error);
              };

              ws.current.onclose = () => {
                console.log('WebSocket connection closed');
              };
            })
            .catch(error => {
              console.error('Error accessing microphone:', error);
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
        </div>
      );
    }

    export default App;
